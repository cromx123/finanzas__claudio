"""One-off ingestion for the Screener/Comparador/Dividendos curated ticker
universe: creates the Asset rows, then pulls fundamentals, 5y price history,
and dividend history from Yahoo Finance.

The universe is CORE_TICKERS (hand-picked dividend stocks/ETFs plus a few
European names not covered by any index below) plus the live constituents of
IPSA, the S&P 500, and the Nikkei 225 — fetched from Wikipedia at run time
instead of hardcoded, since index membership drifts and a frozen list would
silently go stale. That's ~750 tickers total; each one costs several Yahoo
Finance calls, so a full run easily takes 30-90+ minutes and Yahoo's informal
rate limits mean some tickers will fail on any given run — failures are
logged and skipped rather than aborting the rest (see main()).

Run once (or whenever you want to refresh) with the venv active:

    python -m scripts.seed_market_data
"""

from __future__ import annotations

import io
import logging
import re
import sys
import time

import pandas as pd
import requests

from app.core.db import SessionLocal
from app.modules.assets.service import ingest_full_asset
from app.modules.ingestion.providers.yahoo import YahooProvider

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("seed_market_data")

CORE_TICKERS = [
    "JNJ", "KO", "PG", "PEP", "ABBV", "O", "MSFT", "AAPL", "V", "TXN",
    "SCHD", "VYM", "DGRO", "VOO", "JEPI",
    "CHILE.SN", "BSANTANDER.SN", "COPEC.SN", "CMPC.SN", "ENELCHILE.SN", "SQM-B.SN", "CENCOSUD.SN", "PARAUCO.SN",
    "IBE.MC", "SAN.MC", "ITX.MC",
]

# Wikipedia asks scrapers to identify themselves; a default python-requests
# user agent gets 403'd on some of its endpoints.
_WIKI_HEADERS = {"User-Agent": "finanzas-claudio-seed-script/1.0 (one-off local script, not a bot service)"}

_SP500_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
_IPSA_URL = "https://en.wikipedia.org/wiki/%C3%8Dndice_de_Precio_Selectivo_de_Acciones"
_NIKKEI_RAW_URL = "https://en.wikipedia.org/w/index.php?title=Nikkei_225&action=raw"

# Nikkei 225's Wikipedia page has no wikitable — constituents are bullet
# points per sector using the {{tyo2|CODE}} (or older {{tyo|CODE}}) template,
# e.g. "*[[Toyota|Toyota Motor]] Corp. ({{tyo2|7203}})".
_NIKKEI_CODE_RE = re.compile(r"\{\{tyo2?\|([0-9A-Za-z]+)\}\}")


def _fetch_wiki_tables(url: str) -> list[pd.DataFrame]:
    resp = requests.get(url, headers=_WIKI_HEADERS, timeout=30)
    resp.raise_for_status()
    return pd.read_html(io.StringIO(resp.text))


def _table_with_column(tables: list[pd.DataFrame], column: str) -> pd.DataFrame:
    for table in tables:
        if column in table.columns:
            return table
    raise ValueError(f"no table with a {column!r} column found")


def fetch_sp500_tickers() -> list[str]:
    """S&P 500 constituents. Wikipedia lists share-class tickers with a dot
    (e.g. "BRK.B") — Yahoo Finance expects a dash ("BRK-B")."""
    table = _table_with_column(_fetch_wiki_tables(_SP500_URL), "Symbol")
    return [str(symbol).strip().upper().replace(".", "-") for symbol in table["Symbol"]]


def fetch_ipsa_tickers() -> list[str]:
    """IPSA (Chile) constituents — Wikipedia lists bare tickers, no ".SN"."""
    table = _table_with_column(_fetch_wiki_tables(_IPSA_URL), "Symbol")
    return [f"{str(symbol).strip().upper()}.SN" for symbol in table["Symbol"]]


def fetch_nikkei225_tickers() -> list[str]:
    """Nikkei 225 (Japan) constituents, scraped from the raw wikitext (see
    _NIKKEI_CODE_RE) since there's no structured table to read_html here."""
    resp = requests.get(_NIKKEI_RAW_URL, headers=_WIKI_HEADERS, timeout=30)
    resp.raise_for_status()
    codes = _NIKKEI_CODE_RE.findall(resp.text)
    return [f"{code.upper()}.T" for code in codes]


def build_ticker_universe() -> list[str]:
    """CORE_TICKERS plus every index's constituents, deduplicated (order
    preserved). An index whose fetch fails is logged and skipped rather than
    aborting the whole run — the failure is visible, but CORE_TICKERS and any
    index that did resolve still get seeded.
    """
    tickers = list(CORE_TICKERS)
    for label, fetch in (("S&P 500", fetch_sp500_tickers), ("IPSA", fetch_ipsa_tickers), ("Nikkei 225", fetch_nikkei225_tickers)):
        try:
            fetched = fetch()
        except Exception:
            logger.exception("could not fetch %s constituents from Wikipedia — skipping that index", label)
            continue
        logger.info("fetched %d tickers for %s", len(fetched), label)
        tickers.extend(fetched)

    seen: set[str] = set()
    universe: list[str] = []
    for ticker in tickers:
        if ticker not in seen:
            seen.add(ticker)
            universe.append(ticker)
    return universe


def main() -> int:
    tickers = build_ticker_universe()
    logger.info("seeding %d tickers total", len(tickers))

    provider = YahooProvider()
    db = SessionLocal()
    failures: list[str] = []
    try:
        for i, symbol in enumerate(tickers, start=1):
            logger.info("seeding %s", symbol)
            try:
                ingest_full_asset(db, provider, symbol)
            except Exception:
                db.rollback()
                logger.exception("failed to seed %s", symbol)
                failures.append(symbol)
            if i % 25 == 0:
                logger.info("progress: %d/%d (%d failures so far)", i, len(tickers), len(failures))
            time.sleep(0.5)
    finally:
        db.close()

    if failures:
        logger.warning("finished with %d failures out of %d: %s", len(failures), len(tickers), ", ".join(failures))
        return 1
    logger.info("done — seeded %d tickers", len(tickers))
    return 0


if __name__ == "__main__":
    sys.exit(main())
