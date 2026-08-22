from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.cache import cache_get_json, cache_set_json
from app.models.market import DividendEvent, Fundamentals, Price
from app.models.portfolio import Asset, AssetType
from app.modules.assets.service import ingest_full_asset
from app.modules.ingestion.markets import resolve_suffix
from app.modules.ingestion.providers.base import Provider
from app.modules.screener.analytics import day_change_pct, dividend_cagr, dividend_increase_streak_years, trailing_return
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


def _prices_by_asset(db: Session, asset_ids: list[uuid.UUID]) -> dict[uuid.UUID, list]:
    """One query for every asset's price history instead of one query per
    asset — the list_screener N+1 that made a 760-asset universe take 11s.

    Selects individual columns (a lightweight Core `Row`, still exposing
    `.date`/`.close` by name for analytics.py) instead of full `Price` ORM
    entities: with ~940k rows across a real screener universe, hydrating
    each into a tracked ORM object is itself the dominant cost (~6.5s vs
    ~2.4s measured for the same query as bare rows) — a second, independent
    bottleneck from the N+1 itself.

    Ordered by (asset_id, date), so each asset's slice is already ascending
    by date, same as the old per-asset `order_by(Price.date)` query.
    """
    if not asset_ids:
        return {}
    rows = db.execute(
        select(Price.asset_id, Price.date, Price.close)
        .where(Price.asset_id.in_(asset_ids))
        .order_by(Price.asset_id, Price.date)
    )
    by_asset: dict[uuid.UUID, list] = {}
    for r in rows:
        by_asset.setdefault(r.asset_id, []).append(r)
    return by_asset


def _dividend_events_by_asset(db: Session, asset_ids: list[uuid.UUID]) -> dict[uuid.UUID, list]:
    if not asset_ids:
        return {}
    rows = db.execute(
        select(DividendEvent.asset_id, DividendEvent.ex_date, DividendEvent.amount_per_share, DividendEvent.frequency).where(
            DividendEvent.asset_id.in_(asset_ids)
        )
    )
    by_asset: dict[uuid.UUID, list] = {}
    for r in rows:
        by_asset.setdefault(r.asset_id, []).append(r)
    return by_asset


def _to_out(
    asset: Asset, fundamentals: Fundamentals | None, prices: list[Price], events: list[DividendEvent]
) -> ScreenerAssetOut:
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
        dividend_streak_years=dividend_increase_streak_years(events),
    )


_SORT_COLUMNS = {
    "yield_pct": Fundamentals.dividend_yield,
    "cagr_div_5y": Fundamentals.div_cagr_5y,
    "pe_ratio": Fundamentals.pe_ratio,
    "roe": Fundamentals.roe,
}


def list_screener(
    db: Session,
    q: str = "",
    tipo: str = "*",
    yield_min: float = 0,
    pe_max: float = 0,
    roe_min: float = 0,
    sort_key: str = "yield_pct",
    sort_dir: int = -1,
    offset: int = 0,
    limit: int = 10_000,
) -> tuple[list[ScreenerAssetOut], int]:
    """Filters, sorts, and paginates entirely in SQL against Asset/
    Fundamentals columns *before* touching Price/DividendEvent — the 4
    current sort/filter fields (yield_pct, cagr_div_5y, pe_ratio, roe) are
    all plain Fundamentals columns, so the expensive per-asset analytics in
    _to_out (which needs the batched Price/DividendEvent fetch) only ever
    runs for the assets in the requested page, not the whole universe. The
    default limit is generous enough that callers who don't paginate (the
    screener-wide autocomplete lookup) still get everything back.
    """
    # A ticker re-ingested on a later date (re-run seed, "add ticker" hitting
    # an existing symbol) gets a new Fundamentals row per as_of instead of
    # overwriting — joining Fundamentals directly would return one row per
    # snapshot and duplicate that asset in the list. Keep only the latest.
    latest_as_of = (
        select(Fundamentals.asset_id, func.max(Fundamentals.as_of).label("as_of"))
        .group_by(Fundamentals.asset_id)
        .subquery()
    )
    base = (
        select(Asset, Fundamentals)
        .join(latest_as_of, latest_as_of.c.asset_id == Asset.id)
        .join(
            Fundamentals,
            (Fundamentals.asset_id == latest_as_of.c.asset_id) & (Fundamentals.as_of == latest_as_of.c.as_of),
        )
    )

    if tipo != "*":
        base = base.where(Asset.type == AssetType(tipo))
    if q.strip():
        needle = f"%{q.strip()}%"
        base = base.where(or_(Asset.yahoo_symbol.ilike(needle), Asset.name.ilike(needle)))
    if yield_min > 0:
        base = base.where(Fundamentals.dividend_yield >= yield_min)
    if pe_max > 0:
        base = base.where(Fundamentals.pe_ratio <= pe_max)
    if roe_min > 0:
        base = base.where(Fundamentals.roe >= roe_min)

    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0

    sort_col = _SORT_COLUMNS.get(sort_key, Fundamentals.dividend_yield)
    order = sort_col.desc() if sort_dir < 0 else sort_col.asc()
    # Nulls always last regardless of direction, matching the previous
    # client-side sortScreener behavior — `sort_col.is_(None)` is 0 for
    # non-null / 1 for null, so ordering by it first keeps non-nulls ahead.
    page_rows = db.execute(
        base.order_by(sort_col.is_(None), order, Asset.yahoo_symbol).offset(offset).limit(limit)
    ).all()

    asset_ids = [asset.id for asset, _ in page_rows]
    prices_by_asset = _prices_by_asset(db, asset_ids)
    events_by_asset = _dividend_events_by_asset(db, asset_ids)
    rows = [
        _to_out(asset, fundamentals, prices_by_asset.get(asset.id, []), events_by_asset.get(asset.id, []))
        for asset, fundamentals in page_rows
    ]
    return rows, total


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
    prices = list(db.scalars(select(Price).where(Price.asset_id == asset.id).order_by(Price.date)))
    events = list(db.scalars(select(DividendEvent).where(DividendEvent.asset_id == asset.id)))
    return _to_out(asset, fundamentals, prices, events)


def get_asset_detail(db: Session, yahoo_symbol: str) -> AssetDetailOut:
    asset = db.scalar(select(Asset).where(Asset.yahoo_symbol == yahoo_symbol.upper()))
    if asset is None:
        raise AssetNotFoundError(yahoo_symbol)
    fundamentals = db.scalar(
        select(Fundamentals).where(Fundamentals.asset_id == asset.id).order_by(Fundamentals.as_of.desc())
    )
    all_prices = list(db.scalars(select(Price).where(Price.asset_id == asset.id).order_by(Price.date)))
    events = list(db.scalars(select(DividendEvent).where(DividendEvent.asset_id == asset.id)))
    out = _to_out(asset, fundamentals, all_prices, events)

    # Reuses the same fetch above instead of a second Price query for the
    # sparkline window.
    prices = [p for p in all_prices if p.date >= _three_years_ago()]
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

    # Only the live-fallback path is cached — a past close never changes, and
    # even "today" is fine to reuse for the rest of the day for this
    # reference-price use case (not a real-time trading feature).
    cache_key = f"price-on-date:{symbol}:{on.isoformat()}"
    cached = cache_get_json(cache_key)
    if cached is not None:
        return PriceOnDateOut(**cached)

    quote = provider.get_price_on(symbol, on)
    if quote is None:
        raise PriceNotFoundError(symbol)
    result = PriceOnDateOut(date=quote.date, price=quote.close)
    cache_set_json(cache_key, {"date": result.date.isoformat(), "price": result.price}, ttl_seconds=86_400)
    return result


def _three_years_ago():
    from datetime import timedelta

    return date.today() - timedelta(days=3 * 365)


def _stride(n: int) -> int:
    return max(1, n // 60)
