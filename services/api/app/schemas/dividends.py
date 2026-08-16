from __future__ import annotations

from datetime import date

from pydantic import BaseModel


class DividendCalendarEvent(BaseModel):
    yahoo_symbol: str
    name: str
    ex_date: date
    amount_per_share: float
    quantity: float
    total_bruto: float
    total_neto: float
    estado: str  # "Pagado" | "Estimado"


class DividendCalendarOut(BaseModel):
    portfolio_id: str
    currency: str
    year: int
    events: list[DividendCalendarEvent]
