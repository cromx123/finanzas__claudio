from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.schemas.portfolios import AssetOut


class AlertIn(BaseModel):
    yahoo_symbol: str = Field(min_length=1, max_length=32)
    condition: str = Field(pattern="^(price_below|price_above)$")
    threshold: float = Field(gt=0)


class AlertOut(BaseModel):
    id: uuid.UUID
    asset: AssetOut
    condition: str
    threshold: float
    active: bool
    triggered_at: date | None
    created_at: datetime
    current_price: float | None

    model_config = {"from_attributes": True}
