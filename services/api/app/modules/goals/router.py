from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User
from app.modules.auth.router import get_current_user
from app.modules.goals import service
from app.schemas.goals import CustomGoalIn, GoalIn, GoalOut, GoalsProgressOut

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


@router.post("/custom", response_model=GoalOut, status_code=status.HTTP_201_CREATED)
def create_custom_goal(
    payload: CustomGoalIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> GoalOut:
    return service.create_custom_goal(db, user, payload)


@router.patch("/custom/{goal_id}", response_model=GoalOut)
def update_custom_goal(
    goal_id: uuid.UUID,
    payload: CustomGoalIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GoalOut:
    try:
        return service.update_custom_goal(db, user, goal_id, payload)
    except service.GoalNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="goal not found") from exc


@router.delete("/custom/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_custom_goal(
    goal_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> None:
    try:
        service.delete_custom_goal(db, user, goal_id)
    except service.GoalNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="goal not found") from exc
