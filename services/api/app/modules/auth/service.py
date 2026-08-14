from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import (
    TokenType,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.user import User, UserTaxRule
from app.schemas.auth import MeUpdateIn, TaxRuleIn


class EmailAlreadyRegisteredError(Exception):
    pass


class InvalidCredentialsError(Exception):
    pass


class UserNotFoundError(Exception):
    pass


def register_user(
    db: Session, *, email: str, password: str, locale: str, base_currency: str
) -> User:
    normalized_email = email.strip().lower()
    exists = db.scalar(select(User).where(User.email == normalized_email))
    if exists is not None:
        raise EmailAlreadyRegisteredError(normalized_email)

    user = User(
        email=normalized_email,
        password_hash=hash_password(password),
        locale=locale,
        base_currency=base_currency.upper(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, *, email: str, password: str) -> User:
    normalized_email = email.strip().lower()
    user = db.scalar(select(User).where(User.email == normalized_email))
    if user is None or not verify_password(password, user.password_hash):
        raise InvalidCredentialsError(normalized_email)
    return user


def get_user_by_id(db: Session, user_id: uuid.UUID) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise UserNotFoundError(str(user_id))
    return user


def issue_token_pair(user: User) -> tuple[str, str]:
    subject = str(user.id)
    return create_access_token(subject), create_refresh_token(subject)


def refresh_access_token(db: Session, *, refresh_token: str) -> str:
    subject = decode_token(refresh_token, TokenType.REFRESH)
    user = get_user_by_id(db, uuid.UUID(subject))
    return create_access_token(str(user.id))


def update_me(db: Session, user: User, patch: MeUpdateIn) -> User:
    if patch.locale is not None:
        user.locale = patch.locale
    if patch.base_currency is not None:
        user.base_currency = patch.base_currency.upper()
    db.commit()
    db.refresh(user)
    return user


def list_tax_rules(db: Session, user: User) -> list[UserTaxRule]:
    return list(db.scalars(select(UserTaxRule).where(UserTaxRule.user_id == user.id)))


def replace_tax_rules(db: Session, user: User, rules: list[TaxRuleIn]) -> list[UserTaxRule]:
    db.query(UserTaxRule).filter(UserTaxRule.user_id == user.id).delete()
    new_rules = [
        UserTaxRule(
            user_id=user.id,
            country_code=rule.country_code.upper(),
            broker=rule.broker,
            withholding_pct=rule.withholding_pct,
            notes=rule.notes,
        )
        for rule in rules
    ]
    db.add_all(new_rules)
    db.commit()
    for rule in new_rules:
        db.refresh(rule)
    return new_rules
