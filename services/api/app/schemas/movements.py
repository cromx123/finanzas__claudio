from __future__ import annotations

import uuid
from datetime import date

from pydantic import BaseModel


class MovementOut(BaseModel):
    date: date
    kind: str  # "buy" | "sell" | "dividend"
    portfolio_id: uuid.UUID
    portfolio_name: str
    yahoo_symbol: str
    asset_name: str
    quantity: float
    price: float
    total: float
    currency: str
