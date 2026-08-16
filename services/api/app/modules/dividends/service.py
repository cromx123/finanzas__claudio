from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.market import DividendEvent, DividendFrequency
from app.models.portfolio import Portfolio
from app.models.user import User
from app.modules.portfolios.service import run_ledger, withholding_for_country
from app.schemas.dividends import DividendCalendarEvent, DividendCalendarOut

_FREQUENCY_DAYS = {
    DividendFrequency.MONTHLY: 30,
    DividendFrequency.QUARTERLY: 91,
    DividendFrequency.ANNUAL: 365,
}


def _project_future_events(last_event: DividendEvent, through: date) -> list[DividendEvent]:
    step = timedelta(days=_FREQUENCY_DAYS.get(last_event.frequency, 91))
    projected = []
    next_date = last_event.ex_date + step
    while next_date <= through and len(projected) < 6:
        projected.append(
            DividendEvent(
                asset_id=last_event.asset_id,
                ex_date=next_date,
                amount_per_share=last_event.amount_per_share,
                currency=last_event.currency,
                status=last_event.status,
                frequency=last_event.frequency,
            )
        )
        next_date += step
    return projected


def get_calendar(db: Session, user: User, portfolio: Portfolio, year: int) -> DividendCalendarOut:
    ledger = run_ledger(db, portfolio.id)
    year_end = date(year, 12, 31)
    today = date.today()

    events: list[DividendCalendarEvent] = []
    for asset_id, lot in ledger.holdings.items():
        all_events = list(
            db.scalars(select(DividendEvent).where(DividendEvent.asset_id == asset_id).order_by(DividendEvent.ex_date))
        )
        this_year = [e for e in all_events if e.ex_date.year == year]
        if all_events:
            this_year += _project_future_events(all_events[-1], year_end)

        withholding = withholding_for_country(db, user, lot.asset.country)
        for e in sorted(this_year, key=lambda x: x.ex_date):
            total_bruto = lot.quantity * float(e.amount_per_share)
            events.append(
                DividendCalendarEvent(
                    yahoo_symbol=lot.asset.yahoo_symbol,
                    name=lot.asset.name,
                    ex_date=e.ex_date,
                    amount_per_share=float(e.amount_per_share),
                    quantity=lot.quantity,
                    total_bruto=total_bruto,
                    total_neto=total_bruto * (1 - withholding),
                    estado="Pagado" if e.ex_date <= today else "Estimado",
                )
            )

    events.sort(key=lambda e: e.ex_date)
    return DividendCalendarOut(portfolio_id=str(portfolio.id), currency=portfolio.currency, year=year, events=events)
