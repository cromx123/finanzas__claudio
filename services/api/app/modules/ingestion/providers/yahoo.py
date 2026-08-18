from __future__ import annotations

import logging
from datetime import date, timedelta

import yfinance as yf
from tenacity import retry, stop_after_attempt, wait_exponential

from app.modules.ingestion.providers.base import Provider, QuoteResult, SearchResult

logger = logging.getLogger(__name__)

_retry = retry(
    reraise=True,
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=8),
)


def _drop_nan_closes(history):
    """Yahoo sometimes reports the still-forming current trading day with a
    NaN close (the candle hasn't settled yet) — drop it rather than let a
    NaN reach a NOT NULL `close` column or a QuoteResult that looks valid
    but isn't a real, usable price."""
    if history.empty:
        return history
    return history[history["Close"].notna()]


class YahooProvider(Provider):
    @_retry
    def get_quote(self, symbol: str) -> QuoteResult | None:
        history = yf.Ticker(symbol).history(period="5d")
        history = _drop_nan_closes(history)
        if history.empty:
            return None
        last = history.iloc[-1]
        return QuoteResult(
            symbol=symbol,
            date=history.index[-1].date(),
            close=float(last["Close"]),
            volume=int(last["Volume"]) if "Volume" in last else None,
        )

    @_retry
    def get_history(self, symbol: str, period: str = "3y") -> list[QuoteResult]:
        history = _drop_nan_closes(yf.Ticker(symbol).history(period=period))
        return [
            QuoteResult(
                symbol=symbol,
                date=idx.date(),
                close=float(row["Close"]),
                volume=int(row["Volume"]) if "Volume" in row else None,
            )
            for idx, row in history.iterrows()
        ]

    @_retry
    def get_fundamentals(self, symbol: str) -> dict:
        return dict(yf.Ticker(symbol).info or {})

    @_retry
    def get_dividends(self, symbol: str) -> list[dict]:
        dividends = yf.Ticker(symbol).dividends
        # yfinance returns None (not an empty Series) for some invalid/
        # delisted symbols instead of raising.
        if dividends is None:
            return []
        return [
            {"ex_date": idx.date(), "amount_per_share": float(value)}
            for idx, value in dividends.items()
        ]

    @_retry
    def get_price_on(self, symbol: str, on: date) -> QuoteResult | None:
        """Closest close at or before `on` — a 10-day lookback window covers
        any run of weekends/holidays around the requested date."""
        history = yf.Ticker(symbol).history(start=on - timedelta(days=10), end=on + timedelta(days=1))
        history = _drop_nan_closes(history)
        if history.empty:
            return None
        last = history.iloc[-1]
        return QuoteResult(
            symbol=symbol,
            date=history.index[-1].date(),
            close=float(last["Close"]),
            volume=int(last["Volume"]) if "Volume" in last else None,
        )

    def search(self, query: str) -> list[SearchResult]:
        searcher = getattr(yf, "Search", None)
        if searcher is None:
            return []
        results = getattr(searcher(query), "quotes", [])
        return [
            SearchResult(
                symbol=item.get("symbol", ""),
                name=item.get("shortname") or item.get("longname") or "",
                exchange=item.get("exchange"),
            )
            for item in results
        ]
