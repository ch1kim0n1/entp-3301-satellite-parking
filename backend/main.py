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
from imagery.provider import StaticTestProvider
from parking_geometry.loader import load_parking_areas
from shared.coordinates import transform_geom, wgs84_geom_to_pixel_geom
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


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    try:
        aoi = shape(req.geometry)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid geometry: {e}")

    if not aoi.is_valid or aoi.is_empty:
        raise HTTPException(status_code=400, detail="Geometry is empty or invalid")

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
            det_polys.append(
                box(xmin + col0, ymin + row0, xmax + col0, ymax + row0)
            )

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
            capture_time=datetime.now(timezone.utc).isoformat(),
            image_id="utd_naip_plus",
            spots=out_spots,
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
        capture_time=datetime.now(timezone.utc).isoformat(),
        image_id="utd_naip_plus",
        spots=[],
        feature_collection={"type": "FeatureCollection", "features": []},
    )


def _is_occupied(spot_pixel, det_polys):
    occupied = False
    best_conf = 0.0
    for det in det_polys:
        if spot_pixel.intersects(det):
            inter = spot_pixel.intersection(det).area
            union = spot_pixel.union(det).area
            iou = inter / union if union else 0.0
            if (
                iou > 0.1
                or spot_pixel.centroid.within(det)
                or det.centroid.within(spot_pixel)
            ):
                occupied = True
                best_conf = max(best_conf, iou)
    return occupied, best_conf
