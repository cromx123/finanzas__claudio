from __future__ import annotations

from datetime import date

from app.modules.ingestion.providers.base import Provider, QuoteResult


class FakeProvider(Provider):
    def get_quote(self, symbol: str) -> QuoteResult | None:
        return None

    def get_history(self, symbol: str, period: str = "5y") -> list[QuoteResult]:
        return []

    def get_fundamentals(self, symbol: str) -> dict:
        return {"longName": f"{symbol} Inc.", "sector": "Technology", "quoteType": "EQUITY"}

    def get_dividends(self, symbol: str) -> list[dict]:
        return []

    def search(self, query: str):
        return []

    def get_price_on(self, symbol: str, on: date) -> QuoteResult | None:
        return None


def _register_and_login(client) -> str:
    resp = client.post("/v1/auth/register", json={"email": "export-test@example.com", "password": "SuperSecret123!"})
    assert resp.status_code == 201
    return resp.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_export_all_bundles_every_owned_resource(client, monkeypatch):
    """One export endpoint should reflect exactly what a user has across
    portfolios/transactions, goals, alerts, tags (incl. target_weight), and
    holding-tag assignments — reusing each module's own list_* functions
    rather than a second, independently-written query path.
    """
    monkeypatch.setattr("app.modules.portfolios.router.YahooProvider", FakeProvider)
    monkeypatch.setattr("app.modules.alerts.router.YahooProvider", FakeProvider)
    token = _register_and_login(client)

    portfolio_id = client.post(
        "/v1/portfolios", json={"name": "USA", "currency": "USD"}, headers=_auth(token)
    ).json()["id"]
    client.post(
        f"/v1/portfolios/{portfolio_id}/transactions",
        json={"yahoo_symbol": "AAPL", "type": "buy", "trade_date": "2026-01-10", "quantity": 10, "price": 150.0},
        headers=_auth(token),
    )

    client.post(
        "/v1/goals/custom",
        json={"name": "Viaje", "target_amount": 2000.0, "currency": "USD"},
        headers=_auth(token),
    )

    client.post(
        "/v1/alerts", json={"yahoo_symbol": "AAPL", "condition": "price_below", "threshold": 100.0}, headers=_auth(token)
    )

    client.post("/v1/tags", json={"label": "DGI"}, headers=_auth(token))
    client.patch("/v1/tags/DGI", json={"target_weight": 40.0}, headers=_auth(token))

    holdings = client.get(f"/v1/portfolios/{portfolio_id}/summary", headers=_auth(token)).json()["holdings"]
    asset_id = holdings[0]["asset"]["id"]
    client.put(f"/v1/portfolios/{portfolio_id}/holdings/{asset_id}/tags", json={"tags": ["DGI"]}, headers=_auth(token))

    resp = client.get("/v1/export/all", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()

    assert len(body["portfolios"]) == 1
    portfolio = body["portfolios"][0]
    assert portfolio["name"] == "USA"
    assert len(portfolio["transactions"]) == 1
    assert portfolio["transactions"][0]["yahoo_symbol"] == "AAPL"
    assert portfolio["transactions"][0]["quantity"] == 10.0

    assert any(g["name"] == "Viaje" and g["target_amount"] == 2000.0 for g in body["goals"])

    assert len(body["alerts"]) == 1
    assert body["alerts"][0]["yahoo_symbol"] == "AAPL"
    assert body["alerts"][0]["condition"] == "price_below"

    assert body["tags"] == [{"label": "DGI", "target_weight": 40.0}]

    assert len(body["holding_tags"]) == 1
    assert body["holding_tags"][0]["yahoo_symbol"] == "AAPL"
    assert body["holding_tags"][0]["tag"] == "DGI"
    assert body["holding_tags"][0]["portfolio_id"] == portfolio_id


def test_export_all_scoped_to_owner(client, monkeypatch):
    monkeypatch.setattr("app.modules.portfolios.router.YahooProvider", FakeProvider)
    token_a = client.post(
        "/v1/auth/register", json={"email": "export-a@example.com", "password": "SuperSecret123!"}
    ).json()["access_token"]
    token_b = client.post(
        "/v1/auth/register", json={"email": "export-b@example.com", "password": "SuperSecret123!"}
    ).json()["access_token"]

    client.post("/v1/portfolios", json={"name": "A's portfolio", "currency": "USD"}, headers=_auth(token_a))

    resp = client.get("/v1/export/all", headers=_auth(token_b))
    assert resp.status_code == 200
    assert resp.json()["portfolios"] == []
