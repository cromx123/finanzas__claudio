from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.models.alerts import Alert
from app.models.user import User
from app.modules.alerts import service
from app.modules.assets.service import latest_price
from app.modules.auth.router import get_current_user
from app.modules.ingestion.providers.yahoo import YahooProvider
from app.schemas.alerts import AlertIn, AlertOut

router = APIRouter(prefix="/alerts", tags=["alerts"])


def _to_out(db: Session, alert: Alert) -> AlertOut:
    price_row = latest_price(db, alert.asset_id)
    return AlertOut(
        id=alert.id,
        asset=alert.asset,
        condition=alert.condition.value,
        threshold=float(alert.threshold),
        active=alert.active,
        triggered_at=alert.triggered_at,
        created_at=alert.created_at,
        current_price=float(price_row.close) if price_row is not None else None,
    )


@router.get("", response_model=list[AlertOut])
def list_alerts(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[AlertOut]:
    return [_to_out(db, a) for a in service.list_alerts(db, user)]


@router.post("", response_model=AlertOut, status_code=status.HTTP_201_CREATED)
def create_alert(
    payload: AlertIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> AlertOut:
    try:
        alert = service.create_alert(
            db, YahooProvider(), user, payload.yahoo_symbol, payload.condition, payload.threshold
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    return _to_out(db, alert)


@router.delete("/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_alert(
    alert_id: uuid.UUID, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> None:
    service.delete_alert(db, user, alert_id)
