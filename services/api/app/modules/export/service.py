from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.portfolio import Asset
from app.models.strategy import HoldingTag, Tag
from app.models.user import User
from app.modules.alerts import service as alerts_service
from app.modules.goals import service as goals_service
from app.modules.portfolios import service as portfolios_service
from app.schemas.export import (
    ExportAlertOut,
    ExportGoalOut,
    ExportHoldingTagOut,
    ExportPortfolioOut,
    ExportTagOut,
    ExportTransactionOut,
    UserDataExportOut,
)


def export_user_data(db: Session, user: User) -> UserDataExportOut:
    """Everything a user owns, gathered from the same list_* functions each
    module already uses — a backup/portability export, not a new source of
    truth. Reused, not reimplemented, so it can't silently drift from what
    Portfolios/Objetivos/Alertas/Etiquetas actually show.
    """
    portfolios = portfolios_service.list_portfolios(db, user)
    portfolio_rows = [
        ExportPortfolioOut(
            id=p.id,
            name=p.name,
            currency=p.currency,
            transactions=[
                ExportTransactionOut(
                    id=t.id,
                    yahoo_symbol=t.asset.yahoo_symbol if t.asset is not None else "",
                    type=t.type.value,
                    trade_date=t.trade_date,
                    quantity=float(t.quantity) if t.quantity is not None else None,
                    price=float(t.price) if t.price is not None else None,
                    gross_amount=float(t.gross_amount),
                    currency=t.currency,
                )
                for t in portfolios_service.list_transactions(db, p)
            ],
        )
        for p in portfolios
    ]

    goal_rows = [
        ExportGoalOut(
            id=g.id,
            kind=g.kind.value,
            name=g.name,
            target_amount=float(g.target_amount),
            currency=g.currency,
            monthly_expenses=float(g.monthly_expenses) if g.monthly_expenses is not None else None,
            target_date=g.target_date,
        )
        for g in goals_service.list_goals(db, user)
    ]

    alert_rows = [
        ExportAlertOut(
            id=a.id,
            yahoo_symbol=a.asset.yahoo_symbol,
            condition=a.condition,
            threshold=float(a.threshold) if a.threshold is not None else None,
            params=a.params,
            active=a.active,
            triggered_at=a.triggered_at,
        )
        for a in alerts_service.list_alerts(db, user)
    ]

    tags = list(db.scalars(select(Tag).where(Tag.user_id == user.id).order_by(Tag.label)))
    tag_rows = [
        ExportTagOut(label=t.label, target_weight=float(t.target_weight) if t.target_weight is not None else None)
        for t in tags
    ]

    holding_tag_rows: list[ExportHoldingTagOut] = []
    for p in portfolios:
        assignments = db.execute(
            select(HoldingTag.asset_id, Tag.label)
            .join(Tag, Tag.id == HoldingTag.tag_id)
            .where(HoldingTag.portfolio_id == p.id)
        ).all()
        if not assignments:
            continue
        assets_by_id = {
            a.id: a for a in db.scalars(select(Asset).where(Asset.id.in_([row.asset_id for row in assignments])))
        }
        for asset_id, label in assignments:
            asset = assets_by_id.get(asset_id)
            if asset is not None:
                holding_tag_rows.append(ExportHoldingTagOut(portfolio_id=p.id, yahoo_symbol=asset.yahoo_symbol, tag=label))

    return UserDataExportOut(
        exported_at=datetime.now(UTC),
        portfolios=portfolio_rows,
        goals=goal_rows,
        alerts=alert_rows,
        tags=tag_rows,
        holding_tags=holding_tag_rows,
    )
