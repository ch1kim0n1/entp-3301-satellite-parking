"""Simulated data for DEMO_MODE=1. Never mixed with real detections: responses carry is_demo=True."""

import hashlib
import time

DEMO_SOURCE = "SIMULATED DEMO DATA (not a real detection)"
OCCUPIED_SHARE = 0.72  # typical weekday-midday fill
DRIFT_SHARE = 0.06     # share of spaces that flip each tick so the lot looks alive
TICK_SECONDS = 20

# ponytail: base free-space counts are invented; real capacities live in the UTD feed
_GARAGE_BASE = {"PS1": 380, "PS3": 540, "PS4": 610}


def _unit(key: str) -> float:
    """Stable pseudo-random float in [0, 1) for a key."""
    return int(hashlib.sha256(key.encode()).hexdigest()[:8], 16) / 2**32


def demo_occupancy(spot_id: str, now: float | None = None) -> tuple[bool, float]:
    tick = int((now if now is not None else time.time()) // TICK_SECONDS)
    occupied = _unit(spot_id) < OCCUPIED_SHARE
    if _unit(f"{spot_id}:{tick}") < DRIFT_SHARE:
        occupied = not occupied
    confidence = round(0.78 + 0.2 * _unit(f"{spot_id}:conf"), 2)
    return occupied, confidence


def demo_garages(now: float | None = None) -> dict[str, int]:
    tick = int((now if now is not None else time.time()) // TICK_SECONDS)
    return {
        garage: max(0, base + int((_unit(f"{garage}:{tick}") - 0.5) * 60))
        for garage, base in _GARAGE_BASE.items()
    }
