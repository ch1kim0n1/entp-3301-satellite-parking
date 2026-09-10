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
  "capture_time": "2026-09-10T20:30:00Z",
  "image_id": "static_lot_001",
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
