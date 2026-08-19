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

    # passive_deletes=True: let the DB's ON DELETE CASCADE (see Transaction.
    # portfolio_id below) remove child transactions directly. Without it,
    # SQLAlchemy's default delete handling tries to UPDATE each transaction's
    # portfolio_id to NULL before deleting the portfolio — which fails,
    # since that column is NOT NULL, turning "delete portfolio" into a 500
    # for any portfolio that has transactions.
    transactions: Mapped[list["Transaction"]] = relationship(back_populates="portfolio", passive_deletes=True)


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    yahoo_symbol: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    exchange_mic: Mapped[str] = mapped_column(String(10), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    sector: Mapped[str | None] = mapped_column(String(120), nullable=True)
    type: Mapped[AssetType] = mapped_column(
        Enum(AssetType, name="asset_type", values_callable=lambda cls: [e.value for e in cls]),
        nullable=False,
    )
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
        Enum(TransactionType, name="transaction_type", values_callable=lambda cls: [e.value for e in cls]),
        nullable=False,
    )
    trade_date: Mapped[date] = mapped_column(nullable=False)
    quantity: Mapped[float | None] = mapped_column(Numeric(18, 6), nullable=True)
    price: Mapped[float | None] = mapped_column(Numeric(18, 6), nullable=True)
    gross_amount: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    fx_rate: Mapped[float] = mapped_column(Numeric(18, 8), nullable=False)
    tax_withheld: Mapped[float] = mapped_column(Numeric(18, 6), default=0, server_default="0")
    is_drip: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    # Only meaningful for BUY rows: how much of this lot hasn't been consumed
    # by a sell yet (see TransactionLotAllocation). NULL for SELL rows.
    remaining_quantity: Mapped[float | None] = mapped_column(Numeric(18, 6), nullable=True)

    portfolio: Mapped[Portfolio] = relationship(back_populates="transactions")
    asset: Mapped[Asset | None] = relationship()


class TransactionLotAllocation(Base):
    """Records which BUY lot(s) a SELL consumed, and how much — the source of
    truth for tax-lot cost basis (FIFO/LIFO/specific), replacing the old
    single blended average-cost calculation.
    """

    __tablename__ = "transaction_lot_allocations"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    sell_transaction_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("transactions.id", ondelete="CASCADE"))
    buy_transaction_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("transactions.id", ondelete="CASCADE"))
    quantity: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    cost_basis: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)

    sell_transaction: Mapped[Transaction] = relationship(foreign_keys=[sell_transaction_id])
    buy_transaction: Mapped[Transaction] = relationship(foreign_keys=[buy_transaction_id])
