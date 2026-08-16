from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User
from app.modules.auth.router import get_current_user
from app.modules.fx import service

router = APIRouter(prefix="/fx-rates", tags=["fx"])


class FxRateIn(BaseModel):
    currency: str = Field(min_length=3, max_length=3, pattern="^(USD|EUR)$")
    rate_to_clp: float = Field(gt=0)


@router.get("", response_model=dict[str, float])
def get_rates(_: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, float]:
    return service.get_rates(db)


@router.put("", response_model=dict[str, float])
def set_rate(
    payload: FxRateIn, _: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> dict[str, float]:
    return service.set_rate(db, payload.currency, payload.rate_to_clp)
