from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.market import Price
from app.models.portfolio import Asset
from app.modules.ingestion.providers.base import Provider, QuoteResult


@dataclass(frozen=True)
class PriceDecision:
    close: float
    volume: int | None
    is_stale: bool


def decide_price(fetched: QuoteResult | None, last_known: Price | None) -> PriceDecision:
    """Applies the .SN stability rule (README business rule #2): if the
    provider has no fresh close for today — a common gap on illiquid .SN
    tickers — reuse the last known close and flag it `is_stale` instead of
    leaving a hole in the series.
    """
    if fetched is not None:
        return PriceDecision(close=fetched.close, volume=fetched.volume, is_stale=False)
    if last_known is not None:
        return PriceDecision(close=float(last_known.close), volume=None, is_stale=True)
    raise ValueError("no fetched price and no prior close to fall back to")


def ingest_daily_price(db: Session, provider: Provider, asset: Asset, as_of: date) -> Price:
    fetched = provider.get_quote(asset.yahoo_symbol)
    last_known = db.scalar(
        select(Price).where(Price.asset_id == asset.id).order_by(Price.date.desc()).limit(1)
    )
    decision = decide_price(fetched, last_known)

    row = db.get(Price, {"asset_id": asset.id, "date": as_of})
    if row is None:
        row = Price(asset_id=asset.id, date=as_of)
        db.add(row)
    row.close = decision.close
    row.volume = decision.volume
    row.is_stale = decision.is_stale
    db.commit()
    db.refresh(row)
    return row
