from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import select

from app.models.market import DividendEvent, DividendFrequency, DividendStatus
from app.models.portfolio import Asset
from app.modules.ingestion.providers.base import Provider, QuoteResult


class FakeProvider(Provider):
    """No network calls: get_quote returns None (no live price seeded, so
    tests never touch the market-schema Price table, which SQLite can't
    create — see conftest.py), get_fundamentals returns a minimal profile.
    """

    def get_quote(self, symbol: str) -> QuoteResult | None:
        return None

    def get_history(self, symbol: str, period: str = "3y") -> list[QuoteResult]:
        if symbol == "^GSPC":
            today = date.today()
            return [
                QuoteResult(symbol=symbol, date=today - timedelta(days=400), close=4700.0),
                QuoteResult(symbol=symbol, date=today - timedelta(days=200), close=5300.0),
                QuoteResult(symbol=symbol, date=today, close=5900.0),
            ]
        return []

    def get_fundamentals(self, symbol: str) -> dict:
        return {"longName": f"{symbol} Inc.", "sector": "Technology", "quoteType": "EQUITY"}

    def get_dividends(self, symbol: str) -> list[dict]:
        return []

    def search(self, query: str):
        return []

    def get_price_on(self, symbol: str, on: date) -> QuoteResult | None:
        return QuoteResult(symbol=symbol, date=on, close=123.45)


def _register_and_login(client) -> str:
    resp = client.post(
        "/v1/auth/register", json={"email": "portfolios-test@example.com", "password": "SuperSecret123!"}
    )
    assert resp.status_code == 201
    return resp.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_create_portfolio_and_add_buy_transaction(client, monkeypatch):
    monkeypatch.setattr("app.modules.portfolios.router.YahooProvider", FakeProvider)
    token = _register_and_login(client)

    resp = client.post("/v1/portfolios", json={"name": "Dividendos Chile", "currency": "CLP"}, headers=_auth(token))
    assert resp.status_code == 201
    portfolio_id = resp.json()["id"]

    resp = client.post(
        f"/v1/portfolios/{portfolio_id}/transactions",
        json={"yahoo_symbol": "CHILE.SN", "type": "buy", "trade_date": "2026-03-15", "quantity": 25000, "price": 98.5},
        headers=_auth(token),
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["asset"]["yahoo_symbol"] == "CHILE.SN"
    assert body["gross_amount"] == 25000 * 98.5

    summary = client.get(f"/v1/portfolios/{portfolio_id}/summary", headers=_auth(token)).json()
    assert len(summary["holdings"]) == 1
    holding = summary["holdings"][0]
    assert holding["quantity"] == 25000
    assert holding["avg_cost"] == 98.5
    # No live quote available (FakeProvider.get_quote -> None), so the mark
    # price falls back to average cost — no G/P until a real quote lands.
    assert holding["price"] == 98.5
    assert summary["aportes"] == 25000 * 98.5
    assert summary["compras_totales"] == 25000 * 98.5


def test_buying_asset_in_wrong_currency_is_rejected(client, monkeypatch):
    monkeypatch.setattr("app.modules.portfolios.router.YahooProvider", FakeProvider)
    token = _register_and_login(client)
    portfolio_id = client.post(
        "/v1/portfolios", json={"name": "Dividendos Chile", "currency": "CLP"}, headers=_auth(token)
    ).json()["id"]

    # SCHD has no suffix -> resolves to the US market (USD), but the
    # portfolio above is CLP-denominated.
    resp = client.post(
        f"/v1/portfolios/{portfolio_id}/transactions",
        json={"yahoo_symbol": "SCHD", "type": "buy", "trade_date": "2026-04-01", "quantity": 10, "price": 80.0},
        headers=_auth(token),
    )
    assert resp.status_code == 422
    assert "USD" in resp.json()["detail"]


def test_sell_more_than_owned_is_rejected(client, monkeypatch):
    monkeypatch.setattr("app.modules.portfolios.router.YahooProvider", FakeProvider)
    token = _register_and_login(client)
    portfolio_id = client.post(
        "/v1/portfolios", json={"name": "Global Dividendos", "currency": "USD"}, headers=_auth(token)
    ).json()["id"]
    client.post(
        f"/v1/portfolios/{portfolio_id}/transactions",
        json={"yahoo_symbol": "SCHD", "type": "buy", "trade_date": "2026-04-01", "quantity": 100, "price": 82.9},
        headers=_auth(token),
    )

    resp = client.post(
        f"/v1/portfolios/{portfolio_id}/transactions",
        json={"yahoo_symbol": "SCHD", "type": "sell", "trade_date": "2026-05-01", "quantity": 200, "price": 85.0},
        headers=_auth(token),
    )
    assert resp.status_code == 409


def test_realized_pl_and_delete_transaction_reverts_ledger(client, monkeypatch):
    monkeypatch.setattr("app.modules.portfolios.router.YahooProvider", FakeProvider)
    token = _register_and_login(client)
    portfolio_id = client.post(
        "/v1/portfolios", json={"name": "Global Dividendos", "currency": "USD"}, headers=_auth(token)
    ).json()["id"]
    client.post(
        f"/v1/portfolios/{portfolio_id}/transactions",
        json={"yahoo_symbol": "SCHD", "type": "buy", "trade_date": "2026-04-01", "quantity": 100, "price": 80.0},
        headers=_auth(token),
    )
    sell = client.post(
        f"/v1/portfolios/{portfolio_id}/transactions",
        json={"yahoo_symbol": "SCHD", "type": "sell", "trade_date": "2026-05-01", "quantity": 40, "price": 90.0},
        headers=_auth(token),
    )
    assert sell.status_code == 201
    sell_id = sell.json()["id"]

    summary = client.get(f"/v1/portfolios/{portfolio_id}/summary", headers=_auth(token)).json()
    assert summary["gp_realizada"] == 40 * 90.0 - 40 * 80.0
    assert summary["holdings"][0]["quantity"] == 60

    resp = client.delete(f"/v1/portfolios/{portfolio_id}/transactions/{sell_id}", headers=_auth(token))
    assert resp.status_code == 204

    summary = client.get(f"/v1/portfolios/{portfolio_id}/summary", headers=_auth(token)).json()
    assert summary["gp_realizada"] == 0
    assert summary["holdings"][0]["quantity"] == 100


def test_update_transaction_fixes_a_typo(client, monkeypatch):
    monkeypatch.setattr("app.modules.portfolios.router.YahooProvider", FakeProvider)
    token = _register_and_login(client)
    portfolio_id = client.post(
        "/v1/portfolios", json={"name": "Global Dividendos", "currency": "USD"}, headers=_auth(token)
    ).json()["id"]
    buy = client.post(
        f"/v1/portfolios/{portfolio_id}/transactions",
        json={"yahoo_symbol": "SCHD", "type": "buy", "trade_date": "2026-04-01", "quantity": 100, "price": 80.0},
        headers=_auth(token),
    )
    tx_id = buy.json()["id"]

    # Fix a typo'd price (was 80.0, should've been 8.0) without deleting/re-adding.
    resp = client.patch(
        f"/v1/portfolios/{portfolio_id}/transactions/{tx_id}",
        json={"trade_date": "2026-04-01", "quantity": 100, "price": 8.0},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["price"] == 8.0
    assert body["gross_amount"] == 800.0

    summary = client.get(f"/v1/portfolios/{portfolio_id}/summary", headers=_auth(token)).json()
    assert summary["holdings"][0]["avg_cost"] == 8.0


def test_update_transaction_cannot_oversell(client, monkeypatch):
    monkeypatch.setattr("app.modules.portfolios.router.YahooProvider", FakeProvider)
    token = _register_and_login(client)
    portfolio_id = client.post(
        "/v1/portfolios", json={"name": "Global Dividendos", "currency": "USD"}, headers=_auth(token)
    ).json()["id"]
    client.post(
        f"/v1/portfolios/{portfolio_id}/transactions",
        json={"yahoo_symbol": "SCHD", "type": "buy", "trade_date": "2026-04-01", "quantity": 100, "price": 80.0},
        headers=_auth(token),
    )
    sell = client.post(
        f"/v1/portfolios/{portfolio_id}/transactions",
        json={"yahoo_symbol": "SCHD", "type": "sell", "trade_date": "2026-05-01", "quantity": 40, "price": 90.0},
        headers=_auth(token),
    )
    sell_id = sell.json()["id"]

    # Only 100 were ever bought — bumping the sell to 150 is not fixable.
    resp = client.patch(
        f"/v1/portfolios/{portfolio_id}/transactions/{sell_id}",
        json={"trade_date": "2026-05-01", "quantity": 150, "price": 90.0},
        headers=_auth(token),
    )
    assert resp.status_code == 409

    # Editing its own 40 shares back down to a smaller sell is fine (excludes
    # itself from the "owned" check).
    resp = client.patch(
        f"/v1/portfolios/{portfolio_id}/transactions/{sell_id}",
        json={"trade_date": "2026-05-01", "quantity": 40, "price": 95.0},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["price"] == 95.0


def test_portfolio_scoped_to_owner(client, monkeypatch):
    monkeypatch.setattr("app.modules.portfolios.router.YahooProvider", FakeProvider)
    token_a = _register_and_login(client)
    resp = client.post("/v1/portfolios", json={"name": "A", "currency": "CLP"}, headers=_auth(token_a))
    portfolio_id = resp.json()["id"]

    token_b = client.post(
        "/v1/auth/register", json={"email": "other-user@example.com", "password": "SuperSecret123!"}
    ).json()["access_token"]
    resp = client.get(f"/v1/portfolios/{portfolio_id}/summary", headers=_auth(token_b))
    assert resp.status_code == 404


def test_country_allocation_aggregates_across_portfolios(client, monkeypatch):
    monkeypatch.setattr("app.modules.portfolios.router.YahooProvider", FakeProvider)
    token = _register_and_login(client)

    clp_portfolio = client.post(
        "/v1/portfolios", json={"name": "Chile", "currency": "CLP"}, headers=_auth(token)
    ).json()["id"]
    client.post(
        f"/v1/portfolios/{clp_portfolio}/transactions",
        json={"yahoo_symbol": "CHILE.SN", "type": "buy", "trade_date": "2026-03-15", "quantity": 10, "price": 100.0},
        headers=_auth(token),
    )

    usd_portfolio = client.post(
        "/v1/portfolios", json={"name": "USA", "currency": "USD"}, headers=_auth(token)
    ).json()["id"]
    client.post(
        f"/v1/portfolios/{usd_portfolio}/transactions",
        json={"yahoo_symbol": "SCHD", "type": "buy", "trade_date": "2026-04-01", "quantity": 5, "price": 80.0},
        headers=_auth(token),
    )

    resp = client.get("/v1/portfolios/allocation/country", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["currency"] == "CLP"
    by_country = {row["country"]: row["value"] for row in body["rows"]}
    # CHILE.SN resolves to exchange_mic XSGO -> country "CL" (see
    # app/modules/assets/service.py); SCHD -> "US". Values are already in
    # CLP (no cross-currency conversion needed for the CLP portfolio).
    assert by_country["CL"] == 10 * 100.0
    assert by_country["US"] > 0


def test_performance_starts_at_earliest_purchase_and_includes_benchmark(client, monkeypatch):
    monkeypatch.setattr("app.modules.portfolios.router.YahooProvider", FakeProvider)
    token = _register_and_login(client)

    portfolio_id = client.post(
        "/v1/portfolios", json={"name": "USA", "currency": "USD"}, headers=_auth(token)
    ).json()["id"]

    purchase_date = (date.today() - timedelta(days=200)).isoformat()
    client.post(
        f"/v1/portfolios/{portfolio_id}/transactions",
        json={"yahoo_symbol": "AAPL", "type": "buy", "trade_date": purchase_date, "quantity": 10, "price": 150.0},
        headers=_auth(token),
    )

    resp = client.get(f"/v1/portfolios/{portfolio_id}/performance?range=1A", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()

    # Never fabricates history before the first real purchase, even though
    # a 1-year range was requested and the purchase was more recent than that.
    assert body["start_date"] == purchase_date
    assert body["points"][0]["date"] == purchase_date
    # No Price rows were ever ingested for AAPL in this test — the value at
    # the purchase date falls back to the transaction's own recorded price.
    assert body["points"][0]["cartera_value"] == 10 * 150.0
    assert body["points"][-1]["date"] == date.today().isoformat()
    assert body["points"][0]["benchmark_index"] is not None


def test_performance_short_range_samples_daily(client, monkeypatch):
    monkeypatch.setattr("app.modules.portfolios.router.YahooProvider", FakeProvider)
    token = _register_and_login(client)

    portfolio_id = client.post(
        "/v1/portfolios", json={"name": "USA", "currency": "USD"}, headers=_auth(token)
    ).json()["id"]

    purchase_date = date.today() - timedelta(days=5)
    client.post(
        f"/v1/portfolios/{portfolio_id}/transactions",
        json={"yahoo_symbol": "AAPL", "type": "buy", "trade_date": purchase_date.isoformat(), "quantity": 10, "price": 150.0},
        headers=_auth(token),
    )

    resp = client.get(f"/v1/portfolios/{portfolio_id}/performance?range=1W", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()

    # Monthly bucketing (used for 1A/3A/5A) would collapse a 1-week window
    # to a single point — short ranges must sample every calendar day.
    expected_dates = [(purchase_date + timedelta(days=i)).isoformat() for i in range(6)]
    assert [p["date"] for p in body["points"]] == expected_dates


def test_performance_with_no_transactions_is_empty(client, monkeypatch):
    monkeypatch.setattr("app.modules.portfolios.router.YahooProvider", FakeProvider)
    token = _register_and_login(client)

    portfolio_id = client.post(
        "/v1/portfolios", json={"name": "Empty", "currency": "USD"}, headers=_auth(token)
    ).json()["id"]

    resp = client.get(f"/v1/portfolios/{portfolio_id}/performance?range=1A", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["points"] == []


def test_dividends_collected_uses_share_count_held_on_ex_date(client, db_session, monkeypatch):
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
    # Paid before the sell: should count at the full 100 shares held then,
    # not the 80 shares held today.
    db_session.add(
        DividendEvent(
            asset_id=asset.id,
            ex_date=date(2026, 2, 1),
            amount_per_share=2.0,
            currency="CLP",
            status=DividendStatus.DECLARED,
            frequency=DividendFrequency.QUARTERLY,
        )
    )
    # Paid after the sell: counts at the reduced 80-share holding.
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

    summary = client.get(f"/v1/portfolios/{portfolio_id}/summary", headers=_auth(token)).json()
    # 100 shares * 2.0 (before the sell) + 80 shares * 2.0 (after the sell).
    # A naive calc using only the current 80-share holding would give 320.
    assert summary["dividendos_cobrados_bruto"] == 100 * 2.0 + 80 * 2.0
    assert summary["dividendos_cobrados_neto"] == summary["dividendos_cobrados_bruto"]


def test_tags_crud(client):
    token = _register_and_login(client)
    resp = client.post("/v1/tags", json={"label": "DGI"}, headers=_auth(token))
    assert resp.status_code == 201
    assert "DGI" in resp.json()

    resp = client.get("/v1/tags", headers=_auth(token))
    assert resp.json() == ["DGI"]
