from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User
from app.modules.auth.router import get_current_user
from app.modules.export import service
from app.schemas.export import UserDataExportOut

router = APIRouter(prefix="/export", tags=["export"])


@router.get("/all", response_model=UserDataExportOut)
def export_all(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> UserDataExportOut:
    return service.export_user_data(db, user)
