# Coordinate Transforms

The biggest engineering problem is aligning satellite pixels with geographic parking-space polygons.

## Pipeline

```
Satellite GeoTIFF
      ↓
rasterio CRS / transform
      ↓
latitude / longitude
      ↓
pixel coordinates
      ↓
parking-space polygons (in pixels or WGS84)
      ↓
RT-DETR bounding boxes
      ↓
Shapely intersection test
      ↓
OPEN / OCCUPIED
```

## Key operations

1. Load the GeoTIFF with `rasterio.open()`.
2. Read the image and its georeferencing transform.
3. Convert the user AOI from WGS84 to pixel coordinates with `rasterio.transform.rowcol()`.
4. Build or load parking-space polygons in WGS84.
5. Convert space polygons to pixel coordinates or convert detections to WGS84.
6. Run Shapely intersection/IoU between each detection and each space.
7. Convert final space polygons back to WGS84 for GeoJSON output.

## Tips

- Use `rasterio.crs.CRS` and `rasterio.Affine` for all transforms.
- Store the original CRS so reprojections are explicit.
- Crop the image to the AOI before detection to save compute.
- Buffer space polygons slightly if detections are noisy.
