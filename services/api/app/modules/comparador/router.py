from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User
from app.modules.auth.router import get_current_user
from app.modules.comparador import service
from app.schemas.comparador import ComparadorAssetOut

router = APIRouter(prefix="/comparador", tags=["comparador"])


@router.get("/assets", response_model=list[ComparadorAssetOut])
def list_comparador_assets(
    _: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[ComparadorAssetOut]:
    return service.list_comparador_assets(db)
