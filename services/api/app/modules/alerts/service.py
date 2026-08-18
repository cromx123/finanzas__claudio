from __future__ import annotations

import logging
import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.alerts import Alert, AlertCondition
from app.models.user import User
from app.modules.assets.service import get_or_create_asset, ingest_full_asset, latest_price, refresh_quote
from app.modules.ingestion.providers.base import Provider

logger = logging.getLogger(__name__)


def create_alert(
    db: Session, provider: Provider, user: User, yahoo_symbol: str, condition: str, threshold: float
) -> Alert:
    asset = get_or_create_asset(db, provider, yahoo_symbol)
    if latest_price(db, asset.id) is None:
        # Same one-time full ingestion as buying a new asset for the first
        # time (portfolios.service.add_transaction) — a watch needs a price
        # to compare against right away, not just after tomorrow's EOD job.
        try:
            ingest_full_asset(db, provider, asset.yahoo_symbol)
        except Exception:
            logger.warning("full ingestion failed for new alert asset %s, falling back to a live quote", asset.yahoo_symbol, exc_info=True)
            refresh_quote(db, provider, asset)

    alert = Alert(user_id=user.id, asset_id=asset.id, condition=AlertCondition(condition), threshold=threshold)
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


def list_alerts(db: Session, user: User) -> list[Alert]:
    return list(
        db.scalars(
            select(Alert).where(Alert.user_id == user.id).order_by(Alert.active.desc(), Alert.created_at.desc())
        )
    )


def delete_alert(db: Session, user: User, alert_id: uuid.UUID) -> None:
    alert = db.get(Alert, alert_id)
    if alert is None or alert.user_id != user.id:
        return
    db.delete(alert)
    db.commit()


def check_alerts(db: Session) -> None:
    """Scheduler job: compares every still-active alert's threshold against
    the latest ingested close and deactivates the ones that hit — run once
    daily, after the price-ingestion jobs, so "latest price" means today's
    close. In-app only: there's no email/push channel, so triggering just
    means the Perfil tab will show it as disparada next time it's opened.
    """
    today = date.today()
    alerts = list(db.scalars(select(Alert).where(Alert.active.is_(True))))
    for alert in alerts:
        price_row = latest_price(db, alert.asset_id)
        if price_row is None:
            continue
        price = float(price_row.close)
        hit = (alert.condition == AlertCondition.PRICE_BELOW and price <= float(alert.threshold)) or (
            alert.condition == AlertCondition.PRICE_ABOVE and price >= float(alert.threshold)
        )
        if hit:
            alert.triggered_at = today
            alert.active = False
    db.commit()
