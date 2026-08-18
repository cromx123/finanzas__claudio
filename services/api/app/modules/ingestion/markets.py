from __future__ import annotations

import re
from dataclasses import dataclass

_US_TICKER_RE = re.compile(r"^[A-Z][A-Z0-9\-]{0,9}$")


@dataclass(frozen=True)
class MarketInfo:
    exchange_mic: str
    currency: str
    timezone: str
    close_time: str  # "HH:MM" local exchange time


_SUFFIX_MAP: dict[str, MarketInfo] = {
    ".SN": MarketInfo(
        exchange_mic="XSGO", currency="CLP", timezone="America/Santiago", close_time="17:00"
    ),
    ".MC": MarketInfo(
        exchange_mic="XMAD", currency="EUR", timezone="Europe/Madrid", close_time="17:30"
    ),
    ".T": MarketInfo(
        exchange_mic="XTKS", currency="JPY", timezone="Asia/Tokyo", close_time="15:30"
    ),
}

_US_MARKET = MarketInfo(
    exchange_mic="XNYS", currency="USD", timezone="America/New_York", close_time="16:00"
)


def resolve_suffix(yahoo_symbol: str) -> MarketInfo:
    """Resolves a Yahoo ticker to its exchange/currency/timezone/close time.

    Raises ValueError for anything that doesn't match a known suffix or the
    plain-ticker US pattern, so callers can validate a symbol before it's
    inserted as an asset (README business rule #1).
    """
    symbol = yahoo_symbol.strip().upper()
    if not symbol:
        raise ValueError("empty ticker")

    if symbol.startswith("^"):
        return _US_MARKET  # indices/benchmarks (e.g. ^GSPC) quote on US market hours

    if "." in symbol:
        suffix = symbol[symbol.rindex(".") :]
        try:
            return _SUFFIX_MAP[suffix]
        except KeyError as exc:
            raise ValueError(f"unrecognized ticker suffix: {suffix!r}") from exc

    if not _US_TICKER_RE.match(symbol):
        raise ValueError(f"unrecognized ticker format: {symbol!r}")
    return _US_MARKET
