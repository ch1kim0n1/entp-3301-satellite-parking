from datetime import datetime, timezone

import numpy as np
import rasterio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from shapely.geometry import box, mapping, shape

from backend.config import (
    DETECT_THRESHOLD,
    DETECTOR_BACKEND,
    MODEL_NAME,
    SPOT_CELL_SIZE_M,
    TEST_IMAGE_PATH,
)
from backend.garage_availability import get_garage_availability
from imagery.provider import StaticTestProvider
from parking_geometry.loader import load_cached_parking_lots, load_parking_areas
from shared.coordinates import wgs84_geom_to_pixel_geom
from shared.schemas import AnalyzeRequest, AnalyzeResponse
from vision.detector import Detector, RTDetrDetector, StubDetector

app = FastAPI(title="Satellite Parking MVP")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_provider = StaticTestProvider(TEST_IMAGE_PATH)
_detector: Detector | None = None


def _get_detector() -> Detector:
    global _detector
    if _detector is None:
        if DETECTOR_BACKEND == "stub":
            _detector = StubDetector()
        else:
            _detector = RTDetrDetector(model_name=MODEL_NAME, threshold=DETECT_THRESHOLD)
    return _detector


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/garage-availability")
def garage_availability():
    return get_garage_availability()


@app.get("/parking-lots")
def parking_lots():
    lots = load_cached_parking_lots()
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {
                    "lot_id": lot["id"],
                    "name": lot["name"],
                    "short_name": lot["short_name"],
                    "capacity": lot["capacity"],
                    "kind": lot["kind"],
                },
                "geometry": lot["polygon"],
            }
            for lot in lots
        ],
    }


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    try:
        aoi = shape(req.geometry)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid geometry: {e}")

    if not aoi.is_valid or aoi.is_empty:
        raise HTTPException(status_code=400, detail="Geometry is empty or invalid")
    if aoi.geom_type != "Polygon":
        raise HTTPException(status_code=400, detail="Geometry must be a GeoJSON Polygon")

    spots = load_parking_areas(aoi, req.spot_cell_size_m or SPOT_CELL_SIZE_M)
    if not spots:
        return _empty_response()

    with _provider.get_image(req.geometry) as src:
        aoi_pixel = wgs84_geom_to_pixel_geom(aoi, src)
        minx, miny, maxx, maxy = aoi_pixel.bounds
        col0 = max(0, int(np.floor(minx)))
        row0 = max(0, int(np.floor(miny)))
        col1 = min(src.width, int(np.ceil(maxx)))
        row1 = min(src.height, int(np.ceil(maxy)))
        if col1 <= col0 or row1 <= row0:
            raise HTTPException(status_code=400, detail="AOI is outside image bounds")

        window = rasterio.windows.Window(col0, row0, col1 - col0, row1 - row0)
        image = src.read(window=window)
        image = np.moveaxis(image, 0, -1)
        if image.shape[-1] == 4:
            image = image[..., :3]

        detector = _get_detector()
        detections = detector.detect(image)
        det_polys = []
        for d in detections:
            xmin, ymin, xmax, ymax = d["bbox"]
            det_polys.append({
                "polygon": box(xmin + col0, ymin + row0, xmax + col0, ymax + row0),
                "confidence": d["confidence"],
            })

        out_spots = []
        for spot in spots:
            spot_geom_wgs84 = spot["polygon"]
            spot_pixel = wgs84_geom_to_pixel_geom(spot_geom_wgs84, src)
            occupied, confidence = _is_occupied(spot_pixel, det_polys)
            out_spots.append(
                {
                    "id": spot["id"],
                    "polygon": mapping(spot_geom_wgs84),
                    "occupied": occupied,
                    "confidence": confidence,
                }
            )

        return AnalyzeResponse(
            capture_time=None,
            analyzed_at=datetime.now(timezone.utc).isoformat(),
            image_id="utd_naip_plus_historic",
            imagery_source="Bundled USGS NAIP aerial GeoTIFF",
            imagery_is_current=False,
            spots=out_spots,
            detected_vehicles=len(detections),
            feature_collection={
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "properties": {
                            "spot_id": s["id"],
                            "occupied": s["occupied"],
                            "confidence": s["confidence"],
                        },
                        "geometry": s["polygon"],
                    }
                    for s in out_spots
                ],
            },
        )


def _empty_response():
    return AnalyzeResponse(
        capture_time=None,
        analyzed_at=datetime.now(timezone.utc).isoformat(),
        image_id="utd_naip_plus_historic",
        imagery_source="Bundled USGS NAIP aerial GeoTIFF",
        imagery_is_current=False,
        spots=[],
        detected_vehicles=0,
        feature_collection={"type": "FeatureCollection", "features": []},
    )


def _is_occupied(spot_pixel, det_polys):
    # A zero-detection result from a generic model is not evidence that every
    # space is free. Preserve that uncertainty in the API and map overlay.
    if not det_polys:
        return None, 0.0

    occupied = False
    best_conf = 0.0
    for det in det_polys:
        det_polygon = det["polygon"]
        if spot_pixel.intersects(det_polygon):
            inter = spot_pixel.intersection(det_polygon).area
            union = spot_pixel.union(det_polygon).area
            iou = inter / union if union else 0.0
            if (
                iou > 0.1
                or spot_pixel.centroid.within(det_polygon)
                or det_polygon.centroid.within(spot_pixel)
            ):
                occupied = True
                best_conf = max(best_conf, float(det["confidence"]))
    return occupied, best_conf
