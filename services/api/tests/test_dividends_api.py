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
        return {"longName": f"{symbol} Inc.", "sector": "Financial Services", "quoteType": "EQUITY"}

    def get_dividends(self, symbol: str) -> list[dict]:
        return []

    def search(self, query: str):
        return []

    def get_price_on(self, symbol: str, on: date) -> QuoteResult | None:
        return None


def _register_and_login(client) -> str:
    resp = client.post("/v1/auth/register", json={"email": "dividends-test@example.com", "password": "SuperSecret123!"})
    assert resp.status_code == 201
    return resp.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_calendar_paid_event_is_not_inflated_by_shares_bought_afterward(client, db_session, monkeypatch):
    """CHILE.SN pays once a year. Buy 100 shares, collect that year's
    dividend, then buy 100 more — the already-paid event must still show
    100 shares (what you actually held on the ex_date), not 200.
    """
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

    asset = db_session.scalar(select(Asset).where(Asset.yahoo_symbol == "CHILE.SN"))
    db_session.add(
        DividendEvent(
            asset_id=asset.id,
            ex_date=date(2026, 3, 1),
            amount_per_share=2.0,
            currency="CLP",
            status=DividendStatus.DECLARED,
            frequency=DividendFrequency.ANNUAL,
        )
    )
    db_session.commit()

    # Bought after the dividend was already paid.
    client.post(
        f"/v1/portfolios/{portfolio_id}/transactions",
        json={"yahoo_symbol": "CHILE.SN", "type": "buy", "trade_date": "2026-06-01", "quantity": 100, "price": 95.0},
        headers=_auth(token),
    )

    resp = client.get(f"/v1/dividends/calendar?portfolio_id={portfolio_id}&year=2026", headers=_auth(token))
    assert resp.status_code == 200
    events = resp.json()["events"]
    paid = [e for e in events if e["estado"] == "Pagado"]
    assert len(paid) == 1
    assert paid[0]["quantity"] == 100  # not 200
    assert paid[0]["total_bruto"] == 100 * 2.0


def test_calendar_future_estimate_uses_current_holding(client, db_session, monkeypatch):
    """The projected/estimated future event, unlike the paid one, should
    reflect the current (larger) holding — that's the best forward guess."""
    monkeypatch.setattr("app.modules.portfolios.router.YahooProvider", FakeProvider)
    token = _register_and_login(client)
    portfolio_id = client.post(
        "/v1/portfolios", json={"name": "Dividendos Chile", "currency": "CLP"}, headers=_auth(token)
    ).json()["id"]
    client.post(
        f"/v1/portfolios/{portfolio_id}/transactions",
        json={"yahoo_symbol": "CHILE.SN", "type": "buy", "trade_date": "2025-01-15", "quantity": 100, "price": 90.0},
        headers=_auth(token),
    )

    asset = db_session.scalar(select(Asset).where(Asset.yahoo_symbol == "CHILE.SN"))
    db_session.add(
        DividendEvent(
            asset_id=asset.id,
            ex_date=date(2025, 3, 1),
            amount_per_share=2.0,
            currency="CLP",
            status=DividendStatus.DECLARED,
            frequency=DividendFrequency.ANNUAL,
        )
    )
    db_session.commit()
    client.post(
        f"/v1/portfolios/{portfolio_id}/transactions",
        json={"yahoo_symbol": "CHILE.SN", "type": "buy", "trade_date": "2025-06-01", "quantity": 100, "price": 95.0},
        headers=_auth(token),
    )

    # Ask for next year's calendar: the only event is the ~annual projection.
    resp = client.get(f"/v1/dividends/calendar?portfolio_id={portfolio_id}&year=2026", headers=_auth(token))
    assert resp.status_code == 200
    events = resp.json()["events"]
    assert len(events) == 1
    assert events[0]["estado"] == "Estimado"
    assert events[0]["quantity"] == 200  # current holding, both buys
