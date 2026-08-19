from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.schemas.portfolios import AssetOut


class AlertIn(BaseModel):
    yahoo_symbol: str = Field(min_length=1, max_length=32)
    # Validated against the live indicators.INDICATORS registry in the
    # service layer, not a fixed regex here — a hardcoded pattern is exactly
    # what would need a code change (this file) every time a new indicator
    # is added, defeating the point of the registry.
    condition: str = Field(min_length=1, max_length=40)
    threshold: float | None = Field(default=None, gt=0)
    params: dict = Field(default_factory=dict)


class AlertOut(BaseModel):
    id: uuid.UUID
    asset: AssetOut
    condition: str
    threshold: float | None
    params: dict
    active: bool
    triggered_at: date | None
    created_at: datetime
    current_price: float | None
    current_value: float | None

    model_config = {"from_attributes": True}
