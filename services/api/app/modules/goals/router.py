from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User
from app.modules.auth.router import get_current_user
from app.modules.goals import service
from app.schemas.goals import GoalIn, GoalOut, GoalsProgressOut

router = APIRouter(prefix="/goals", tags=["goals"])


@router.get("", response_model=list[GoalOut])
def list_goals(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[GoalOut]:
    return service.list_goals(db, user)


@router.put("", response_model=list[GoalOut])
def upsert_goals(
    payload: list[GoalIn], user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[GoalOut]:
    return service.upsert_goals(db, user, payload)


@router.get("/progress", response_model=GoalsProgressOut)
def get_progress(
    currency: str = Query(default="CLP", min_length=3, max_length=3),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GoalsProgressOut:
    return service.compute_progress(db, user, currency.upper())
