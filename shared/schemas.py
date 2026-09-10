from typing import Any, Optional
from pydantic import BaseModel


class AnalyzeRequest(BaseModel):
    geometry: dict
    provider: Optional[str] = None
    spot_cell_size_m: float = 4.0


class Spot(BaseModel):
    id: str
    polygon: dict
    occupied: bool
    confidence: float = 0.0


class AnalyzeResponse(BaseModel):
    capture_time: str
    image_id: str
    spots: list[Spot]
    feature_collection: dict
