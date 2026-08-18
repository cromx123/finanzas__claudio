from __future__ import annotations

from datetime import date

from sqlalchemy import select

from app.models.market import DividendEvent, DividendFrequency, DividendStatus
from app.models.portfolio import Asset
from app.modules.ingestion.providers.base import Provider, QuoteResult


class FakeProvider(Provider):
    def get_quote(self, symbol: str) -> QuoteResult | None:
        return None

    def get_history(self, symbol: str, period: str = "3y") -> list[QuoteResult]:
        return []

    def get_fundamentals(self, symbol: str) -> dict:
        return {"longName": f"{symbol} Inc.", "sector": "Technology", "quoteType": "EQUITY"}

    def get_dividends(self, symbol: str) -> list[dict]:
        return []

    def search(self, query: str):
        return []


def _register_and_login(client) -> str:
    resp = client.post("/v1/auth/register", json={"email": "movements-test@example.com", "password": "SuperSecret123!"})
    assert resp.status_code == 201
    return resp.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_movements_combine_buy_sell_and_paid_dividends(client, db_session, monkeypatch):
    monkeypatch.setattr("app.modules.portfolios.router.YahooProvider", FakeProvider)
    token = _register_and_login(client)

    portfolio_id = client.post(
        "/v1/portfolios", json={"name": "Dividendos Chile", "currency": "CLP"}, headers=_auth(token)
    ).json()["id"]
    client.post(
        f"/v1/portfolios/{portfolio_id}/transactions",
        json={"yahoo_symbol": "CHILE.SN", "type": "buy", "trade_date": "2026-01-15", "quantity": 100, "price": 90.0},
        headers=_auth(token),
    )
    client.post(
        f"/v1/portfolios/{portfolio_id}/transactions",
        json={"yahoo_symbol": "CHILE.SN", "type": "sell", "trade_date": "2026-02-15", "quantity": 20, "price": 95.0},
        headers=_auth(token),
    )

    asset = db_session.scalar(select(Asset).where(Asset.yahoo_symbol == "CHILE.SN"))
    db_session.add(
        DividendEvent(
            asset_id=asset.id,
            ex_date=date(2026, 3, 1),
            amount_per_share=2.0,
            currency="CLP",
            status=DividendStatus.DECLARED,
            frequency=DividendFrequency.QUARTERLY,
        )
    )
    db_session.commit()

    resp = client.get("/v1/movements", headers=_auth(token))
    assert resp.status_code == 200
    rows = resp.json()
    kinds = sorted(r["kind"] for r in rows)
    assert kinds == ["buy", "dividend", "sell"]

    # newest first
    dates = [r["date"] for r in rows]
    assert dates == sorted(dates, reverse=True)

    dividend_row = next(r for r in rows if r["kind"] == "dividend")
    assert dividend_row["yahoo_symbol"] == "CHILE.SN"
    assert dividend_row["quantity"] == 80  # current holding qty (100 bought - 20 sold)
    assert dividend_row["total"] == 80 * 2.0
