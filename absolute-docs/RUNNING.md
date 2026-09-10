# Running the MVP

## Backend

```bash
# Create and activate a virtualenv (Python 3.11 recommended)
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run FastAPI
PYTHONPATH=. uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

### Useful env vars

- `TEST_IMAGE_PATH` — path to the static test GeoTIFF. Default: `UTD-resources/utd_naip_plus.tif`.
- `MODEL_NAME` — Hugging Face model for RT-DETR. Default: `PekingU/rtdetr_r50vd`.
- `DETECT_THRESHOLD` — detection confidence threshold. Default: `0.3`.
- `SPOT_CELL_SIZE_M` — cell size in meters when a lot has no mapped spaces. Default: `4.0`.
- `DETECTOR_BACKEND` — `rtdetr` (default) or `stub`. Use `stub` for a quick API test without downloading the model.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## Usage

1. Draw a polygon around a UTD parking lot on the satellite map.
2. Click **Analyze parking lot**.
3. The backend loads `utd_naip_plus.tif`, fetches parking-space geometry from OSM, detects cars, and returns a GeoJSON overlay.
4. MapLibre renders red (occupied), green (free), and gray (uncertain) space polygons.
