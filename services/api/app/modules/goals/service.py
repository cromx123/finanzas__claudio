from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.strategy import Goal, GoalKind
from app.models.user import User
from app.modules.fx import service as fx_service
from app.modules.portfolios import service as portfolios_service
from app.schemas.goals import FiStep, GoalIn, GoalsProgressOut, HoldingContribution, PortfolioContribution

_FI_HITOS_USD = [25_000.0, 50_000.0, 100_000.0, 250_000.0]


def list_goals(db: Session, user: User) -> list[Goal]:
    return list(db.scalars(select(Goal).where(Goal.user_id == user.id)))


def upsert_goals(db: Session, user: User, payload: list[GoalIn]) -> list[Goal]:
    existing = {g.kind.value: g for g in list_goals(db, user)}
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
    hitos_fi = [FiStep(monto=h, logrado=patrimonio_total >= h) for h in hitos_base]

    return GoalsProgressOut(
        currency=display_currency,
        patrimonio_total=patrimonio_total,
        dividendo_mensual=dividendo_mensual_total,
        dividendo_anual_bruto=dividendo_anual_total,
        portfolios=contributions,
        goals=goals,
        hitos_fi=hitos_fi,
        numero_fi=numero_fi,
    )
