from __future__ import annotations

import uuid
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.market import DividendEvent, DividendFrequency
from app.models.portfolio import Asset, Portfolio
from app.models.user import User
from app.modules.portfolios.service import dividend_payments, run_ledger, withholding_for_country
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


def _event_row(lot, event: DividendEvent, withholding: float, estado: str) -> DividendCalendarEvent:
    total_bruto = lot.quantity * float(event.amount_per_share)
    return DividendCalendarEvent(
        yahoo_symbol=lot.asset.yahoo_symbol,
        name=lot.asset.name,
        ex_date=event.ex_date,
        amount_per_share=float(event.amount_per_share),
        quantity=lot.quantity,
        total_bruto=total_bruto,
        total_neto=total_bruto * (1 - withholding),
        estado=estado,
    )


def _paid_rows(db: Session, user: User, portfolio_id: uuid.UUID, year: int | None = None) -> list[DividendCalendarEvent]:
    """Real dividend payments (dividend_payments — real share count held on
    each ex-dividend date, not today's holding) turned into
    DividendCalendarEvent rows with status "Pagado". Shared by get_calendar
    (this year's paid events) and list_paid_dividends (every year, for the
    movements feed) so the two never disagree on what was actually paid.
    """
    withholding_by_asset: dict[uuid.UUID, tuple[Asset, float]] = {}
    rows: list[DividendCalendarEvent] = []
    for payment in dividend_payments(db, portfolio_id):
        if year is not None and payment.event.ex_date.year != year:
            continue
        cached = withholding_by_asset.get(payment.asset_id)
        if cached is None:
            asset = db.get(Asset, payment.asset_id)
            cached = (asset, withholding_for_country(db, user, asset.country))
            withholding_by_asset[payment.asset_id] = cached
        asset, rate = cached
        total_bruto = payment.quantity * float(payment.event.amount_per_share)
        rows.append(
            DividendCalendarEvent(
                yahoo_symbol=asset.yahoo_symbol,
                name=asset.name,
                ex_date=payment.event.ex_date,
                amount_per_share=float(payment.event.amount_per_share),
                quantity=payment.quantity,
                total_bruto=total_bruto,
                total_neto=total_bruto * (1 - rate),
                estado="Pagado",
            )
        )
    return rows


def get_calendar(db: Session, user: User, portfolio: Portfolio, year: int) -> DividendCalendarOut:
    """Pagado events use the real share count held on each ex-dividend date
    (see _paid_rows) — not today's holding — so a dividend already paid
    before you bought more shares isn't inflated by the shares you added
    afterward. Estimado events (still in the future, real or projected from
    frequency) use today's holding, since that's the best guess for how
    many shares you'll still hold by then.
    """
    ledger = run_ledger(db, portfolio.id)
    year_end = date(year, 12, 31)
    today = date.today()

    events: list[DividendCalendarEvent] = _paid_rows(db, user, portfolio.id, year)

    for asset_id, lot in ledger.holdings.items():
        all_events = list(
            db.scalars(select(DividendEvent).where(DividendEvent.asset_id == asset_id).order_by(DividendEvent.ex_date))
        )
        future_this_year = [e for e in all_events if e.ex_date.year == year and e.ex_date > today]
        if all_events:
            future_this_year += _project_future_events(all_events[-1], year_end)

        withholding = withholding_for_country(db, user, lot.asset.country)
        for e in sorted(future_this_year, key=lambda x: x.ex_date):
            events.append(_event_row(lot, e, withholding, "Estimado"))

    events.sort(key=lambda e: e.ex_date)
    return DividendCalendarOut(portfolio_id=str(portfolio.id), currency=portfolio.currency, year=year, events=events)


def list_paid_dividends(db: Session, user: User, portfolio: Portfolio) -> list[DividendCalendarEvent]:
    """Every dividend event actually paid to this portfolio, across all
    years — the "abonos" feed for the movements ledger."""
    events = _paid_rows(db, user, portfolio.id)
    events.sort(key=lambda e: e.ex_date)
    return events
