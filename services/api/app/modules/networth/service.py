from __future__ import annotations

from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.portfolio import Transaction
from app.models.user import User
from app.modules.fx import service as fx_service
from app.modules.portfolios import service as portfolios_service
from app.schemas.networth import NetWorthHistoryOut, NetWorthPointOut


def compute_history(db: Session, user: User, display_currency: str, range_key: str) -> NetWorthHistoryOut:
    """Combined net worth across every one of the user's portfolios, over
    time, each portfolio's native-currency value converted through the FX
    rate *of that sample date* — not today's rate applied retroactively,
    which would silently distort how the past looked (the gap this closes).
    """
    today = date.today()
    portfolios = portfolios_service.list_portfolios(db, user)
    if not portfolios:
        return NetWorthHistoryOut(currency=display_currency, start_date=today, points=[])

    earliest = db.scalar(
        select(func.min(Transaction.trade_date)).where(Transaction.portfolio_id.in_([p.id for p in portfolios]))
    )
    if earliest is None:
        return NetWorthHistoryOut(currency=display_currency, start_date=today, points=[])

    start, sample_dates = portfolios_service.sample_dates_for_range(range_key, earliest, today)

    # CLP-value of 1 unit of the display currency on each sample date —
    # fetched once regardless of how many portfolios share that currency.
    display_rates = fx_service.get_rates_on_dates(db, display_currency, sample_dates)

    totals: dict[date, float] = {d: 0.0 for d in sample_dates}
    for portfolio in portfolios:
        native_values = portfolios_service.portfolio_values_at_dates(db, portfolio.id, sample_dates)
        portfolio_rates = fx_service.get_rates_on_dates(db, portfolio.currency, sample_dates)
        for d in sample_dates:
            clp_value = native_values[d] * portfolio_rates[d]
            totals[d] += clp_value / display_rates[d]

    points = [NetWorthPointOut(date=d, value=totals[d]) for d in sample_dates]
    return NetWorthHistoryOut(currency=display_currency, start_date=start, points=points)
