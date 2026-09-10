import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

TEST_IMAGE_PATH = os.environ.get(
    "TEST_IMAGE_PATH", str(ROOT / "UTD-resources" / "utd_naip_plus.tif")
)
MODEL_NAME = os.environ.get("MODEL_NAME", "PekingU/rtdetr_r50vd")
DETECT_THRESHOLD = float(os.environ.get("DETECT_THRESHOLD", "0.3"))
SPOT_CELL_SIZE_M = float(os.environ.get("SPOT_CELL_SIZE_M", "4.0"))
DETECTOR_BACKEND = os.environ.get("DETECTOR_BACKEND", "rtdetr")
