from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
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


class TagTargetWeightIn(BaseModel):
    target_weight: float | None = Field(default=None, ge=0, le=100)


class TagOut(BaseModel):
    label: str
    target_weight: float | None

    model_config = {"from_attributes": True}


def _list_tags(db: Session, user: User) -> list[TagOut]:
    rows = db.scalars(select(Tag).where(Tag.user_id == user.id).order_by(Tag.label))
    return [TagOut(label=t.label, target_weight=float(t.target_weight) if t.target_weight is not None else None) for t in rows]


@router.get("", response_model=list[TagOut])
def list_tags(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[TagOut]:
    return _list_tags(db, user)


@router.post("", response_model=list[TagOut], status_code=201)
def create_tag(payload: TagIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[TagOut]:
    existing = db.scalar(select(Tag).where(Tag.user_id == user.id, Tag.label == payload.label))
    if existing is None:
        db.add(Tag(user_id=user.id, label=payload.label))
        db.commit()
    return _list_tags(db, user)


@router.patch("/{label}", response_model=list[TagOut])
def set_tag_target_weight(
    label: str, payload: TagTargetWeightIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[TagOut]:
    tag = db.scalar(select(Tag).where(Tag.user_id == user.id, Tag.label == label))
    if tag is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="tag not found")
    tag.target_weight = payload.target_weight
    db.commit()
    return _list_tags(db, user)


@router.delete("/{label}", response_model=list[TagOut])
def delete_tag(label: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[TagOut]:
    # holding_tags rows for this tag cascade at the DB level (FK ondelete=
    # CASCADE) — no relationship() on Tag for the ORM to fight, unlike the
    # Portfolio.transactions bug fixed earlier this session.
    tag = db.scalar(select(Tag).where(Tag.user_id == user.id, Tag.label == label))
    if tag is not None:
        db.delete(tag)
        db.commit()
    return _list_tags(db, user)
