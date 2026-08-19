from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import JSON, Boolean, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.db import Base
from app.models.portfolio import Asset


class Alert(Base):
    """A watch on a ticker — not tied to owning it in a portfolio (README:
    "seguimiento de acción"), checked once daily by the ingestion scheduler
    after the day's close lands (see modules/alerts/service.py check_alerts).
    In-app only: once triggered it's deactivated and shown as such in the
    Perfil tab — there's no email/push channel wired up.

    `condition` is a plain string key into modules/alerts/indicators.py's
    INDICATORS registry rather than a Postgres enum — the whole point of the
    registry is that a new indicator (MACD, moving-average cross, …) is a
    new class + a dict entry, not a migration that adds an enum value.
    `threshold` is nullable because not every indicator needs one (a
    Bollinger-band-cross alert doesn't); `params` carries indicator-specific
    config (RSI's period, Bollinger's period/stddev).
    """

    __tablename__ = "alerts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    asset_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assets.id", ondelete="CASCADE"))
    condition: Mapped[str] = mapped_column(String(40), nullable=False)
    threshold: Mapped[float | None] = mapped_column(Numeric(18, 6), nullable=True)
    params: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    triggered_at: Mapped[date | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    asset: Mapped[Asset] = relationship()
