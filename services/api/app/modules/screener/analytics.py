from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta

from app.models.market import DividendEvent, Price


def trailing_return(prices: list[Price], days: int) -> float | None:
    """`prices` must be sorted ascending by date. Percent change from the
    closest close at-or-before `days` ago to the latest close.
    """
    if len(prices) < 2:
        return None
    latest = prices[-1]
    target = latest.date - timedelta(days=days)
    baseline = None
    for p in prices:
        if p.date <= target:
            baseline = p
        else:
            break
    if baseline is None or float(baseline.close) <= 0:
        return None
    return (float(latest.close) / float(baseline.close) - 1) * 100


def annualized_return(prices: list[Price], years: float) -> float | None:
    total = trailing_return(prices, int(years * 365))
    if total is None:
        return None
    return ((1 + total / 100) ** (1 / years) - 1) * 100


def day_change_pct(prices: list[Price]) -> float | None:
    if len(prices) < 2:
        return None
    prev, last = prices[-2], prices[-1]
    if float(prev.close) <= 0:
        return None
    return (float(last.close) / float(prev.close) - 1) * 100


def dividend_cagr(events: list[DividendEvent], years: int) -> float | None:
    by_year: dict[int, float] = defaultdict(float)
    for e in events:
        by_year[e.ex_date.year] += float(e.amount_per_share)
    by_year.pop(date.today().year, None)
    yrs = sorted(by_year)
    if len(yrs) < 2:
        return None
    last_year = yrs[-1]
    span = min(last_year - yrs[0], years)
    start_year = last_year - span
    if span < 1 or start_year not in by_year or by_year[start_year] <= 0:
        return None
    return ((by_year[last_year] / by_year[start_year]) ** (1 / span) - 1) * 100
