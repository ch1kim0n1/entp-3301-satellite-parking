# Roadmap

1. **Repo skeleton** — create `frontend/`, `backend/`, `vision/`, `imagery/`, `parking_geometry/`, `shared/`, `OSS/`, `absolute-docs/`.
2. **Map UI** — MapLibre page where user draws/selects a polygon and submits to backend.
3. **Imagery interface** — define `ImageryProvider`; implement `StaticTestProvider`.
4. **Parking geometry** — load OSMnx lot/road/building data; support manual space polygons.
5. **Vision module** — wire RT-DETR; produce bounding boxes.
6. **Occupancy engine** — intersect detections with spaces; emit the common output format.
7. **Coordinate glue** — implement pixel ↔ lat/lon with Rasterio + Shapely.
8. **Render overlay** — MapLibre consumes GeoJSON and colors spaces.
9. **Provider swap** — replace `StaticTestProvider` with Planet archive, then Planet tasking.
10. **Optimization** — add SAM 2 for tight masks, TiTiler for large rasters, caching, async jobs.
