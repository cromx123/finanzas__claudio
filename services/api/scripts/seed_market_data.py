"""One-off ingestion for the Screener/Comparador/Dividendos curated ticker
universe: creates the Asset rows, then pulls fundamentals, 5y price history,
and dividend history from Yahoo Finance.

Run once (or whenever you want to refresh) with the venv active:

    python -m scripts.seed_market_data
"""

from __future__ import annotations

import logging
import sys
import time
from collections import defaultdict
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import SessionLocal
from app.models.market import DividendEvent, DividendFrequency, DividendStatus, Fundamentals, Price
from app.models.portfolio import Asset
from app.modules.assets.service import get_or_create_asset
from app.modules.ingestion.providers.yahoo import YahooProvider

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("seed_market_data")

TICKERS = [
    "JNJ", "KO", "PG", "PEP", "ABBV", "O", "MSFT", "AAPL", "V", "TXN",
    "SCHD", "VYM", "DGRO", "VOO", "JEPI",
    "CHILE.SN", "BSANTANDER.SN", "COPEC.SN", "CMPC.SN", "ENELCHILE.SN", "SQM-B.SN", "CENCOSUD.SN", "PARAUCO.SN",
    "IBE.MC", "SAN.MC", "ITX.MC",
]


def _pct(value: float | None) -> float | None:
    """yfinance returns most ratios as fractions (0.234) — this app stores
    percentages (23.4), matching the frontend's Intl percent formatting.
    """
    if value is None:
        return None
    return float(value) * 100


def _num(value) -> float | None:
    return float(value) if value is not None else None


def _map_fundamentals(info: dict, price: float | None) -> dict:
    div_rate = info.get("trailingAnnualDividendRate")
    div_yield_pct = (div_rate / price * 100) if (div_rate and price) else _pct(info.get("dividendYield"))
    # Some yfinance versions already return dividendYield as a percent (e.g. 2.9
    # instead of 0.029) — if our fraction-based guess landed absurdly high,
    # prefer the raw field taken at face value instead of re-scaling it.
    if div_yield_pct is not None and div_yield_pct > 50:
        raw = info.get("dividendYield")
        div_yield_pct = float(raw) if raw is not None else None

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


def seed_one(db: Session, provider: YahooProvider, symbol: str) -> None:
    logger.info("seeding %s", symbol)
    asset = get_or_create_asset(db, provider, symbol)

    history = provider.get_history(symbol, period="5y")
    # yfinance a veces repite una fecha dentro del mismo período (tickers poco
    # líquidos, ajustes de huso horario). Nos quedamos con la última entrada
    # de cada fecha para no intentar insertar dos veces la misma PK
    # (asset_id, date) antes del commit — con autoflush=False, db.get() no
    # ve las filas todavía pendientes en la sesión.
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
    fundamentals.div_cagr_5y = _dividend_cagr_5y(provider.get_dividends(symbol))

    dividends = provider.get_dividends(symbol)
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


def main() -> int:
    provider = YahooProvider()
    db = SessionLocal()
    failures: list[str] = []
    try:
        for symbol in TICKERS:
            try:
                seed_one(db, provider, symbol)
            except Exception:
                db.rollback()
                logger.exception("failed to seed %s", symbol)
                failures.append(symbol)
            time.sleep(0.5)
    finally:
        db.close()

    if failures:
        logger.warning("finished with failures: %s", ", ".join(failures))
        return 1
    logger.info("done — seeded %d tickers", len(TICKERS))
    return 0


if __name__ == "__main__":
    sys.exit(main())
