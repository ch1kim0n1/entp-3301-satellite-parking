# API

## POST /analyze

Request:

```json
{
  "type": "Polygon",
  "coordinates": [
    [
      [-96.7500, 32.9900],
      [-96.7490, 32.9900],
      [-96.7490, 32.9890],
      [-96.7500, 32.9890],
      [-96.7500, 32.9900]
    ]
  ],
  "provider": "static_test"
}
```

- `provider` is optional. Defaults to the configured provider.

Response:

```json
{
  "capture_time": null,
  "analyzed_at": "2026-09-10T20:30:00Z",
  "image_id": "utd_naip_plus_historic",
  "imagery_source": "Bundled USGS NAIP aerial GeoTIFF",
  "imagery_is_current": false,
  "spots": [
    {
      "id": "A101",
      "polygon": {
        "type": "Polygon",
        "coordinates": [...]
      },
      "occupied": true,
      "confidence": 0.94
    },
    {
      "id": "A102",
      "polygon": {
        "type": "Polygon",
        "coordinates": [...]
      },
      "occupied": false,
      "confidence": 0.91
    }
  ]
}
```

`capture_time` is `null` when the image's acquisition date is unavailable. `analyzed_at` records when the server performed the analysis. The bundled NAIP image is historical, so `imagery_is_current` is `false`.

## GeoJSON FeatureCollection output

For MapLibre rendering, the backend can also return a GeoJSON FeatureCollection:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "spot_id": "A101",
        "occupied": true,
        "confidence": 0.94
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [...]
      }
    }
  ]
}
```

## Status colors

- `occupied == true` → red
- `occupied == false` → green
- `confidence < threshold` or missing → gray
