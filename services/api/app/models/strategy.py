from __future__ import annotations

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Enum, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class GoalKind(enum.StrEnum):
    MONTHLY_DIVIDENDS = "monthly_dividends"
    COST_COVERAGE = "cost_coverage"
    NET_WORTH = "net_worth"


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    label: Mapped[str] = mapped_column(String(60), nullable=False)
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)
    # Target allocation weight (percent, 0-100) for the rebalancing helper in
    # Objetivos — None means the user hasn't set a target for this tag yet.
    target_weight: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)


class HoldingTag(Base):
    __tablename__ = "holding_tags"

    portfolio_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("portfolios.id", ondelete="CASCADE"), primary_key=True
    )
    asset_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("assets.id", ondelete="CASCADE"), primary_key=True
    )
    tag_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True
    )


class Goal(Base):
    __tablename__ = "goals"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    kind: Mapped[GoalKind] = mapped_column(
        Enum(GoalKind, name="goal_kind", values_callable=lambda cls: [e.value for e in cls]),
        nullable=False,
    )
    target_amount: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    monthly_expenses: Mapped[float | None] = mapped_column(Numeric(18, 6), nullable=True)
    target_date: Mapped[date | None] = mapped_column(nullable=True)
    # Only set for kind=net_worth "custom goal" rows (e.g. "Viaje a Europa").
    # monthly_dividends/cost_coverage stay singleton-per-user and unnamed —
    # see modules/goals/service.py upsert_goals vs create_custom_goal.
    name: Mapped[str | None] = mapped_column(String(120), nullable=True)
    # Drives two things for custom net_worth goals: envelope priority order
    # (oldest goal claims the shared patrimonio pool first, see
    # modules/goals/service.py compute_progress) and the pace projection
    # against target_date (rate = current_amount / days since created_at).
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
