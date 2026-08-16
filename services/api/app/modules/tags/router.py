from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.strategy import Tag
from app.models.user import User
from app.modules.auth.router import get_current_user

router = APIRouter(prefix="/tags", tags=["tags"])


class TagIn(BaseModel):
    label: str = Field(min_length=1, max_length=60)


@router.get("", response_model=list[str])
def list_tags(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[str]:
    return list(db.scalars(select(Tag.label).where(Tag.user_id == user.id).order_by(Tag.label)))


@router.post("", response_model=list[str], status_code=201)
def create_tag(
    payload: TagIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[str]:
    existing = db.scalar(select(Tag).where(Tag.user_id == user.id, Tag.label == payload.label))
    if existing is None:
        db.add(Tag(user_id=user.id, label=payload.label))
        db.commit()
    return list(db.scalars(select(Tag.label).where(Tag.user_id == user.id).order_by(Tag.label)))
