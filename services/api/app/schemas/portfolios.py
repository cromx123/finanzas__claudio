from __future__ import annotations

import uuid
from datetime import date

from pydantic import BaseModel, Field


class PortfolioIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    currency: str = Field(min_length=3, max_length=3)


class PortfolioOut(PortfolioIn):
    id: uuid.UUID

    model_config = {"from_attributes": True}


class AssetOut(BaseModel):
    id: uuid.UUID
    yahoo_symbol: str
    name: str
    sector: str | None
    type: str
    currency: str
    country: str

    model_config = {"from_attributes": True}


class TransactionIn(BaseModel):
    yahoo_symbol: str = Field(min_length=1, max_length=32)
    type: str = Field(pattern="^(buy|sell)$")
    trade_date: date
    quantity: float = Field(gt=0)
    price: float = Field(gt=0)


class TransactionOut(BaseModel):
    id: uuid.UUID
    portfolio_id: uuid.UUID
    asset: AssetOut
    type: str
    trade_date: date
    quantity: float
    price: float
    gross_amount: float
    currency: str

    model_config = {"from_attributes": True}


class HoldingOut(BaseModel):
    asset: AssetOut
    tags: list[str]
    quantity: float
    avg_cost: float
    price: float
    price_is_stale: bool
    market_value: float
    cost_basis: float
    unrealized_pl: float
    yield_on_cost: float
    dividend_per_share_ttm: float


class PortfolioSummaryOut(BaseModel):
    portfolio: PortfolioOut
    holdings: list[HoldingOut]
    valor_total: float
    costo_total: float
    aportes: float
    compras_totales: float
    gp_realizada: float
    gp_no_realizada: float
    dividendo_anual_bruto: float
    dividendo_anual_neto: float


class HoldingTagsIn(BaseModel):
    tags: list[str]
