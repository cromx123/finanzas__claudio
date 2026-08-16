from __future__ import annotations

import uuid

from pydantic import BaseModel


class ScreenerAssetOut(BaseModel):
    id: uuid.UUID
    yahoo_symbol: str
    name: str
    sector: str | None
    type: str
    currency: str
    country: str
    price: float | None
    change_today_pct: float | None
    yield_pct: float | None
    cagr_div_3y: float | None
    cagr_div_5y: float | None
    pe_ratio: float | None
    payout_ratio: float | None
    roe: float | None
    roa: float | None
    roic: float | None
    net_margin: float | None
    expense_ratio: float | None
    aum_or_cap: float | None
    beta: float | None
    return_1y: float | None
    return_3y: float | None
    return_5y: float | None
    dividend_frequency: str | None


class DividendHistoryPoint(BaseModel):
    year: str
    amount_per_share: float
    is_latest: bool


class AssetDetailOut(BaseModel):
    asset: ScreenerAssetOut
    sparkline: list[float]
    dividend_history: list[DividendHistoryPoint]
