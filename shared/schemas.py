from typing import Any, Optional
from pydantic import BaseModel


class AnalyzeRequest(BaseModel):
    geometry: dict
    provider: Optional[str] = None
    spot_cell_size_m: float = 4.0


class Spot(BaseModel):
    id: str
    polygon: dict
    occupied: Optional[bool] = None
    confidence: float = 0.0


class AnalyzeResponse(BaseModel):
    capture_time: Optional[str] = None
    analyzed_at: str
    image_id: str
    imagery_source: str
    imagery_is_current: bool = False
    spots: list[Spot]
    feature_collection: dict
    detected_vehicles: int = 0
