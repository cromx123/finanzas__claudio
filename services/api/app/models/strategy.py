from __future__ import annotations

import enum
import uuid
from datetime import date

from sqlalchemy import Enum, ForeignKey, Numeric, String
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
