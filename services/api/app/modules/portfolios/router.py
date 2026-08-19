from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User
from app.modules.auth.router import get_current_user
from app.modules.ingestion.providers.yahoo import YahooProvider
from app.modules.portfolios import service
from app.schemas.portfolios import (
    CountryAllocationOut,
    HoldingTagsIn,
    LotOut,
    PortfolioIn,
    PortfolioOut,
    PortfolioPerformanceOut,
    PortfolioSummaryOut,
    TransactionIn,
    TransactionOut,
    TransactionUpdateIn,
)

router = APIRouter(prefix="/portfolios", tags=["portfolios"])


class PortfolioRenameIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)


def _get_owned(db: Session, user: User, portfolio_id: uuid.UUID):
    try:
        return service.get_owned_portfolio(db, user, portfolio_id)
    except service.PortfolioNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="portfolio not found") from exc


@router.get("", response_model=list[PortfolioOut])
def list_portfolios(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[PortfolioOut]:
    return service.list_portfolios(db, user)


@router.post("", response_model=PortfolioOut, status_code=status.HTTP_201_CREATED)
def create_portfolio(
    payload: PortfolioIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> PortfolioOut:
    return service.create_portfolio(db, user, payload.name, payload.currency)


@router.get("/allocation/country", response_model=CountryAllocationOut)
def get_country_allocation(
    currency: str = Query(default="CLP", min_length=3, max_length=3),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CountryAllocationOut:
    return service.compute_country_allocation(db, user, currency.upper())


@router.patch("/{portfolio_id}", response_model=PortfolioOut)
def rename_portfolio(
    portfolio_id: uuid.UUID,
    payload: PortfolioRenameIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PortfolioOut:
    portfolio = _get_owned(db, user, portfolio_id)
    return service.rename_portfolio(db, portfolio, payload.name)


@router.delete("/{portfolio_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_portfolio(
    portfolio_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> None:
    portfolio = _get_owned(db, user, portfolio_id)
    service.delete_portfolio(db, portfolio)


@router.get("/{portfolio_id}/summary", response_model=PortfolioSummaryOut)
def get_summary(
    portfolio_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> PortfolioSummaryOut:
    portfolio = _get_owned(db, user, portfolio_id)
    return service.compute_summary(db, user, portfolio)


@router.get("/{portfolio_id}/performance", response_model=PortfolioPerformanceOut)
def get_performance(
    portfolio_id: uuid.UUID,
    range: str = Query(default="3A", pattern="^(1D|1W|1M|3M|1A|3A|5A)$"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PortfolioPerformanceOut:
    portfolio = _get_owned(db, user, portfolio_id)
    return service.get_portfolio_performance(db, YahooProvider(), portfolio, range)


@router.get("/{portfolio_id}/transactions", response_model=list[TransactionOut])
def list_transactions(
    portfolio_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[TransactionOut]:
    portfolio = _get_owned(db, user, portfolio_id)
    return service.list_transactions(db, portfolio)


@router.get("/{portfolio_id}/lots", response_model=list[LotOut])
def list_open_lots(
    portfolio_id: uuid.UUID,
    yahoo_symbol: str = Query(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[LotOut]:
    portfolio = _get_owned(db, user, portfolio_id)
    lots = service.list_open_lots_by_symbol(db, portfolio, yahoo_symbol)
    return [LotOut(id=t.id, trade_date=t.trade_date, quantity=float(t.remaining_quantity), price=float(t.price)) for t in lots]


@router.post("/{portfolio_id}/transactions", response_model=TransactionOut, status_code=status.HTTP_201_CREATED)
def add_transaction(
    portfolio_id: uuid.UUID,
    payload: TransactionIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TransactionOut:
    portfolio = _get_owned(db, user, portfolio_id)
    provider = YahooProvider()
    try:
        return service.add_transaction(
            db,
            provider,
            portfolio,
            payload.yahoo_symbol,
            payload.type,
            payload.trade_date,
            payload.quantity,
            payload.price,
            payload.lot_strategy,
            payload.lots,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except service.InsufficientQuantityError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.patch("/{portfolio_id}/transactions/{transaction_id}", response_model=TransactionOut)
def update_transaction(
    portfolio_id: uuid.UUID,
    transaction_id: uuid.UUID,
    payload: TransactionUpdateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TransactionOut:
    portfolio = _get_owned(db, user, portfolio_id)
    try:
        return service.update_transaction(
            db, portfolio, transaction_id, payload.trade_date, payload.quantity, payload.price
        )
    except service.TransactionNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="transaction not found") from exc
    except service.InsufficientQuantityError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except service.LotAllocationError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.delete("/{portfolio_id}/transactions/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(
    portfolio_id: uuid.UUID,
    transaction_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    portfolio = _get_owned(db, user, portfolio_id)
    try:
        service.delete_transaction(db, portfolio, transaction_id)
    except service.LotAllocationError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.delete("/{portfolio_id}/holdings/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_position(
    portfolio_id: uuid.UUID,
    asset_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    portfolio = _get_owned(db, user, portfolio_id)
    service.delete_position(db, portfolio, asset_id)


@router.put("/{portfolio_id}/holdings/{asset_id}/tags", response_model=list[str])
def set_holding_tags(
    portfolio_id: uuid.UUID,
    asset_id: uuid.UUID,
    payload: HoldingTagsIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[str]:
    portfolio = _get_owned(db, user, portfolio_id)
    return service.set_holding_tags(db, user, portfolio, asset_id, payload.tags)
