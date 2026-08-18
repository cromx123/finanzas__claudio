from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User
from app.modules.auth.router import get_current_user
from app.modules.movements import service
from app.schemas.movements import MovementOut

router = APIRouter(prefix="/movements", tags=["movements"])


@router.get("", response_model=list[MovementOut])
def list_movements(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[MovementOut]:
    return service.list_movements(db, user)
