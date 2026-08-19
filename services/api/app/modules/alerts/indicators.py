from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Protocol

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.market import Price

# Enough daily bars for the largest period any built-in indicator uses
# (Bollinger defaults to 20), plus buffer for weekends/holidays/gaps.
_HISTORY_WINDOW = 120


def price_series(db: Session, asset_id: uuid.UUID) -> pd.Series:
    """Chronological daily closes for an asset — the shared input every
    indicator evaluates against, so a new indicator never needs its own
    price-fetching code.
    """
    rows = db.execute(
        select(Price.date, Price.close)
        .where(Price.asset_id == asset_id)
        .order_by(Price.date.desc())
        .limit(_HISTORY_WINDOW)
    ).all()
    ordered = sorted(rows, key=lambda r: r.date)
    return pd.Series([float(r.close) for r in ordered], index=[r.date for r in ordered])


def compute_rsi(closes: pd.Series, period: int = 14) -> float | None:
    """Wilder's RSI, as of the last close. None until there's enough history."""
    if len(closes) < period + 1:
        return None
    delta = closes.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / period, min_periods=period, adjust=False).mean()
    last_gain, last_loss = avg_gain.iloc[-1], avg_loss.iloc[-1]
    if pd.isna(last_gain) or pd.isna(last_loss):
        return None
    if last_loss == 0:
        return 100.0
    rs = last_gain / last_loss
    return float(100 - (100 / (1 + rs)))


def compute_bollinger(closes: pd.Series, period: int = 20, stddev: float = 2.0) -> tuple[float, float, float] | None:
    """(lower, mid, upper) band as of the last close. None until there's
    enough history for a full window."""
    if len(closes) < period:
        return None
    window = closes.tail(period)
    mid = float(window.mean())
    std = float(window.std(ddof=0))
    return mid - stddev * std, mid, mid + stddev * std


@dataclass
class IndicatorResult:
    current_value: float | None
    triggered: bool


class Indicator(Protocol):
    def evaluate(self, closes: pd.Series, threshold: float | None, params: dict) -> IndicatorResult: ...


class PriceIndicator:
    """Plain last-close vs. threshold — the original (and simplest) alert
    condition, now just one entry in the registry instead of the only one."""

    def __init__(self, direction: str) -> None:
        self.direction = direction  # "below" | "above"

    def evaluate(self, closes: pd.Series, threshold: float | None, params: dict) -> IndicatorResult:
        if closes.empty or threshold is None:
            return IndicatorResult(None, False)
        price = float(closes.iloc[-1])
        triggered = price <= threshold if self.direction == "below" else price >= threshold
        return IndicatorResult(price, triggered)


class RsiIndicator:
    def __init__(self, direction: str) -> None:
        self.direction = direction  # "below" | "above"

    def evaluate(self, closes: pd.Series, threshold: float | None, params: dict) -> IndicatorResult:
        rsi = compute_rsi(closes, int(params.get("period", 14)))
        if rsi is None or threshold is None:
            return IndicatorResult(rsi, False)
        triggered = rsi <= threshold if self.direction == "below" else rsi >= threshold
        return IndicatorResult(rsi, triggered)


class BollingerIndicator:
    def __init__(self, edge: str) -> None:
        self.edge = edge  # "lower" | "upper"

    def evaluate(self, closes: pd.Series, threshold: float | None, params: dict) -> IndicatorResult:
        bands = compute_bollinger(closes, int(params.get("period", 20)), float(params.get("stddev", 2.0)))
        if bands is None or closes.empty:
            return IndicatorResult(None, False)
        lower, _mid, upper = bands
        price = float(closes.iloc[-1])
        if self.edge == "lower":
            return IndicatorResult(price, price <= lower)
        return IndicatorResult(price, price >= upper)


# The whole point of this registry: a new indicator is a new class plus one
# (or two, for a below/above pair) entries here — check_alerts, create_alert,
# and _to_out never need to change to support it.
INDICATORS: dict[str, Indicator] = {
    "price_below": PriceIndicator("below"),
    "price_above": PriceIndicator("above"),
    "rsi_below": RsiIndicator("below"),
    "rsi_above": RsiIndicator("above"),
    "bollinger_lower_cross": BollingerIndicator("lower"),
    "bollinger_upper_cross": BollingerIndicator("upper"),
}
