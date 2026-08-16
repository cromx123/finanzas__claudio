from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User
from app.modules.auth.router import get_current_user
from app.modules.screener import service
from app.schemas.screener import AssetDetailOut, ScreenerAssetOut

router = APIRouter(tags=["screener"])


@router.get("/screener", response_model=list[ScreenerAssetOut])
def list_screener(_: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[ScreenerAssetOut]:
    return service.list_screener(db)


@router.get("/assets/{yahoo_symbol}", response_model=AssetDetailOut)
def get_asset_detail(
    yahoo_symbol: str, _: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> AssetDetailOut:
    try:
        return service.get_asset_detail(db, yahoo_symbol)
    except service.AssetNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="asset not found") from exc
