from __future__ import annotations

from datetime import date

from app.modules.ingestion.providers.base import Provider, QuoteResult


class FakeFxProvider(Provider):
    """Fixed USD/CLP and EUR/CLP quotes dated today — no network calls.
    Dating it "today" (rather than a fixed date) keeps it on the same
    FxRate row as fx_service.set_rate's date.today(), regardless of when
    the suite runs.
    """

    _RATES = {"USDCLP=X": 950.0, "EURCLP=X": 1020.0}

    def get_quote(self, symbol: str) -> QuoteResult | None:
        rate = self._RATES.get(symbol)
        if rate is None:
            return None
        return QuoteResult(symbol=symbol, date=date.today(), close=rate)

    def get_history(self, symbol: str, period: str = "3y") -> list[QuoteResult]:
        return []

    def get_fundamentals(self, symbol: str) -> dict:
        return {}

    def get_dividends(self, symbol: str) -> list[dict]:
        return []

    def search(self, query: str):
        return []


def _register(client) -> str:
    resp = client.post("/v1/auth/register", json={"email": "fx-test@example.com", "password": "SuperSecret123!"})
    assert resp.status_code == 201
    return resp.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_refresh_rates_pulls_latest_quote_from_yahoo(client, monkeypatch):
    monkeypatch.setattr("app.modules.fx.router.YahooProvider", FakeFxProvider)
    token = _register(client)

    resp = client.post("/v1/fx-rates/refresh", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json() == {"CLP": 1.0, "USD": 950.0, "EUR": 1020.0}

    detail = client.get("/v1/fx-rates/detail", headers=_auth(token)).json()
    assert detail["USD"]["source"] == "yahoo"
    assert detail["USD"]["rate"] == 950.0
    assert detail["USD"]["as_of"] == date.today().isoformat()


def test_manual_override_beats_yahoo_until_refreshed_again(client, monkeypatch):
    monkeypatch.setattr("app.modules.fx.router.YahooProvider", FakeFxProvider)
    token = _register(client)

    client.post("/v1/fx-rates/refresh", headers=_auth(token))
    client.put("/v1/fx-rates", json={"currency": "USD", "rate_to_clp": 999.0}, headers=_auth(token))

    detail = client.get("/v1/fx-rates/detail", headers=_auth(token)).json()
    assert detail["USD"]["source"] == "manual"
    assert detail["USD"]["rate"] == 999.0

    # a later refresh from Yahoo takes back over for today's rate
    client.post("/v1/fx-rates/refresh", headers=_auth(token))
    detail = client.get("/v1/fx-rates/detail", headers=_auth(token)).json()
    assert detail["USD"]["source"] == "yahoo"
    assert detail["USD"]["rate"] == 950.0
