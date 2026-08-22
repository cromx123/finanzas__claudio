from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.strategy import Goal, GoalKind
from app.models.user import User
from app.modules.fx import service as fx_service
from app.modules.networth import service as networth_service
from app.modules.portfolios import service as portfolios_service
from app.schemas.goals import (
    CustomGoalIn,
    CustomGoalOut,
    FiStep,
    GoalIn,
    GoalsProgressOut,
    HoldingContribution,
    PortfolioContribution,
)

_FI_HITOS_USD = [25_000.0, 50_000.0, 100_000.0, 250_000.0]


class GoalNotFoundError(Exception):
    pass


def list_goals(db: Session, user: User) -> list[Goal]:
    return list(db.scalars(select(Goal).where(Goal.user_id == user.id)))


def upsert_goals(db: Session, user: User, payload: list[GoalIn]) -> list[Goal]:
    """Singleton-per-kind save for monthly_dividends/cost_coverage — the
    fixed Objetivos cards. Custom net_worth goals (see create_custom_goal)
    are many-per-user and intentionally not touched by this path, even if a
    net_worth item were ever included in payload: existing() below only
    keys by kind, so custom goals live outside its reach entirely.
    """
    existing = {g.kind.value: g for g in list_goals(db, user) if g.kind != GoalKind.NET_WORTH}
    for item in payload:
        goal = existing.get(item.kind)
        if goal is None:
            goal = Goal(user_id=user.id, kind=GoalKind(item.kind))
            db.add(goal)
        goal.target_amount = item.target_amount
        goal.currency = item.currency.upper()
        goal.monthly_expenses = item.monthly_expenses
        goal.target_date = item.target_date
    db.commit()
    return list_goals(db, user)


def _get_owned_custom_goal(db: Session, user: User, goal_id: uuid.UUID) -> Goal:
    goal = db.get(Goal, goal_id)
    if goal is None or goal.user_id != user.id or goal.kind != GoalKind.NET_WORTH:
        raise GoalNotFoundError(str(goal_id))
    return goal


def create_custom_goal(db: Session, user: User, payload: CustomGoalIn) -> Goal:
    goal = Goal(
        user_id=user.id,
        kind=GoalKind.NET_WORTH,
        name=payload.name,
        target_amount=payload.target_amount,
        currency=payload.currency.upper(),
        target_date=payload.target_date,
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


def update_custom_goal(db: Session, user: User, goal_id: uuid.UUID, payload: CustomGoalIn) -> Goal:
    goal = _get_owned_custom_goal(db, user, goal_id)
    goal.name = payload.name
    goal.target_amount = payload.target_amount
    goal.currency = payload.currency.upper()
    goal.target_date = payload.target_date
    db.commit()
    db.refresh(goal)
    return goal


def delete_custom_goal(db: Session, user: User, goal_id: uuid.UUID) -> None:
    goal = _get_owned_custom_goal(db, user, goal_id)
    db.delete(goal)
    db.commit()


def _pace_projection(
    current_amount: float, target: float, created_at: datetime, target_date: date | None
) -> tuple[date | None, bool | None]:
    """Projects a completion date from the rate of progress seen since the
    goal was created (assuming it started at 0 — there's no earlier
    snapshot to know otherwise), and compares it against target_date if
    one was set. Returns (projected_date, on_track); either can be None
    when there isn't enough data to say anything (goal created today,
    zero/negative progress, no target amount).
    """
    if target <= 0:
        return None, None
    if current_amount >= target:
        return None, True
    days_elapsed = (date.today() - created_at.date()).days
    if days_elapsed <= 0:
        return None, None
    rate_per_day = current_amount / days_elapsed
    if rate_per_day <= 0:
        return None, (False if target_date else None)
    days_needed = (target - current_amount) / rate_per_day
    projected_date = date.today() + timedelta(days=round(days_needed))
    on_track = (projected_date <= target_date) if target_date else None
    return projected_date, on_track


def _fi_projected_date(rate_per_day: float, current: float, target: float) -> date | None:
    """Projects when a not-yet-reached FI milestone is hit at `rate_per_day`
    — None if already reached (caller doesn't need a date then) or if the
    rate isn't positive (flat/declining patrimonio can't be projected
    forward meaningfully).
    """
    if current >= target or rate_per_day <= 0:
        return None
    days_needed = (target - current) / rate_per_day
    return date.today() + timedelta(days=round(days_needed))


def _patrimonio_growth_rate_per_day(db: Session, user: User, display_currency: str) -> float:
    """Real observed growth rate of combined patrimonio since the user's
    first transaction (reuses networth.compute_history's own point-sampling
    — same series as the "Patrimonio en el tiempo" chart in Perfil) rather
    than assuming a starting point of 0, which would be wrong for anyone
    who already had net worth before their first tracked purchase.
    """
    history = networth_service.compute_history(db, user, display_currency, "5A")
    if len(history.points) < 2:
        return 0.0
    first, last = history.points[0], history.points[-1]
    days = (last.date - first.date).days
    if days <= 0:
        return 0.0
    return (last.value - first.value) / days


def compute_progress(db: Session, user: User, display_currency: str) -> GoalsProgressOut:
    rates = fx_service.get_rates(db)
    portfolios = portfolios_service.list_portfolios(db, user)

    contributions: list[PortfolioContribution] = []
    patrimonio_total = 0.0
    dividendo_mensual_total = 0.0
    dividendo_anual_total = 0.0

    for p in portfolios:
        summary = portfolios_service.compute_summary(db, user, p)
        valor_convertido = fx_service.convert(summary.valor_total, p.currency, display_currency, rates)
        div_mensual_convertido = fx_service.convert(summary.dividendo_anual_bruto / 12, p.currency, display_currency, rates)
        patrimonio_total += valor_convertido
        dividendo_mensual_total += div_mensual_convertido
        dividendo_anual_total += fx_service.convert(summary.dividendo_anual_bruto, p.currency, display_currency, rates)
        contributions.append(
            PortfolioContribution(
                id=p.id,
                name=p.name,
                currency=p.currency,
                valor_nativo=summary.valor_total,
                valor_convertido=valor_convertido,
                dividendo_mensual_convertido=div_mensual_convertido,
                holdings=[
                    HoldingContribution(yahoo_symbol=h.asset.yahoo_symbol, valor_nativo=h.market_value)
                    for h in summary.holdings
                ],
            )
        )

    goals = list_goals(db, user)
    cost_goal = next((g for g in goals if g.kind == GoalKind.COST_COVERAGE), None)
    monthly_expenses = (
        fx_service.convert(float(cost_goal.monthly_expenses), cost_goal.currency, display_currency, rates)
        if cost_goal and cost_goal.monthly_expenses
        else 1500.0
    )
    numero_fi = monthly_expenses * 12 / 0.04

    hitos_base = [fx_service.convert(h, "USD", display_currency, rates) for h in _FI_HITOS_USD]
    fi_rate_per_day = _patrimonio_growth_rate_per_day(db, user, display_currency)
    hitos_fi = [
        FiStep(
            monto=h,
            logrado=patrimonio_total >= h,
            projected_date=_fi_projected_date(fi_rate_per_day, patrimonio_total, h),
        )
        for h in hitos_base
    ]

    # Envelope allocation: goals claim from the shared patrimonio pool in
    # priority order (oldest first) up to their own target, so two goals no
    # longer both show 100% of the same money — money "spoken for" by an
    # earlier goal isn't double-counted by a later one.
    custom_goal_rows = sorted(
        (g for g in goals if g.kind == GoalKind.NET_WORTH and g.name), key=lambda g: g.created_at
    )
    remaining_pool = patrimonio_total
    custom_goals: list[CustomGoalOut] = []
    for g in custom_goal_rows:
        target = float(g.target_amount)
        target_in_display = fx_service.convert(target, g.currency, display_currency, rates)
        allocated_in_display = max(0.0, min(remaining_pool, target_in_display))
        remaining_pool -= allocated_in_display
        current_amount = fx_service.convert(allocated_in_display, display_currency, g.currency, rates)
        projected_date, on_track = _pace_projection(current_amount, target, g.created_at, g.target_date)
        custom_goals.append(
            CustomGoalOut(
                id=g.id,
                name=g.name,
                target_amount=target,
                currency=g.currency,
                target_date=g.target_date,
                current_amount=current_amount,
                pct=min((current_amount / target) * 100, 100) if target else 0.0,
                projected_date=projected_date,
                on_track=on_track,
            )
        )

    return GoalsProgressOut(
        currency=display_currency,
        patrimonio_total=patrimonio_total,
        dividendo_mensual=dividendo_mensual_total,
        dividendo_anual_bruto=dividendo_anual_total,
        portfolios=contributions,
        goals=goals,
        hitos_fi=hitos_fi,
        numero_fi=numero_fi,
        numero_fi_projected_date=_fi_projected_date(fi_rate_per_day, patrimonio_total, numero_fi),
        custom_goals=custom_goals,
    )
