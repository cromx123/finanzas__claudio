from __future__ import annotations

from datetime import date

import pytest

from app.modules.ingestion.providers.base import QuoteResult
from app.modules.ingestion.providers.yahoo import _retry
from app.modules.ingestion.service import decide_price


class _FakeLastKnownPrice:
    close = 99.5


def test_decide_price_uses_fresh_quote_when_available():
    fetched = QuoteResult(symbol="AAPL", date=date(2026, 8, 14), close=150.25, volume=1200)
    decision = decide_price(fetched, last_known=None)
    assert decision.close == 150.25
    assert decision.volume == 1200
    assert decision.is_stale is False


def test_decide_price_falls_back_to_last_close_when_provider_has_no_data():
    # This is the .SN stability rule: an illiquid ticker with no trade today
    # must still show a close, flagged stale, instead of a gap in the series.
    decision = decide_price(fetched=None, last_known=_FakeLastKnownPrice())
    assert decision.close == 99.5
    assert decision.is_stale is True


def test_decide_price_raises_without_any_data_at_all():
    with pytest.raises(ValueError):
        decide_price(fetched=None, last_known=None)


def test_provider_retry_recovers_from_transient_failures():
    calls = {"count": 0}

    @_retry
    def flaky() -> str:
        calls["count"] += 1
        if calls["count"] < 3:
            raise RuntimeError("transient network error")
        return "ok"

    assert flaky() == "ok"
    assert calls["count"] == 3


def test_provider_retry_gives_up_after_max_attempts():
    calls = {"count": 0}

    @_retry
    def always_fails() -> None:
        calls["count"] += 1
        raise RuntimeError("still down")

    with pytest.raises(RuntimeError):
        always_fails()
    assert calls["count"] == 3
