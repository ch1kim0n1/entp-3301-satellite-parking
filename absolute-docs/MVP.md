# MVP

Build this before touching real-time satellite APIs. The static-image MVP isolates the risky vision and coordinate-math parts.

## Steps

1. Select a parking lot on the MapLibre map.
2. Backend receives the GeoJSON polygon via `POST /analyze`.
3. Load a known high-resolution overhead image with `StaticTestProvider`.
4. Detect cars with RT-DETR from PaddleDetection.
5. Compare car bounding boxes against predefined parking-space polygons.
6. Return occupancy as a GeoJSON FeatureCollection.
7. Render red/green/gray spaces on MapLibre.

## Provider progression

Once the static MVP is reliable, replace the imagery source in stages:

```
static image
      ↓
latest aerial image
      ↓
Planet archive imagery
      ↓
Planet tasking / freshest imagery
```

This keeps vision, geometry, and coordinate logic stable while the input data source changes.

## Success criteria

- Polygon selection works in the browser.
- `POST /analyze` returns within a few seconds for a small lot.
- Detected vehicles align with visible cars in the test image.
- Each predefined space is correctly labeled occupied or free.
- Map overlay colors match results.
