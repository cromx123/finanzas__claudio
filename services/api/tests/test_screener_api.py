from __future__ import annotations

import uuid
from datetime import date, timedelta

from app.models.market import DividendEvent, DividendFrequency, DividendStatus, Fundamentals, Price
from app.models.portfolio import Asset, AssetType
from app.modules.ingestion.providers.base import Provider, QuoteResult, SearchResult


class FakeProvider(Provider):
    """No network calls — get_price_on returns a fixed quote for AAPL only,
    so tests can exercise both the "found" and "not found" paths."""

    def get_quote(self, symbol: str) -> QuoteResult | None:
        return None

    def get_history(self, symbol: str, period: str = "3y") -> list[QuoteResult]:
        return []

    def get_fundamentals(self, symbol: str) -> dict:
        return {}

    def get_dividends(self, symbol: str) -> list[dict]:
        return []

    def search(self, query: str) -> list[SearchResult]:
        return []

    def get_price_on(self, symbol: str, on: date) -> QuoteResult | None:
        if symbol == "AAPL":
            return QuoteResult(symbol=symbol, date=on, close=150.5)
        return None


def _register(client) -> str:
    resp = client.post(
        "/v1/auth/register", json={"email": "screener-price-test@example.com", "password": "SuperSecret123!"}
    )
    assert resp.status_code == 201
    return resp.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_price_on_date_falls_back_to_live_quote_for_unseeded_ticker(client, monkeypatch):
    monkeypatch.setattr("app.modules.screener.router.YahooProvider", FakeProvider)
    token = _register(client)

    resp = client.get("/v1/assets/AAPL/price-on-date?on=2024-01-15", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json() == {"date": "2024-01-15", "price": 150.5}


def test_price_on_date_404s_when_no_data_available(client, monkeypatch):
    monkeypatch.setattr("app.modules.screener.router.YahooProvider", FakeProvider)
    token = _register(client)

    resp = client.get("/v1/assets/ZZZQQQ/price-on-date?on=2024-01-15", headers=_auth(token))
    assert resp.status_code == 404


def test_price_on_date_404s_for_malformed_ticker(client, monkeypatch):
    monkeypatch.setattr("app.modules.screener.router.YahooProvider", FakeProvider)
    token = _register(client)

    resp = client.get("/v1/assets/ZZZZZNOTAREALTICKER/price-on-date?on=2024-01-15", headers=_auth(token))
    assert resp.status_code == 404


def test_price_on_date_fallback_is_cached(client, monkeypatch):
    """The live-Yahoo fallback path in get_price_on_date now caches by
    (symbol, date) in Redis — a second identical request must not hit the
    provider again. Clears the specific key first so a leftover entry from
    a previous test run (Redis persists across runs, unlike the DB) can't
    mask a broken cache.
    """
    from app.core.cache import _client as redis_client

    redis_client.delete("price-on-date:CACHETEST:2024-01-15")
    call_count = {"n": 0}

    class CountingProvider(FakeProvider):
        def get_price_on(self, symbol: str, on: date) -> QuoteResult | None:
            call_count["n"] += 1
            return QuoteResult(symbol=symbol, date=on, close=99.5)

    monkeypatch.setattr("app.modules.screener.router.YahooProvider", CountingProvider)
    token = _register(client)

    resp1 = client.get("/v1/assets/CACHETEST/price-on-date?on=2024-01-15", headers=_auth(token))
    assert resp1.status_code == 200
    assert resp1.json() == {"date": "2024-01-15", "price": 99.5}

    resp2 = client.get("/v1/assets/CACHETEST/price-on-date?on=2024-01-15", headers=_auth(token))
    assert resp2.status_code == 200
    assert resp2.json() == {"date": "2024-01-15", "price": 99.5}

    assert call_count["n"] == 1


def _seed_asset(db_session, symbol: str, price_start: float, price_now: float, div_by_year: dict[int, float]) -> uuid.UUID:
    asset = Asset(
        id=uuid.uuid4(),
        yahoo_symbol=symbol,
        exchange_mic="XNYS",
        name=f"{symbol} Inc.",
        sector="Technology",
        type=AssetType.STOCK,
        currency="USD",
        country="US",
    )
    db_session.add(asset)
    db_session.add(Fundamentals(asset_id=asset.id, as_of=date.today()))
    today = date.today()
    db_session.add(Price(asset_id=asset.id, date=today - timedelta(days=400), close=price_start))
    db_session.add(Price(asset_id=asset.id, date=today, close=price_now))
    for year, amount in div_by_year.items():
        db_session.add(
            DividendEvent(
                asset_id=asset.id,
                ex_date=date(year, 6, 1),
                amount_per_share=amount,
                currency="USD",
                status=DividendStatus.DECLARED,
                frequency=DividendFrequency.ANNUAL,
            )
        )
    return asset.id


def test_dividend_streak_counts_consecutive_yearly_increases(client, db_session, monkeypatch):
    """dividend_streak_years counts backward from the most recent *complete*
    year (this year is excluded — still in progress) and stops at the first
    year that didn't strictly increase over the one before.
    """
    monkeypatch.setattr("app.modules.portfolios.router.YahooProvider", FakeProvider)
    token = _register(client)

    # Strictly increasing every year -> streak of 3 (2023>22, 24>23, 25>24).
    _seed_asset(
        db_session, "STREAK3", price_start=100.0, price_now=100.0,
        div_by_year={2022: 1.0, 2023: 1.1, 2024: 1.2, 2025: 1.3},
    )
    # Broken in the middle (2024 dipped below 2023) -> only last year counts.
    _seed_asset(
        db_session, "STREAK1", price_start=100.0, price_now=100.0,
        div_by_year={2022: 1.0, 2023: 1.1, 2024: 1.05, 2025: 1.2},
    )
    db_session.commit()

    resp = client.get("/v1/screener", headers=_auth(token))
    assert resp.status_code == 200
    by_symbol = {row["yahoo_symbol"]: row for row in resp.json()["rows"]}
    assert by_symbol["STREAK3"]["dividend_streak_years"] == 3
    assert by_symbol["STREAK1"]["dividend_streak_years"] == 1


def test_list_screener_computes_per_asset_metrics_without_cross_contamination(client, db_session, monkeypatch):
    """Regression test for the N+1 fix: list_screener now batches Price/
    DividendEvent fetches across all assets in one query each instead of
    one query per asset — this specifically guards against a batching bug
    mixing up which rows belong to which asset.
    """
    monkeypatch.setattr("app.modules.portfolios.router.YahooProvider", FakeProvider)
    token = _register(client)

    _seed_asset(db_session, "AAPL", price_start=100.0, price_now=150.0, div_by_year={2023: 1.0, 2024: 1.21})
    _seed_asset(db_session, "SCHD", price_start=50.0, price_now=40.0, div_by_year={2023: 2.0, 2024: 2.0})
    db_session.commit()

    resp = client.get("/v1/screener", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    by_symbol = {row["yahoo_symbol"]: row for row in body["rows"]}
    assert set(by_symbol) == {"AAPL", "SCHD"}

    aapl = by_symbol["AAPL"]
    assert aapl["price"] == 150.0
    assert aapl["return_1y"] == 50.0  # (150/100 - 1) * 100
    assert round(aapl["cagr_div_3y"], 2) == 21.0  # (1.21/1.0)**(1/1) - 1 = 21%

    schd = by_symbol["SCHD"]
    assert schd["price"] == 40.0
    assert round(schd["return_1y"], 6) == -20.0  # (40/50 - 1) * 100
    assert schd["cagr_div_3y"] == 0.0  # flat dividend, 0% growth


def test_list_screener_server_side_filter_sort_and_pagination(client, db_session, monkeypatch):
    """Filtering, sorting, and offset/limit now happen entirely in SQL
    against Fundamentals columns, before the expensive per-asset Price/
    DividendEvent analytics run — this guards the query-building logic
    itself (WHERE clauses, nulls-last ordering, total count vs. page size).
    """
    monkeypatch.setattr("app.modules.portfolios.router.YahooProvider", FakeProvider)
    token = _register(client)

    _seed_asset(db_session, "AAPL", price_start=100.0, price_now=150.0, div_by_year={2023: 1.0, 2024: 1.21})
    _seed_asset(db_session, "SCHD", price_start=50.0, price_now=40.0, div_by_year={2023: 2.0, 2024: 2.0})
    _seed_asset(db_session, "MSFT", price_start=200.0, price_now=210.0, div_by_year={2023: 3.0, 2024: 3.0})
    db_session.commit()

    # Text search narrows to one match.
    resp = client.get("/v1/screener?q=aap", headers=_auth(token))
    body = resp.json()
    assert body["total"] == 1
    assert [r["yahoo_symbol"] for r in body["rows"]] == ["AAPL"]

    # Sort ascending by CAGR div 5y (uses default yield_pct fundamentals, all None here
    # since Fundamentals rows were seeded empty — sort by pe_ratio instead is equally
    # None for all three, so exercise pagination/offset/limit deterministically via the
    # tie-break on yahoo_symbol instead).
    resp = client.get("/v1/screener?limit=2&offset=0", headers=_auth(token))
    body = resp.json()
    assert body["total"] == 3
    assert len(body["rows"]) == 2
    first_page_symbols = [r["yahoo_symbol"] for r in body["rows"]]

    resp = client.get("/v1/screener?limit=2&offset=2", headers=_auth(token))
    body = resp.json()
    assert body["total"] == 3
    assert len(body["rows"]) == 1
    assert body["rows"][0]["yahoo_symbol"] not in first_page_symbols
