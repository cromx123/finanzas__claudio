from __future__ import annotations

from datetime import date

from pydantic import BaseModel


class NetWorthPointOut(BaseModel):
    date: date
    value: float


class NetWorthHistoryOut(BaseModel):
    currency: str
    start_date: date
    points: list[NetWorthPointOut]
