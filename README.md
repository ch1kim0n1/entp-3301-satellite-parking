# entp-3301-satellite-parking

Map-based app for selecting any parking area and using overhead imagery plus computer vision to show which visible parking spaces are occupied or available.

System design, MVP, and implementation plan are in `absolute-docs/`.

## Run locally

Use two terminals from the repository root:

```powershell
# Terminal 1: API
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

```powershell
# Terminal 2: web app
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. On its first real analysis, the detector downloads its model once; later runs use the local cache.

The map analysis uses the bundled NAIP aerial image and therefore reports conditions visible in that historic image—not current satellite conditions. The UI separately shows UTD's public garage-availability feed when it is reachable, and explicitly labels a saved snapshot when the public feed is offline.
