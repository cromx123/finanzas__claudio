from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import InvalidTokenError, TokenType, decode_token
from app.models.user import User
from app.modules.auth import service
from app.schemas.auth import (
    LoginIn,
    MeOut,
    MeUpdateIn,
    RefreshIn,
    RegisterIn,
    TaxRuleIn,
    TaxRuleOut,
    TokenPair,
)

router = APIRouter(tags=["auth"])
_bearer = HTTPBearer(auto_error=True)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    try:
        subject = decode_token(credentials.credentials, TokenType.ACCESS)
        return service.get_user_by_id(db, uuid.UUID(subject))
    except (InvalidTokenError, ValueError, service.UserNotFoundError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
        ) from exc


@router.post("/auth/register", response_model=TokenPair, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterIn, db: Session = Depends(get_db)) -> TokenPair:
    try:
        user = service.register_user(
            db,
            email=payload.email,
            password=payload.password,
            locale=payload.locale,
            base_currency=payload.base_currency,
        )
    except service.EmailAlreadyRegisteredError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Email already registered"
        ) from exc
    access, refresh = service.issue_token_pair(user)
    return TokenPair(access_token=access, refresh_token=refresh)


@router.post("/auth/login", response_model=TokenPair)
def login(payload: LoginIn, db: Session = Depends(get_db)) -> TokenPair:
    try:
        user = service.authenticate_user(db, email=payload.email, password=payload.password)
    except service.InvalidCredentialsError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password"
        ) from exc
    access, refresh = service.issue_token_pair(user)
    return TokenPair(access_token=access, refresh_token=refresh)


@router.post("/auth/refresh", response_model=TokenPair)
def refresh(payload: RefreshIn, db: Session = Depends(get_db)) -> TokenPair:
    try:
        access = service.refresh_access_token(db, refresh_token=payload.refresh_token)
    except (InvalidTokenError, ValueError, service.UserNotFoundError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token"
        ) from exc
    return TokenPair(access_token=access, refresh_token=payload.refresh_token)


@router.get("/me", response_model=MeOut)
def read_me(user: User = Depends(get_current_user)) -> User:
    return user


@router.patch("/me", response_model=MeOut)
def patch_me(
    payload: MeUpdateIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    return service.update_me(db, user, payload)


@router.get("/me/tax-rules", response_model=list[TaxRuleOut])
def get_tax_rules(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[TaxRuleOut]:
    return service.list_tax_rules(db, user)


@router.put("/me/tax-rules", response_model=list[TaxRuleOut])
def put_tax_rules(
    payload: list[TaxRuleIn],
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[TaxRuleOut]:
    return service.replace_tax_rules(db, user, payload)
