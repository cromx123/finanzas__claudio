from __future__ import annotations

import enum
import uuid
from datetime import date

from sqlalchemy import Boolean, Enum, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


class AssetType(enum.StrEnum):
    STOCK = "stock"
    ETF = "etf"
    REIT = "reit"
    CRYPTO = "crypto"
    INDEX = "index"


class TransactionType(enum.StrEnum):
    BUY = "buy"
    SELL = "sell"
    DIVIDEND = "dividend"
    CONTRIBUTION = "contribution"
    FEE = "fee"


class Portfolio(Base):
    __tablename__ = "portfolios"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)

    transactions: Mapped[list["Transaction"]] = relationship(back_populates="portfolio")


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    yahoo_symbol: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    exchange_mic: Mapped[str] = mapped_column(String(10), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    sector: Mapped[str | None] = mapped_column(String(120), nullable=True)
    type: Mapped[AssetType] = mapped_column(Enum(AssetType, name="asset_type"), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    country: Mapped[str] = mapped_column(String(2), nullable=False)


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    portfolio_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("portfolios.id", ondelete="CASCADE")
    )
    asset_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("assets.id", ondelete="RESTRICT"), nullable=True
    )
    type: Mapped[TransactionType] = mapped_column(
        Enum(TransactionType, name="transaction_type"), nullable=False
    )
    trade_date: Mapped[date] = mapped_column(nullable=False)
    quantity: Mapped[float | None] = mapped_column(Numeric(18, 6), nullable=True)
    price: Mapped[float | None] = mapped_column(Numeric(18, 6), nullable=True)
    gross_amount: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    fx_rate: Mapped[float] = mapped_column(Numeric(18, 8), nullable=False)
    tax_withheld: Mapped[float] = mapped_column(Numeric(18, 6), default=0, server_default="0")
    is_drip: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")

    portfolio: Mapped[Portfolio] = relationship(back_populates="transactions")
    asset: Mapped[Asset | None] = relationship()
