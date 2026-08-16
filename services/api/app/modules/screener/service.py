from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.market import DividendEvent, Fundamentals, Price
from app.models.portfolio import Asset
from app.modules.screener.analytics import day_change_pct, dividend_cagr, trailing_return
from app.schemas.screener import AssetDetailOut, DividendHistoryPoint, ScreenerAssetOut


class AssetNotFoundError(Exception):
    pass


def _to_out(db: Session, asset: Asset, fundamentals: Fundamentals | None) -> ScreenerAssetOut:
    prices = list(db.scalars(select(Price).where(Price.asset_id == asset.id).order_by(Price.date)))
    events = list(db.scalars(select(DividendEvent).where(DividendEvent.asset_id == asset.id)))
    latest_freq = max(events, key=lambda e: e.ex_date).frequency.value if events else None

    aum_or_cap = None
    if fundamentals is not None:
        aum_or_cap = float(fundamentals.aum) if fundamentals.aum is not None else (
            float(fundamentals.market_cap) if fundamentals.market_cap is not None else None
        )

    return ScreenerAssetOut(
        id=asset.id,
        yahoo_symbol=asset.yahoo_symbol,
        name=asset.name,
        sector=asset.sector,
        type=asset.type.value,
        currency=asset.currency,
        country=asset.country,
        price=float(prices[-1].close) if prices else None,
        change_today_pct=day_change_pct(prices),
        yield_pct=float(fundamentals.dividend_yield) if fundamentals and fundamentals.dividend_yield is not None else None,
        cagr_div_3y=dividend_cagr(events, 3),
        cagr_div_5y=float(fundamentals.div_cagr_5y) if fundamentals and fundamentals.div_cagr_5y is not None else None,
        pe_ratio=float(fundamentals.pe_ratio) if fundamentals and fundamentals.pe_ratio is not None else None,
        payout_ratio=float(fundamentals.payout_ratio) if fundamentals and fundamentals.payout_ratio is not None else None,
        roe=float(fundamentals.roe) if fundamentals and fundamentals.roe is not None else None,
        roa=float(fundamentals.roa) if fundamentals and fundamentals.roa is not None else None,
        roic=float(fundamentals.roic) if fundamentals and fundamentals.roic is not None else None,
        net_margin=float(fundamentals.net_margin) if fundamentals and fundamentals.net_margin is not None else None,
        expense_ratio=float(fundamentals.expense_ratio) if fundamentals and fundamentals.expense_ratio is not None else None,
        aum_or_cap=aum_or_cap,
        beta=None,
        return_1y=trailing_return(prices, 365),
        return_3y=trailing_return(prices, 3 * 365),
        return_5y=trailing_return(prices, 5 * 365),
        dividend_frequency=latest_freq,
    )


def list_screener(db: Session) -> list[ScreenerAssetOut]:
    rows = db.execute(
        select(Asset, Fundamentals)
        .join(Fundamentals, Fundamentals.asset_id == Asset.id)
        .order_by(Asset.yahoo_symbol)
    ).all()
    return [_to_out(db, asset, fundamentals) for asset, fundamentals in rows]


def get_asset_detail(db: Session, yahoo_symbol: str) -> AssetDetailOut:
    asset = db.scalar(select(Asset).where(Asset.yahoo_symbol == yahoo_symbol.upper()))
    if asset is None:
        raise AssetNotFoundError(yahoo_symbol)
    fundamentals = db.scalar(
        select(Fundamentals).where(Fundamentals.asset_id == asset.id).order_by(Fundamentals.as_of.desc())
    )
    out = _to_out(db, asset, fundamentals)

    prices = list(
        db.scalars(
            select(Price).where(Price.asset_id == asset.id, Price.date >= _three_years_ago()).order_by(Price.date)
        )
    )
    sparkline = [float(p.close) for p in prices][::_stride(len(prices))]

    events = list(db.scalars(select(DividendEvent).where(DividendEvent.asset_id == asset.id)))
    by_year: dict[str, float] = {}
    for e in events:
        key = str(e.ex_date.year)
        by_year[key] = by_year.get(key, 0.0) + float(e.amount_per_share)
    years = sorted(by_year)[-8:]
    dividend_history = [
        DividendHistoryPoint(year=y, amount_per_share=by_year[y], is_latest=(i == len(years) - 1))
        for i, y in enumerate(years)
    ]

    return AssetDetailOut(asset=out, sparkline=sparkline, dividend_history=dividend_history)


def _three_years_ago():
    from datetime import date, timedelta

    return date.today() - timedelta(days=3 * 365)


def _stride(n: int) -> int:
    return max(1, n // 60)
