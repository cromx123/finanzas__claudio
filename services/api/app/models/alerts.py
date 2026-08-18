from __future__ import annotations

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Enum, ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.db import Base
from app.models.portfolio import Asset


class AlertCondition(enum.StrEnum):
    PRICE_BELOW = "price_below"
    PRICE_ABOVE = "price_above"


class Alert(Base):
    """A price watch on a ticker — not tied to owning it in a portfolio
    (README: "seguimiento de acción"), checked once daily by the ingestion
    scheduler after the day's close lands (see modules/alerts/service.py
    check_alerts). In-app only: once triggered it's deactivated and shown
    as such in the Perfil tab — there's no email/push channel wired up.
    """

    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    asset_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assets.id", ondelete="CASCADE"))
    condition: Mapped[AlertCondition] = mapped_column(
        Enum(AlertCondition, name="alert_condition", values_callable=lambda cls: [e.value for e in cls]),
        nullable=False,
    )
    threshold: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    triggered_at: Mapped[date | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    asset: Mapped[Asset] = relationship()
