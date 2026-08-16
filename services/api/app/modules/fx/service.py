from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.market import FxRate

DEFAULT_RATES: dict[str, float] = {"USD": 970.0, "EUR": 1050.0}


def get_rates(db: Session) -> dict[str, float]:
    """CLP value of 1 unit of each non-CLP currency we support. Falls back
    to a seed default when nobody has set a rate for today yet.
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


def convert(amount: float, from_ccy: str, to_ccy: str, rates: dict[str, float]) -> float:
    if from_ccy == to_ccy:
        return amount
    clp = amount * rates[from_ccy]
    return clp / rates[to_ccy]


def set_rate(db: Session, currency: str, rate_to_clp: float) -> dict[str, float]:
    today = date.today()
    row = db.get(FxRate, {"base": currency, "quote": "CLP", "date": today})
    if row is None:
        row = FxRate(base=currency, quote="CLP", date=today, source="manual")
        db.add(row)
    row.rate = rate_to_clp
    row.source = "manual"
    db.commit()
    return get_rates(db)
