from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class QuoteResult:
    symbol: str
    date: date
    close: float
    volume: int | None = None


@dataclass(frozen=True)
class SearchResult:
    symbol: str
    name: str
    exchange: str | None = None


class Provider(ABC):
    """Adapter interface for a market data source.

    Yahoo Finance is the primary implementation; this interface reserves the
    slot for a secondary Chilean provider per the README's business rules.
    """

    @abstractmethod
    def get_quote(self, symbol: str) -> QuoteResult | None: ...

    @abstractmethod
    def get_history(self, symbol: str, period: str = "3y") -> list[QuoteResult]: ...

    @abstractmethod
    def get_fundamentals(self, symbol: str) -> dict: ...

    @abstractmethod
    def get_dividends(self, symbol: str) -> list[dict]: ...

    @abstractmethod
    def search(self, query: str) -> list[SearchResult]: ...

    @abstractmethod
    def get_price_on(self, symbol: str, on: date) -> QuoteResult | None: ...
