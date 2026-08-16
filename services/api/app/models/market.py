from __future__ import annotations

import enum
import uuid
from datetime import date

from sqlalchemy import BigInteger, Boolean, Enum, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base

MARKET_SCHEMA = "market"


class DividendStatus(enum.StrEnum):
    DECLARED = "declared"
    ESTIMATED = "estimated"


class DividendFrequency(enum.StrEnum):
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    ANNUAL = "annual"


class Price(Base):
    __tablename__ = "prices"
    __table_args__ = {"schema": MARKET_SCHEMA}

    asset_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("assets.id", ondelete="CASCADE"), primary_key=True
    )
    date: Mapped[date] = mapped_column(primary_key=True)
    close: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    adj_close: Mapped[float | None] = mapped_column(Numeric(18, 6), nullable=True)
    volume: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    is_stale: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")


class Fundamentals(Base):
    __tablename__ = "fundamentals"
    __table_args__ = {"schema": MARKET_SCHEMA}

    asset_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("assets.id", ondelete="CASCADE"), primary_key=True
    )
    as_of: Mapped[date] = mapped_column(primary_key=True)
    roe: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    roa: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    roic: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    pe_ratio: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    payout_ratio: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    gross_margin: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    op_margin: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    net_margin: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    dividend_yield: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    div_cagr_5y: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    expense_ratio: Mapped[float | None] = mapped_column(Numeric(10, 4), nullable=True)
    aum: Mapped[float | None] = mapped_column(Numeric(20, 2), nullable=True)
    market_cap: Mapped[float | None] = mapped_column(Numeric(20, 2), nullable=True)


class DividendEvent(Base):
    __tablename__ = "dividend_events"
    __table_args__ = {"schema": MARKET_SCHEMA}

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    asset_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assets.id", ondelete="CASCADE"))
    ex_date: Mapped[date] = mapped_column(nullable=False)
    pay_date: Mapped[date | None] = mapped_column(nullable=True)
    amount_per_share: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    status: Mapped[DividendStatus] = mapped_column(
        Enum(
            DividendStatus,
            name="dividend_status",
            schema=MARKET_SCHEMA,
            values_callable=lambda cls: [e.value for e in cls],
        ),
        nullable=False,
    )
    frequency: Mapped[DividendFrequency] = mapped_column(
        Enum(
            DividendFrequency,
            name="dividend_frequency",
            schema=MARKET_SCHEMA,
            values_callable=lambda cls: [e.value for e in cls],
        ),
        nullable=False,
    )


class FxRate(Base):
    __tablename__ = "fx_rates"
    __table_args__ = {"schema": MARKET_SCHEMA}

    base: Mapped[str] = mapped_column(String(3), primary_key=True)
    quote: Mapped[str] = mapped_column(String(3), primary_key=True)
    date: Mapped[date] = mapped_column(primary_key=True)
    rate: Mapped[float] = mapped_column(Numeric(18, 8), nullable=False)
    source: Mapped[str] = mapped_column(String(40), nullable=False)
