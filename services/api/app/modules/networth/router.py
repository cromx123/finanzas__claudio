from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User
from app.modules.auth.router import get_current_user
from app.modules.networth import service
from app.schemas.networth import NetWorthHistoryOut

router = APIRouter(prefix="/networth", tags=["networth"])


@router.get("/history", response_model=NetWorthHistoryOut)
def get_history(
    currency: str = Query(default="CLP", min_length=3, max_length=3),
    range: str = Query(default="3A", pattern="^(1D|1W|1M|3M|1A|3A|5A)$"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> NetWorthHistoryOut:
    return service.compute_history(db, user, currency.upper(), range)
