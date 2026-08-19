from __future__ import annotations

import logging
import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.alerts import Alert
from app.models.user import User
from app.modules.alerts.indicators import INDICATORS, price_series
from app.modules.assets.service import get_or_create_asset, ingest_full_asset, latest_price, refresh_quote
from app.modules.ingestion.providers.base import Provider

logger = logging.getLogger(__name__)


class AlertNotFoundError(Exception):
    pass


def create_alert(
    db: Session,
    provider: Provider,
    user: User,
    yahoo_symbol: str,
    condition: str,
    threshold: float | None,
    params: dict,
) -> Alert:
    if condition not in INDICATORS:
        raise ValueError(f"unknown alert condition: {condition!r}")

    asset = get_or_create_asset(db, provider, yahoo_symbol)
    if latest_price(db, asset.id) is None:
        # Same one-time full ingestion as buying a new asset for the first
        # time (portfolios.service.add_transaction) — a watch needs price
        # history to compare against right away (indicators like RSI/
        # Bollinger need a whole window, not just today's close), not just
        # after tomorrow's EOD job.
        try:
            ingest_full_asset(db, provider, asset.yahoo_symbol)
        except Exception:
            logger.warning("full ingestion failed for new alert asset %s, falling back to a live quote", asset.yahoo_symbol, exc_info=True)
            refresh_quote(db, provider, asset)

    alert = Alert(user_id=user.id, asset_id=asset.id, condition=condition, threshold=threshold, params=params)
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
        raise AlertNotFoundError(str(alert_id))
    db.delete(alert)
    db.commit()


def evaluate_alert(db: Session, alert: Alert, closes=None):
    """Runs the alert's indicator against price history — shared by
    check_alerts (decides whether to trigger) and the router's `_to_out`
    (just wants current_value for display). `closes` can be passed in to
    reuse an already-fetched series when checking many alerts on the same
    asset in one pass.
    """
    indicator = INDICATORS.get(alert.condition)
    if indicator is None:
        return None
    if closes is None:
        closes = price_series(db, alert.asset_id)
    threshold = float(alert.threshold) if alert.threshold is not None else None
    return indicator.evaluate(closes, threshold, alert.params or {})


def check_alerts(db: Session) -> None:
    """Scheduler job: evaluates every still-active alert's indicator against
    real price history and deactivates the ones that hit — run once daily,
    after the price-ingestion jobs, so history includes today's close.
    In-app only: there's no email/push channel, so triggering just means
    the Perfil tab will show it as disparada next time it's opened.
    """
    today = date.today()
    alerts = list(db.scalars(select(Alert).where(Alert.active.is_(True))))
    closes_by_asset: dict[uuid.UUID, object] = {}
    for alert in alerts:
        closes = closes_by_asset.get(alert.asset_id)
        if closes is None:
            closes = price_series(db, alert.asset_id)
            closes_by_asset[alert.asset_id] = closes
        result = evaluate_alert(db, alert, closes=closes)
        if result is not None and result.triggered:
            alert.triggered_at = today
            alert.active = False
    db.commit()
