from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.user import User
from app.modules.auth.router import get_current_user
from app.modules.ingestion.providers.yahoo import YahooProvider
from app.modules.screener import service
from app.schemas.screener import (
    AssetDetailOut,
    AssetIngestIn,
    AssetSearchResultOut,
    PriceOnDateOut,
    ScreenerAssetOut,
    ScreenerPageOut,
)

router = APIRouter(tags=["screener"])


@router.get("/screener", response_model=ScreenerPageOut)
def list_screener(
    q: str = Query(default=""),
    tipo: str = Query(default="*", pattern=r"^(\*|stock|etf|reit)$"),
    yield_min: float = Query(default=0, ge=0),
    pe_max: float = Query(default=0, ge=0),
    roe_min: float = Query(default=0, ge=0),
    sort_key: str = Query(default="yield_pct", pattern=r"^(yield_pct|cagr_div_5y|pe_ratio|roe)$"),
    sort_dir: int = Query(default=-1, ge=-1, le=1),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=10_000, ge=1, le=10_000),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ScreenerPageOut:
    """Defaults return the whole universe (used by the ticker-autocomplete
    lookup, which needs everything for instant local prefix matching); the
    Screener page passes explicit filter/sort/offset/limit for true
    server-side pagination — see MEJORAS.md.
    """
    rows, total = service.list_screener(db, q, tipo, yield_min, pe_max, roe_min, sort_key, sort_dir, offset, limit)
    return ScreenerPageOut(rows=rows, total=total)


@router.post("/screener", response_model=ScreenerAssetOut, status_code=status.HTTP_201_CREATED)
def add_screener_asset(
    payload: AssetIngestIn, _: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> ScreenerAssetOut:
    """Manually adds (or refreshes) a ticker — pulls fundamentals, price
    history, and dividends from Yahoo Finance right away. Synchronous and
    can take a few seconds; that's expected for a one-off "add this ticker"
    action, same tradeoff as add_transaction's inline asset creation.
    """
    try:
        return service.add_asset_to_screener(db, YahooProvider(), payload.yahoo_symbol)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/assets/search", response_model=list[AssetSearchResultOut])
def search_assets(q: str = "", _: User = Depends(get_current_user)) -> list[AssetSearchResultOut]:
    """Registered before /assets/{yahoo_symbol} so "search" isn't captured as a ticker."""
    return service.search_assets(YahooProvider(), q)


@router.get("/assets/{yahoo_symbol}", response_model=AssetDetailOut)
def get_asset_detail(
    yahoo_symbol: str, _: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> AssetDetailOut:
    try:
        return service.get_asset_detail(db, yahoo_symbol)
    except service.AssetNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="asset not found") from exc


@router.get("/assets/{yahoo_symbol}/price-on-date", response_model=PriceOnDateOut)
def get_price_on_date(
    yahoo_symbol: str,
    on: date = Query(...),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PriceOnDateOut:
    """Reference close price for the "Agregar transacción" form, shown next
    to the price field once a ticker and date are both picked."""
    try:
        return service.get_price_on_date(db, YahooProvider(), yahoo_symbol, on)
    except service.PriceNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="no price found for that date") from exc
