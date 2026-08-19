from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import select

from app.models.market import Price
from app.models.portfolio import Asset
from app.modules.alerts.service import check_alerts
from app.modules.ingestion.providers.base import Provider, QuoteResult


class FakeProvider(Provider):
    """No network calls: get_quote/get_history return nothing, so a fresh
    alert's asset has no seeded price yet (tests set one directly on
    db_session when a price is needed — see test_movements_api.py)."""

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


def _register_and_login(client, email: str = "alerts-test@example.com") -> str:
    resp = client.post("/v1/auth/register", json={"email": email, "password": "SuperSecret123!"})
    assert resp.status_code == 201
    return resp.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_create_list_and_delete_alert(client, monkeypatch):
    monkeypatch.setattr("app.modules.alerts.router.YahooProvider", FakeProvider)
    token = _register_and_login(client)

    resp = client.post(
        "/v1/alerts", json={"yahoo_symbol": "AAPL", "condition": "price_below", "threshold": 150.0}, headers=_auth(token)
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["asset"]["yahoo_symbol"] == "AAPL"
    assert body["condition"] == "price_below"
    assert body["threshold"] == 150.0
    assert body["active"] is True
    assert body["triggered_at"] is None
    alert_id = body["id"]

    listed = client.get("/v1/alerts", headers=_auth(token)).json()
    assert len(listed) == 1
    assert listed[0]["id"] == alert_id

    resp = client.delete(f"/v1/alerts/{alert_id}", headers=_auth(token))
    assert resp.status_code == 204
    assert client.get("/v1/alerts", headers=_auth(token)).json() == []


def test_alert_on_unrecognized_ticker_is_rejected(client, monkeypatch):
    monkeypatch.setattr("app.modules.alerts.router.YahooProvider", FakeProvider)
    token = _register_and_login(client)

    resp = client.post(
        "/v1/alerts", json={"yahoo_symbol": "WEIRD.XX", "condition": "price_below", "threshold": 10.0}, headers=_auth(token)
    )
    assert resp.status_code == 422


def test_alerts_scoped_to_owner(client, monkeypatch):
    monkeypatch.setattr("app.modules.alerts.router.YahooProvider", FakeProvider)
    token_a = _register_and_login(client, "alerts-a@example.com")
    token_b = _register_and_login(client, "alerts-b@example.com")

    resp = client.post(
        "/v1/alerts", json={"yahoo_symbol": "AAPL", "condition": "price_below", "threshold": 150.0}, headers=_auth(token_a)
    )
    alert_id = resp.json()["id"]

    assert client.get("/v1/alerts", headers=_auth(token_b)).json() == []

    # Deleting someone else's alert 404s, same as a missing one — mirrors
    # the owned-resource pattern portfolios/transactions already use.
    resp = client.delete(f"/v1/alerts/{alert_id}", headers=_auth(token_b))
    assert resp.status_code == 404
    assert len(client.get("/v1/alerts", headers=_auth(token_a)).json()) == 1


def test_check_alerts_triggers_and_deactivates(client, db_session, monkeypatch):
    monkeypatch.setattr("app.modules.alerts.router.YahooProvider", FakeProvider)
    token = _register_and_login(client)

    below = client.post(
        "/v1/alerts", json={"yahoo_symbol": "AAPL", "condition": "price_below", "threshold": 150.0}, headers=_auth(token)
    ).json()
    above = client.post(
        "/v1/alerts", json={"yahoo_symbol": "AAPL", "condition": "price_above", "threshold": 200.0}, headers=_auth(token)
    ).json()

    asset = db_session.scalar(select(Asset).where(Asset.yahoo_symbol == "AAPL"))
    db_session.add(Price(asset_id=asset.id, date=date.today(), close=140.0))
    db_session.commit()

    check_alerts(db_session)

    listed = {a["id"]: a for a in client.get("/v1/alerts", headers=_auth(token)).json()}
    # 140 <= 150 -> triggers; 140 >= 200 -> does not.
    assert listed[below["id"]]["active"] is False
    assert listed[below["id"]]["triggered_at"] == date.today().isoformat()
    assert listed[above["id"]]["active"] is True
    assert listed[above["id"]]["triggered_at"] is None


def test_alert_with_unknown_condition_is_rejected(client, monkeypatch):
    monkeypatch.setattr("app.modules.alerts.router.YahooProvider", FakeProvider)
    token = _register_and_login(client)

    resp = client.post(
        "/v1/alerts", json={"yahoo_symbol": "AAPL", "condition": "moon_phase", "threshold": 1.0}, headers=_auth(token)
    )
    assert resp.status_code == 422


def test_rsi_alert_triggers_when_oversold(client, db_session, monkeypatch):
    monkeypatch.setattr("app.modules.alerts.router.YahooProvider", FakeProvider)
    token = _register_and_login(client)

    alert = client.post(
        "/v1/alerts",
        json={"yahoo_symbol": "AAPL", "condition": "rsi_below", "threshold": 30.0, "params": {"period": 14}},
        headers=_auth(token),
    ).json()

    # A steady decline for 20 days: every daily change is a loss, no gains
    # at all -> RSI settles at exactly 0, deep "oversold" territory.
    asset = db_session.scalar(select(Asset).where(Asset.yahoo_symbol == "AAPL"))
    start = date(2026, 1, 1)
    for i in range(20):
        db_session.add(Price(asset_id=asset.id, date=start + timedelta(days=i), close=130.0 - i))
    db_session.commit()

    check_alerts(db_session)

    listed = client.get("/v1/alerts", headers=_auth(token)).json()
    updated = next(a for a in listed if a["id"] == alert["id"])
    assert updated["active"] is False
    assert updated["current_value"] == 0.0


def test_bollinger_alert_triggers_on_lower_band_cross(client, db_session, monkeypatch):
    monkeypatch.setattr("app.modules.alerts.router.YahooProvider", FakeProvider)
    token = _register_and_login(client)

    # Bollinger doesn't need a threshold — crossing the band is the trigger.
    alert = client.post(
        "/v1/alerts",
        json={"yahoo_symbol": "AAPL", "condition": "bollinger_lower_cross", "params": {"period": 20, "stddev": 2}},
        headers=_auth(token),
    ).json()
    assert alert["threshold"] is None

    # 19 flat days at 100, then a sharp drop to 80 on the 20th (last) day —
    # the drop lands well below the lower band computed from the window.
    asset = db_session.scalar(select(Asset).where(Asset.yahoo_symbol == "AAPL"))
    start = date(2026, 1, 1)
    for i in range(19):
        db_session.add(Price(asset_id=asset.id, date=start + timedelta(days=i), close=100.0))
    db_session.add(Price(asset_id=asset.id, date=start + timedelta(days=19), close=80.0))
    db_session.commit()

    check_alerts(db_session)

    listed = client.get("/v1/alerts", headers=_auth(token)).json()
    updated = next(a for a in listed if a["id"] == alert["id"])
    assert updated["active"] is False
    assert updated["current_value"] == 80.0
