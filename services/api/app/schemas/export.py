from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel


class ExportTransactionOut(BaseModel):
    id: uuid.UUID
    yahoo_symbol: str
    type: str
    trade_date: date
    quantity: float | None
    price: float | None
    gross_amount: float
    currency: str


class ExportPortfolioOut(BaseModel):
    id: uuid.UUID
    name: str
    currency: str
    transactions: list[ExportTransactionOut]


class ExportGoalOut(BaseModel):
    id: uuid.UUID
    kind: str
    name: str | None
    target_amount: float
    currency: str
    monthly_expenses: float | None
    target_date: date | None


class ExportAlertOut(BaseModel):
    id: uuid.UUID
    yahoo_symbol: str
    condition: str
    threshold: float | None
    params: dict
    active: bool
    triggered_at: date | None


class ExportTagOut(BaseModel):
    label: str
    target_weight: float | None


class ExportHoldingTagOut(BaseModel):
    portfolio_id: uuid.UUID
    yahoo_symbol: str
    tag: str


class UserDataExportOut(BaseModel):
    exported_at: datetime
    portfolios: list[ExportPortfolioOut]
    goals: list[ExportGoalOut]
    alerts: list[ExportAlertOut]
    tags: list[ExportTagOut]
    holding_tags: list[ExportHoldingTagOut]
