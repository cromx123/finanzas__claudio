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


class GoalOut(GoalIn):
    id: uuid.UUID

    model_config = {"from_attributes": True}


class PortfolioContribution(BaseModel):
    id: uuid.UUID
    name: str
    currency: str
    valor_nativo: float
    valor_convertido: float
    dividendo_mensual_convertido: float


class FiStep(BaseModel):
    monto: float
    logrado: bool


class GoalsProgressOut(BaseModel):
    currency: str
    patrimonio_total: float
    dividendo_mensual: float
    dividendo_anual_bruto: float
    portfolios: list[PortfolioContribution]
    goals: list[GoalOut]
    hitos_fi: list[FiStep]
    numero_fi: float
