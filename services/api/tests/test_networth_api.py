from __future__ import annotations

from datetime import date, timedelta

from app.models.market import FxRate
from app.modules.ingestion.providers.base import Provider, QuoteResult


class FakeProvider(Provider):
    """No price history ingestion (get_history -> []), so the only price
    anchor for the asset is the transaction's own price — value stays flat
    at qty*price for every sample date, which makes the expected combined
    value fully predictable in the test below.
    """

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
    resp = client.post("/v1/auth/register", json={"email": "networth-test@example.com", "password": "SuperSecret123!"})
    assert resp.status_code == 201
    return resp.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_networth_history_converts_with_the_rate_at_each_date(client, db_session, monkeypatch):
    monkeypatch.setattr("app.modules.portfolios.router.YahooProvider", FakeProvider)
    token = _register_and_login(client)

    purchase_date = date.today() - timedelta(days=200)
    portfolio_id = client.post(
        "/v1/portfolios", json={"name": "USA", "currency": "USD"}, headers=_auth(token)
    ).json()["id"]
    client.post(
        f"/v1/portfolios/{portfolio_id}/transactions",
        json={"yahoo_symbol": "AAPL", "type": "buy", "trade_date": purchase_date.isoformat(), "quantity": 10, "price": 100.0},
        headers=_auth(token),
    )

    # Two very different USD/CLP rates: one dated the purchase, one dated
    # today. If the endpoint used "today's" rate for every point (the bug
    # this feature fixes), the purchase-date point would be wrong.
    db_session.add_all(
        [
            FxRate(base="USD", quote="CLP", date=purchase_date, rate=800.0, source="yahoo"),
            FxRate(base="USD", quote="CLP", date=date.today(), rate=1000.0, source="yahoo"),
        ]
    )
    db_session.commit()

    resp = client.get("/v1/networth/history?currency=CLP&range=1A", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()

    assert body["currency"] == "CLP"
    assert body["start_date"] == purchase_date.isoformat()
    assert body["points"][0]["date"] == purchase_date.isoformat()
    assert body["points"][-1]["date"] == date.today().isoformat()

    # 10 shares * $100 = $1,000 USD, converted at THAT date's rate.
    assert body["points"][0]["value"] == 1000 * 800.0
    assert body["points"][-1]["value"] == 1000 * 1000.0


def test_networth_history_empty_with_no_portfolios(client):
    token = _register_and_login(client)
    resp = client.get("/v1/networth/history", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["points"] == []
