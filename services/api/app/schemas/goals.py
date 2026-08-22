from __future__ import annotations

import uuid
from datetime import date

from pydantic import BaseModel, Field


class GoalIn(BaseModel):
    kind: str = Field(pattern="^(monthly_dividends|cost_coverage|net_worth)$")
    target_amount: float = Field(ge=0)
    currency: str = Field(min_length=3, max_length=3)
    monthly_expenses: float | None = None
    target_date: date | None = None
    name: str | None = None


class GoalOut(GoalIn):
    id: uuid.UUID

    model_config = {"from_attributes": True}


class CustomGoalIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    target_amount: float = Field(gt=0)
    currency: str = Field(min_length=3, max_length=3)
    target_date: date | None = None


class CustomGoalOut(BaseModel):
    id: uuid.UUID
    name: str
    target_amount: float
    currency: str
    target_date: date | None
    current_amount: float
    pct: float
    # Envelope allocation means current_amount/pct already reflect this
    # goal's share of the shared patrimonio pool (see compute_progress).
    # Pace fields: projected_date is when the goal is reached at the rate
    # seen since it was created (None if there's no positive rate yet);
    # on_track compares that against target_date (None if no target_date).
    projected_date: date | None = None
    on_track: bool | None = None

    model_config = {"from_attributes": True}


class HoldingContribution(BaseModel):
    yahoo_symbol: str
    valor_nativo: float


class PortfolioContribution(BaseModel):
    id: uuid.UUID
    name: str
    currency: str
    valor_nativo: float
    valor_convertido: float
    dividendo_mensual_convertido: float
    holdings: list[HoldingContribution]


class FiStep(BaseModel):
    monto: float
    logrado: bool
    # Projected date this milestone is reached at the patrimonio growth rate
    # observed since the user's first transaction (None if not reached and
    # there's no positive rate to project from — see _fi_projected_date).
    projected_date: date | None = None


class GoalsProgressOut(BaseModel):
    currency: str
    patrimonio_total: float
    dividendo_mensual: float
    dividendo_anual_bruto: float
    portfolios: list[PortfolioContribution]
    goals: list[GoalOut]
    hitos_fi: list[FiStep]
    numero_fi: float
    numero_fi_projected_date: date | None = None
    custom_goals: list[CustomGoalOut]
