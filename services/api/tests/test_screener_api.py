from __future__ import annotations

from datetime import date

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
