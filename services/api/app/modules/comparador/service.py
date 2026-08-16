from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.market import DividendEvent, Fundamentals, Price
from app.models.portfolio import Asset
from app.modules.screener.analytics import annualized_return, dividend_cagr, trailing_return
from app.schemas.comparador import ComparadorAssetOut


def list_comparador_assets(db: Session) -> list[ComparadorAssetOut]:
    rows = db.execute(
        select(Asset, Fundamentals)
        .join(Fundamentals, Fundamentals.asset_id == Asset.id)
        .order_by(Asset.yahoo_symbol)
    ).all()

    out: list[ComparadorAssetOut] = []
    for asset, fundamentals in rows:
        prices = list(db.scalars(select(Price).where(Price.asset_id == asset.id).order_by(Price.date)))
        events = list(db.scalars(select(DividendEvent).where(DividendEvent.asset_id == asset.id)))
        aum_or_cap = fundamentals.aum if fundamentals.aum is not None else fundamentals.market_cap
        out.append(
            ComparadorAssetOut(
                yahoo_symbol=asset.yahoo_symbol,
                name=asset.name,
                price=float(prices[-1].close) if prices else None,
                rentabilidad_promedio_anual=annualized_return(prices, 5),
                yield_inicial=float(fundamentals.dividend_yield) if fundamentals.dividend_yield is not None else None,
                cagr_div_3y=dividend_cagr(events, 3),
                cagr_div_5y=float(fundamentals.div_cagr_5y) if fundamentals.div_cagr_5y is not None else None,
                expense_ratio=float(fundamentals.expense_ratio) if fundamentals.expense_ratio is not None else None,
                aum_or_cap=float(aum_or_cap) if aum_or_cap is not None else None,
                return_3y=trailing_return(prices, 3 * 365),
                return_5y=trailing_return(prices, 5 * 365),
            )
        )
    return out
