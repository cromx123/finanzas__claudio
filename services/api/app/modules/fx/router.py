from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User
from app.modules.auth.router import get_current_user
from app.modules.fx import service
from app.modules.ingestion.providers.yahoo import YahooProvider

router = APIRouter(prefix="/fx-rates", tags=["fx"])

_provider = YahooProvider()


class FxRateDetail(BaseModel):
    rate: float
    source: str
    as_of: str | None


@router.get("", response_model=dict[str, float])
def get_rates(_: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, float]:
    return service.refresh_rates_from_yahoo(db, _provider)
