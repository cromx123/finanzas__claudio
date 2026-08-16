from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User
from app.modules.auth.router import get_current_user
from app.modules.dividends import service
from app.modules.portfolios import service as portfolios_service
from app.schemas.dividends import DividendCalendarOut

router = APIRouter(prefix="/dividends", tags=["dividends"])


@router.get("/calendar", response_model=DividendCalendarOut)
def get_calendar(
    portfolio_id: uuid.UUID = Query(...),
    year: int = Query(default_factory=lambda: date.today().year),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DividendCalendarOut:
    try:
        portfolio = portfolios_service.get_owned_portfolio(db, user, portfolio_id)
    except portfolios_service.PortfolioNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="portfolio not found") from exc
    return service.get_calendar(db, user, portfolio, year)
