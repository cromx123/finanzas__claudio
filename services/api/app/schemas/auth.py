from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    locale: str = "es-CL"
    base_currency: str = Field(default="CLP", min_length=3, max_length=3)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class RefreshIn(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class MeOut(BaseModel):
    id: uuid.UUID
    email: str
    locale: str
    base_currency: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MeUpdateIn(BaseModel):
    locale: str | None = None
    base_currency: str | None = Field(default=None, min_length=3, max_length=3)


class TaxRuleIn(BaseModel):
    country_code: str = Field(min_length=2, max_length=2)
    broker: str | None = None
    withholding_pct: float = Field(ge=0, le=100)
    notes: str | None = None


class TaxRuleOut(TaxRuleIn):
    id: uuid.UUID

    model_config = {"from_attributes": True}
