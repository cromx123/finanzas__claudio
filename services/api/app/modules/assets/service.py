from __future__ import annotations

import logging
import math
from collections import defaultdict
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.market import DividendEvent, DividendFrequency, DividendStatus, Fundamentals, Price
from app.models.portfolio import Asset, AssetType
from app.modules.ingestion.markets import MarketInfo, resolve_suffix
from app.modules.ingestion.providers.base import Provider

logger = logging.getLogger(__name__)

_MIC_TO_COUNTRY: dict[str, str] = {"XSGO": "CL", "XMAD": "ES", "XNYS": "US", "XTKS": "JP"}


def _guess_asset_type(info: dict) -> AssetType:
    quote_type = str(info.get("quoteType") or "").upper()
    if quote_type == "ETF":
        return AssetType.ETF
    haystack = f"{info.get('industry', '')} {info.get('sector', '')}".upper()
    if "REIT" in haystack:
        return AssetType.REIT
    return AssetType.STOCK


def get_or_create_asset(db: Session, provider: Provider, yahoo_symbol: str) -> Asset:
    """Finds an asset by its Yahoo ticker, or creates it — validating the
    suffix (README business rule #1) and pulling name/sector/type from
    Yahoo on first sight.
    """
    symbol = yahoo_symbol.strip().upper()
    existing = db.scalar(select(Asset).where(Asset.yahoo_symbol == symbol))
    if existing is not None:
        return existing

    market: MarketInfo = resolve_suffix(symbol)  # raises ValueError for unrecognized tickers
    info: dict = {}
    try:
        info = provider.get_fundamentals(symbol)
    except Exception:
        logger.warning("could not fetch fundamentals for new asset %s", symbol, exc_info=True)

    # A delisted/nonexistent symbol can still come back as a non-empty dict
    # (e.g. {"trailingPegRatio": None}) instead of {} — a real listing always
    # has a name, so that's the actual existence signal, not dict truthiness.
    if not info.get("longName") and not info.get("shortName"):
        raise ValueError(f"no market data found for ticker: {symbol!r}")

    asset = Asset(
        yahoo_symbol=symbol,
        exchange_mic=market.exchange_mic,
        name=str(info.get("longName") or info.get("shortName") or symbol),
        sector=info.get("sector"),
        type=_guess_asset_type(info),
        currency=market.currency,
        country=_MIC_TO_COUNTRY.get(market.exchange_mic, "US"),
    )
    db.add(asset)
    db.flush()
    return asset


def latest_price(db: Session, asset_id) -> Price | None:
    return db.scalar(select(Price).where(Price.asset_id == asset_id).order_by(Price.date.desc()).limit(1))


def refresh_quote(db: Session, provider: Provider, asset: Asset) -> Price | None:
    """Best-effort live quote fetch to seed a mark price for a freshly
    created asset. Failures are swallowed — the caller falls back to the
    transaction price when there's no Price row yet.
    """
    try:
        quote = provider.get_quote(asset.yahoo_symbol)
    except Exception:
        logger.warning("could not fetch quote for %s", asset.yahoo_symbol, exc_info=True)
        return None
    if quote is None:
        return None
    row = db.get(Price, {"asset_id": asset.id, "date": quote.date})
    if row is None:
        row = Price(asset_id=asset.id, date=quote.date)
        db.add(row)
    row.close = quote.close
    row.volume = quote.volume
    row.is_stale = False
    db.flush()
    return row


def _pct(value: float | None) -> float | None:
    """yfinance returns most ratios as fractions (0.234) — this app stores
    percentages (23.4), matching the frontend's Intl percent formatting.
    """
    v = _clean(value)
    return None if v is None else v * 100


def _clean(value) -> float | None:
    """yfinance surfaces some missing fields as float NaN rather than None
    (pandas' missing-value convention) instead of the plain None the rest of
    this mapper expects. NaN is truthy in Python, so `nan and price` silently
    passed and got stored — and Postgres numeric/float columns treat NaN as
    greater than every real value for both comparisons and ORDER BY, which
    broke the Screener's server-side filter/sort once it started comparing
    these columns directly. Every raw yfinance numeric read funnels through
    here so NaN is normalized to None before it ever reaches the DB.
    """
    if value is None:
        return None
    v = float(value)
    return None if math.isnan(v) else v


def _num(value) -> float | None:
    return _clean(value)


def _map_fundamentals(info: dict, price: float | None) -> dict:
    div_rate = _clean(info.get("trailingAnnualDividendRate"))
    div_yield_pct = (div_rate / price * 100) if (div_rate and price) else _pct(info.get("dividendYield"))
    # Some yfinance versions already return dividendYield as a percent (e.g. 2.9
    # instead of 0.029) — if our fraction-based guess landed absurdly high,
    # prefer the raw field taken at face value instead of re-scaling it.
    if div_yield_pct is not None and div_yield_pct > 50:
        div_yield_pct = _clean(info.get("dividendYield"))

    # Unlike the other ratio fields, yfinance already reports expense ratio
    # as a percentage number (0.06 meaning "0.06%"), not a fraction.
    expense_ratio = info.get("netExpenseRatio") or info.get("annualReportExpenseRatio")

    return {
        "roe": _pct(info.get("returnOnEquity")),
        "roa": _pct(info.get("returnOnAssets")),
        "roic": None,  # not available from yfinance's info payload
        "pe_ratio": _num(info.get("trailingPE")),
        "payout_ratio": _pct(info.get("payoutRatio")),
        "gross_margin": _pct(info.get("grossMargins")),
        "op_margin": _pct(info.get("operatingMargins")),
        "net_margin": _pct(info.get("profitMargins")),
        "dividend_yield": div_yield_pct,
        "expense_ratio": _num(expense_ratio),
        "aum": _num(info.get("totalAssets")),
        "market_cap": _num(info.get("marketCap")),
    }


def _dividend_frequency(dividends: list[dict]) -> DividendFrequency:
    recent_year = max((d["ex_date"].year for d in dividends), default=None)
    if recent_year is None:
        return DividendFrequency.ANNUAL
    count = sum(1 for d in dividends if d["ex_date"].year == recent_year)
    if count >= 10:
        return DividendFrequency.MONTHLY
    if count >= 3:
        return DividendFrequency.QUARTERLY
    return DividendFrequency.ANNUAL


def _dividend_cagr_5y(dividends: list[dict]) -> float | None:
    by_year: dict[int, float] = defaultdict(float)
    for d in dividends:
        by_year[d["ex_date"].year] += d["amount_per_share"]
    # Drop the current calendar year — it's still in progress, so comparing
    # its partial total against a full prior year understates growth.
    by_year.pop(date.today().year, None)
    years = sorted(by_year)
    if len(years) < 2:
        return None
    first_year, last_year = years[0], years[-1]
    span = last_year - first_year
    if span < 1 or by_year[first_year] <= 0:
        return None
    span = min(span, 5)
    start_year = last_year - span
    if start_year not in by_year or by_year[start_year] <= 0:
        return None
    cagr = (by_year[last_year] / by_year[start_year]) ** (1 / span) - 1
    return cagr * 100


def ingest_full_asset(db: Session, provider: Provider, yahoo_symbol: str) -> Asset:
    """Creates (or reuses) the asset, then pulls 5y price history,
    fundamentals, and dividend history from the provider. Shared by the
    offline seed script (scripts/seed_market_data.py) and the Screener's
    "add ticker manually" endpoint — both just want "make this ticker fully
    known to the app" and shouldn't duplicate this logic.
    """
    asset = get_or_create_asset(db, provider, yahoo_symbol)
    symbol = asset.yahoo_symbol

    history = provider.get_history(symbol, period="5y")
    # yfinance sometimes repeats a date within the same period (illiquid
    # tickers, timezone rounding) — keep the last entry per date so we don't
    # try to insert the same (asset_id, date) PK twice before the commit
    # (with autoflush=False, db.get() can't see rows still pending in the
    # session).
    deduped: dict = {point.date: point for point in history}
    history = sorted(deduped.values(), key=lambda p: p.date)
    for point in history:
        row = db.get(Price, {"asset_id": asset.id, "date": point.date})
        if row is None:
            row = Price(asset_id=asset.id, date=point.date)
            db.add(row)
        row.close = point.close
        row.volume = point.volume
        row.is_stale = False
    db.flush()
    last_price = float(history[-1].close) if history else None

    info = provider.get_fundamentals(symbol)
    mapped = _map_fundamentals(info, last_price)
    fundamentals = db.get(Fundamentals, {"asset_id": asset.id, "as_of": date.today()})
    if fundamentals is None:
        fundamentals = Fundamentals(asset_id=asset.id, as_of=date.today())
        db.add(fundamentals)
    for key, value in mapped.items():
        setattr(fundamentals, key, value)

    dividends = provider.get_dividends(symbol)
    fundamentals.div_cagr_5y = _dividend_cagr_5y(dividends)

    frequency = _dividend_frequency(dividends)
    existing_dates = set(
        db.scalars(select(DividendEvent.ex_date).where(DividendEvent.asset_id == asset.id))
    )
    for d in dividends:
        if d["ex_date"] in existing_dates:
            continue
        db.add(
            DividendEvent(
                asset_id=asset.id,
                ex_date=d["ex_date"],
                pay_date=None,
                amount_per_share=d["amount_per_share"],
                currency=asset.currency,
                status=DividendStatus.DECLARED,
                frequency=frequency,
            )
        )
    db.commit()
    db.refresh(asset)
    return asset
