from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.market import Price
from app.models.portfolio import Asset, AssetType
from app.modules.ingestion.markets import MarketInfo, resolve_suffix
from app.modules.ingestion.providers.base import Provider

logger = logging.getLogger(__name__)

_MIC_TO_COUNTRY: dict[str, str] = {"XSGO": "CL", "XMAD": "ES", "XNYS": "US"}


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
