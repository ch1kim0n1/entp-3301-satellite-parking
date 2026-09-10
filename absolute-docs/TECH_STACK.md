# Tech Stack

## Frontend

- React / Next.js
- MapLibre GL JS (BSD-3-Clause) — map, polygon drawing, GeoJSON overlay

## Backend

- FastAPI (Python)
- Uvicorn

## Imagery / geospatial

- Rasterio (BSD-3-Clause) — GeoTIFF loading, pixel ↔ geographic coordinate transforms
- GeoPandas (BSD-3-Clause) — geometry DataFrames, reprojections
- Shapely (BSD-3-Clause) — polygon operations, intersections, IoU
- OSMnx (MIT) — OpenStreetMap geometry: parking lots, roads, buildings
- TiTiler (MIT) — dynamic COG/STAC tile server if huge rasters need to be served to MapLibre without a full download

## Vision

- PaddleDetection / RT-DETR (Apache-2.0) — primary vehicle detector
- SAM 2 (Apache-2.0) — precise vehicle / parking-region segmentation
- eo-learn (MIT) — reference for EO ingestion, co-registration, masks, preprocessing, ML workflows

## Reference / study

- `SMART_PARK` — study-only for the conceptual pipeline: bird's-eye imagery → occupancy detection → parking-space mapping → JSON/UI. License is TBD; do not copy code directly.
- `s1_parking_occupancy` (not cloned) — methodology around Sentinel-1 ingestion, masks, thresholding; borrow geospatial ideas only.

## Package management

- Python: `pyproject.toml` / `requirements.txt`
- JavaScript: `package.json`

## Repository layout

```
satellite-parking/
├── frontend/
├── backend/
├── vision/
├── imagery/
├── parking_geometry/
├── shared/
├── OSS/
└── absolute-docs/
```

## License notes

| Project | License | How we use it |
|---|---|---|
| MapLibre GL JS | BSD-3-Clause | Frontend map, drawing, overlay |
| OSMnx | MIT | OSM geometry extraction |
| Rasterio | BSD-3-Clause | GeoTIFF I/O, transforms |
| GeoPandas | BSD-3-Clause | Geometry data frames |
| Shapely | BSD-3-Clause | Polygon operations |
| PaddleDetection | Apache-2.0 | Vehicle detection |
| SAM 2 | Apache-2.0 | Segmentation |
| eo-learn | MIT | EO pipeline reference |
| TiTiler | MIT | Dynamic tile serving |
| SMART_PARK | TBD | Reference / study only |

Note: SMART_PARK's license is listed as TBD. Use it for understanding the pipeline, not for copying source code.
