from __future__ import annotations

import logging
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.market import FxRate
from app.modules.ingestion.providers.base import Provider

logger = logging.getLogger(__name__)

DEFAULT_RATES: dict[str, float] = {"USD": 970.0, "EUR": 1050.0}

# Ticker de Yahoo Finance para el valor de 1 unidad de la moneda en CLP.
# CLP=X es USD/CLP (convención de Yahoo: "XXX=X" = 1 USD en XXX).
# EURCLP=X es directamente EUR/CLP, no hay que encadenar por USD.
_YAHOO_SYMBOLS: dict[str, str] = {"USD": "CLP=X", "EUR": "EURCLP=X"}


def get_rates(db: Session) -> dict[str, float]:
    """CLP value of 1 unit of each non-CLP currency we support. Falls back
    to the seed default when nobody has fetched a rate yet.
    """
    rates: dict[str, float] = {"CLP": 1.0}
    for ccy, default in DEFAULT_RATES.items():
        row = db.scalar(
            select(FxRate)
            .where(FxRate.base == ccy, FxRate.quote == "CLP")
            .order_by(FxRate.date.desc())
            .limit(1)
        )
        rates[ccy] = float(row.rate) if row is not None else default
    return rates


def refresh_rates_from_yahoo(db: Session, provider: Provider) -> dict[str, float]:
    """Fetches the latest available USD/CLP and EUR/CLP quote from Yahoo
    Finance and stores it, so `get_rates` reflects live values. Called on
    every read (see fx/router.py) so each time someone opens the app they
    get the freshest quote Yahoo has.

    If a symbol fails to fetch (network hiccup, Yahoo rate limit, etc.) we
    log it and keep whatever was already stored — never wipe a good value
    with nothing, and `get_rates`'s own DEFAULT_RATES fallback covers the
    very first run before anything has ever been fetched.
    """
    today = date.today()
    for ccy, symbol in _YAHOO_SYMBOLS.items():
        try:
            quote = provider.get_quote(symbol)
        except Exception:
            logger.exception("failed to fetch FX rate for %s (%s)", ccy, symbol)
            continue
        if quote is None or quote.close <= 0:
            logger.warning("no FX quote returned for %s (%s)", ccy, symbol)
            continue
        row = db.get(FxRate, {"base": ccy, "quote": "CLP", "date": quote.date})
        if row is None:
            row = FxRate(base=ccy, quote="CLP", date=quote.date, source="yahoo")
            db.add(row)
        row.rate = quote.close
        row.source = "yahoo"
    db.commit()
    return get_rates(db)


def convert(amount: float, from_ccy: str, to_ccy: str, rates: dict[str, float]) -> float:
    if from_ccy == to_ccy:
        return amount
    clp = amount * rates[from_ccy]
    return clp / rates[to_ccy]
