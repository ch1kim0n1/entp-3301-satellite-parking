"""Official UTD garage-availability feed with an explicit local fallback."""

import json
import re
from datetime import datetime, timezone
from html import unescape
from html.parser import HTMLParser
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
LIVE_GARAGE_URL = "https://services.utdallas.edu/transit/garages/_code.php/"
SNAPSHOT_PATH = ROOT / "UTD-resources" / "garage_availability.json"


class _GaragePageParser(HTMLParser):
    """Parse the small public HTML table without adding another dependency."""

    def __init__(self):
        super().__init__()
        self.garages: dict[str, list[dict]] = {}
        self.current_garage: str | None = None
        self.current_row: list[str] | None = None
        self.current_cell: list[str] | None = None
        self.last_checked: dict[str, str] = {}

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "table" and attributes.get("id", "").lower() in {"ps1", "ps3", "ps4"}:
            self.current_garage = attributes["id"].upper()
            self.garages.setdefault(self.current_garage, [])
        elif self.current_garage and tag == "tr":
            self.current_row = []
        elif self.current_garage and tag == "td":
            self.current_cell = []

    def handle_data(self, data):
        if self.current_cell is not None:
            self.current_cell.append(data)
        elif self.current_garage and "Last Checked" in data:
            self.last_checked[self.current_garage] = data.strip()

    def handle_endtag(self, tag):
        if tag == "td" and self.current_cell is not None and self.current_row is not None:
            self.current_row.append("".join(self.current_cell).strip())
            self.current_cell = None
        elif tag == "tr" and self.current_garage and self.current_row:
            if len(self.current_row) >= 3:
                try:
                    self.garages[self.current_garage].append(
                        {
                            "level": int(self.current_row[0]),
                            "option": self.current_row[1],
                            "available_spaces": int(self.current_row[2].replace(",", "")),
                        }
                    )
                except ValueError:
                    pass
            self.current_row = None
        elif tag == "table":
            self.current_garage = None
            self.current_row = None
            self.current_cell = None


def _payload(garages: dict[str, list[dict]], *, source: str, last_checked: dict[str, str] | None = None):
    return {
        "source": source,
        "is_live": source == "live_utd_feed",
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "garages": [
            {
                "id": garage_id,
                "available_spaces": sum(level["available_spaces"] for level in levels),
                "last_checked": (last_checked or {}).get(garage_id),
                "levels": levels,
            }
            for garage_id, levels in sorted(garages.items())
        ],
    }


def _load_snapshot():
    with SNAPSHOT_PATH.open(encoding="utf-8") as file:
        snapshot = json.load(file)
    return _payload(
        snapshot["garages"],
        source="saved_utd_snapshot",
        last_checked={
            garage: checked
            for garage, checked in zip(snapshot["garages"], snapshot.get("last_checked_times", []))
        },
    )


def get_garage_availability():
    """Return live public data when available, otherwise the labeled snapshot."""
    try:
        response = requests.get(LIVE_GARAGE_URL, timeout=5)
        response.raise_for_status()
        parser = _GaragePageParser()
        parser.feed(response.text)
        if parser.garages:
            return _payload(parser.garages, source="live_utd_feed", last_checked=parser.last_checked)
    except requests.RequestException:
        pass
    return _load_snapshot()
