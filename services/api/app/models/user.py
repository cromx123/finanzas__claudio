from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    locale: Mapped[str] = mapped_column(String(10), default="es-CL", server_default="es-CL")
    base_currency: Mapped[str] = mapped_column(String(3), default="CLP", server_default="CLP")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    tax_rules: Mapped[list["UserTaxRule"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class UserTaxRule(Base):
    __tablename__ = "user_tax_rules"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    country_code: Mapped[str] = mapped_column(String(2), nullable=False)
    broker: Mapped[str | None] = mapped_column(String(120), nullable=True)
    withholding_pct: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped[User] = relationship(back_populates="tax_rules")
