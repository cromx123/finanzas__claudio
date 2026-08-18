from __future__ import annotations

from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.market import DividendEvent, Fundamentals, Price
from app.models.portfolio import Asset
from app.modules.assets.service import ingest_full_asset
from app.modules.ingestion.markets import resolve_suffix
from app.modules.ingestion.providers.base import Provider
from app.modules.screener.analytics import day_change_pct, dividend_cagr, trailing_return
from app.schemas.screener import (
    AssetDetailOut,
    AssetSearchResultOut,
    DividendHistoryPoint,
    PriceOnDateOut,
    ScreenerAssetOut,
)

_MAX_SEARCH_RESULTS = 8


class AssetNotFoundError(Exception):
    pass


class PriceNotFoundError(Exception):
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
    # A ticker re-ingested on a later date (re-run seed, "add ticker" hitting
    # an existing symbol) gets a new Fundamentals row per as_of instead of
    # overwriting — joining Fundamentals directly would return one row per
    # snapshot and duplicate that asset in the list. Keep only the latest.
    latest_as_of = (
        select(Fundamentals.asset_id, func.max(Fundamentals.as_of).label("as_of"))
        .group_by(Fundamentals.asset_id)
        .subquery()
    )
    rows = db.execute(
        select(Asset, Fundamentals)
        .join(latest_as_of, latest_as_of.c.asset_id == Asset.id)
        .join(
            Fundamentals,
            (Fundamentals.asset_id == latest_as_of.c.asset_id) & (Fundamentals.as_of == latest_as_of.c.as_of),
        )
        .order_by(Asset.yahoo_symbol)
    ).all()
    return [_to_out(db, asset, fundamentals) for asset, fundamentals in rows]


def add_asset_to_screener(db: Session, provider: Provider, yahoo_symbol: str) -> ScreenerAssetOut:
    """Manually adds a ticker to the Screener — ingests fundamentals, 5y
    price history, and dividends from the provider (same path the offline
    seed script uses), so it shows up immediately without waiting for the
    next batch seed. Also works to force-refresh a ticker that's already in
    the screener, since ingest_full_asset re-fetches everything.
    """
    asset = ingest_full_asset(db, provider, yahoo_symbol)
    fundamentals = db.scalar(
        select(Fundamentals).where(Fundamentals.asset_id == asset.id).order_by(Fundamentals.as_of.desc())
    )
    return _to_out(db, asset, fundamentals)


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


def search_assets(provider: Provider, query: str) -> list[AssetSearchResultOut]:
    """Ticker/name lookup for the "Agregar transacción" autocomplete —
    restricted to symbols the app can actually trade (a recognized suffix or
    the plain US-ticker pattern, per README business rule #1), so it never
    suggests a ticker the transaction form would then reject.

    Only prefix matches survive (ticker or name *starting with* the query),
    not mere substring matches — Yahoo's own search is a fuzzy full-text
    match, which would otherwise surface e.g. "ENELCHILE.SN" for query "CH".
    """
    q = query.strip().upper()
    if not q:
        return []

    out: list[AssetSearchResultOut] = []
    seen: set[str] = set()
    for result in provider.search(q):
        symbol = result.symbol.strip().upper()
        name = result.name or symbol
        if not symbol or symbol in seen:
            continue
        if not (symbol.startswith(q) or name.upper().startswith(q)):
            continue
        try:
            resolve_suffix(symbol)
        except ValueError:
            continue
        seen.add(symbol)
        out.append(AssetSearchResultOut(symbol=symbol, name=name, exchange=result.exchange))
        if len(out) >= _MAX_SEARCH_RESULTS:
            break
    return out


def get_price_on_date(db: Session, provider: Provider, yahoo_symbol: str, on: date) -> PriceOnDateOut:
    """Reference close price for the "Agregar transacción" date/price
    fields — checks locally ingested Price history first (fast, no
    network), falling back to a live Yahoo lookup for tickers not yet in
    the screener or dates outside what's been ingested locally. The
    returned date is the nearest trading day at or before `on` (weekends/
    holidays have no close), which may differ from the requested date.
    """
    symbol = yahoo_symbol.strip().upper()
    try:
        resolve_suffix(symbol)
    except ValueError as exc:
        raise PriceNotFoundError(symbol) from exc

    asset = db.scalar(select(Asset).where(Asset.yahoo_symbol == symbol))
    if asset is not None:
        row = db.scalar(
            select(Price)
            .where(Price.asset_id == asset.id, Price.date <= on)
            .order_by(Price.date.desc())
            .limit(1)
        )
        if row is not None:
            return PriceOnDateOut(date=row.date, price=float(row.close))

    quote = provider.get_price_on(symbol, on)
    if quote is None:
        raise PriceNotFoundError(symbol)
    return PriceOnDateOut(date=quote.date, price=quote.close)


def _three_years_ago():
    from datetime import timedelta

    return date.today() - timedelta(days=3 * 365)


def _stride(n: int) -> int:
    return max(1, n // 60)
