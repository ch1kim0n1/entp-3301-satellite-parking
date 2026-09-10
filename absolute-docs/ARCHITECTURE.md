# Architecture

## High-level flow

```
MapLibre UI
  ↓ GeoJSON Polygon
FastAPI backend (POST /analyze)
  ├─ Imagery Service ──→ Planet / SkySat / local / static
  └─ Parking Geometry ──→ OSMnx / manual space polygons
          ↓
   Occupancy Engine
  (RT-DETR / SAM 2 / SMART_PARK logic)
          ↓
  [{spot_id, occupied, confidence, polygon}]
          ↓
  MapLibre red/green/gray overlay
```

## Frontend

- React / Next.js + MapLibre GL JS.
- User draws or clicks a polygon around a parking lot.
- Sends the GeoJSON Polygon to `POST /analyze`.
- Receives a GeoJSON FeatureCollection and renders each space with a color fill.

## Backend

- FastAPI.
- `POST /analyze` accepts an AOI polygon and an optional imagery provider override.
- Imagery provider resolution, parking-space geometry loading, and vision pipeline invocation all happen behind a common output format.
- The frontend does not care which imagery source or detector produced the result.

## Imagery provider interface

```python
class ImageryProvider:
    def get_latest_image(self, polygon):
        ...
```

Implementations:

- `StaticTestProvider` — load a manually downloaded aerial image.
- `LocalImageProvider` — local drone / camera / test GeoTIFF.
- `PlanetProvider` — Planet archive and tasking API.
- `DroneProvider` — future live drone feed.

Start with `StaticTestProvider`. Swapping providers is then an input change, not a pipeline rewrite.

## Parking geometry

- Primary source: OSMnx queries for parking lots, roads, entrances, buildings.
- Manual layer: drawn or edited space polygons stored locally or in a database.
- Output: a list of parking-space polygons in WGS84 (GeoJSON) or in pixel coordinates after a rasterio transform.

## Occupancy engine

- Vehicle detection: RT-DETR from PaddleDetection (Apache-2.0) or YOLO.
- Optional segmentation: SAM 2 for precise vehicle/region masks.
- SMART_PARK is studied for pipeline concepts (bird's-eye view, space mapping, occupancy logic) but not copied verbatim.
- Intersect each detection with each parking-space polygon using Shapely.
- Decide `occupied` based on IoU or centroid-in-polygon test, with a confidence score.

## Common output format

```json
{
  "capture_time": "2026-09-10T20:30:00Z",
  "spots": [
    {
      "id": "A101",
      "polygon": [...],
      "occupied": true,
      "confidence": 0.94
    }
  ]
}
```

Frontend mapping:

- `occupied == true` → red
- `occupied == false` → green
- low confidence or missing → gray
