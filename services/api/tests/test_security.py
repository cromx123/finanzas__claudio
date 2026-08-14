from __future__ import annotations

import pytest

from app.core.config import settings
from app.core.security import (
    InvalidTokenError,
    TokenType,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)


def test_password_hash_roundtrip():
    hashed = hash_password("correct horse battery staple")
    assert hashed != "correct horse battery staple"
    assert verify_password("correct horse battery staple", hashed)
    assert not verify_password("wrong password", hashed)


def test_access_token_roundtrip():
    token = create_access_token("user-123")
    assert decode_token(token, TokenType.ACCESS) == "user-123"


def test_refresh_token_roundtrip():
    token = create_refresh_token("user-123")
    assert decode_token(token, TokenType.REFRESH) == "user-123"


def test_refresh_token_rejected_as_access():
    token = create_refresh_token("user-123")
    with pytest.raises(InvalidTokenError):
        decode_token(token, TokenType.ACCESS)


def test_garbage_token_rejected():
    with pytest.raises(InvalidTokenError):
        decode_token("not-a-jwt", TokenType.ACCESS)


def test_expired_token_rejected(monkeypatch):
    monkeypatch.setattr(settings, "access_token_expire_minutes", -1)
    token = create_access_token("user-123")
    with pytest.raises(InvalidTokenError):
        decode_token(token, TokenType.ACCESS)
