from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.db import get_db
from app.models.portfolio import Asset
from app.modules.ingestion.providers.yahoo import YahooProvider
from app.modules.ingestion.service import ingest_daily_price

router = APIRouter(prefix="/internal", tags=["ingestion"])


def require_internal_secret(x_internal_secret: str | None = Header(default=None)) -> None:
    if x_internal_secret != settings.internal_api_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid internal secret"
        )


@router.post("/refresh")
def refresh(
    symbol: str,
    db: Session = Depends(get_db),
    _: None = Depends(require_internal_secret),
) -> dict:
    asset = db.scalar(select(Asset).where(Asset.yahoo_symbol == symbol))
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="unknown asset")

    provider = YahooProvider()
    price = ingest_daily_price(db, provider, asset, date.today())
    return {
        "symbol": symbol,
        "date": str(price.date),
        "close": float(price.close),
        "is_stale": price.is_stale,
    }
