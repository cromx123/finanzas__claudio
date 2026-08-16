from __future__ import annotations

from pydantic import BaseModel


class ComparadorAssetOut(BaseModel):
    yahoo_symbol: str
    name: str
    price: float | None
    rentabilidad_promedio_anual: float | None
    yield_inicial: float | None
    cagr_div_3y: float | None
    cagr_div_5y: float | None
    expense_ratio: float | None
    aum_or_cap: float | None
    return_3y: float | None
    return_5y: float | None
