from __future__ import annotations

import pytest

from app.modules.ingestion.markets import resolve_suffix


def test_resolve_suffix_santiago():
    info = resolve_suffix("SQM-B.SN")
    assert info.exchange_mic == "XSGO"
    assert info.currency == "CLP"
    assert info.timezone == "America/Santiago"


def test_resolve_suffix_madrid():
    info = resolve_suffix("IBE.MC")
    assert info.exchange_mic == "XMAD"
    assert info.currency == "EUR"
    assert info.timezone == "Europe/Madrid"


def test_resolve_suffix_plain_us_ticker():
    info = resolve_suffix("AAPL")
    assert info.currency == "USD"
    assert info.timezone == "America/New_York"


def test_resolve_suffix_us_ticker_with_dash_class():
    info = resolve_suffix("BRK-B")
    assert info.currency == "USD"


def test_resolve_suffix_benchmark_index():
    info = resolve_suffix("^GSPC")
    assert info.currency == "USD"


def test_resolve_suffix_is_case_insensitive():
    assert resolve_suffix("sqm.sn").exchange_mic == "XSGO"


def test_resolve_suffix_unknown_suffix_raises():
    with pytest.raises(ValueError):
        resolve_suffix("FOO.ZZ")


def test_resolve_suffix_invalid_format_raises():
    with pytest.raises(ValueError):
        resolve_suffix("not a ticker!!")


def test_resolve_suffix_empty_raises():
    with pytest.raises(ValueError):
        resolve_suffix("   ")
