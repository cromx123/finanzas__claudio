from __future__ import annotations

import logging

import yfinance as yf
from tenacity import retry, stop_after_attempt, wait_exponential

from app.modules.ingestion.providers.base import Provider, QuoteResult, SearchResult

logger = logging.getLogger(__name__)

_retry = retry(
    reraise=True,
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=8),
)


class YahooProvider(Provider):
    @_retry
    def get_quote(self, symbol: str) -> QuoteResult | None:
        history = yf.Ticker(symbol).history(period="5d")
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
        history = yf.Ticker(symbol).history(period=period)
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
        return [
            {"ex_date": idx.date(), "amount_per_share": float(value)}
            for idx, value in dividends.items()
        ]

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
