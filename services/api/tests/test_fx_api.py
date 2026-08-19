from __future__ import annotations

from datetime import date

from app.modules.ingestion.providers.base import Provider, QuoteResult


class FakeFxProvider(Provider):
    """Fixed USD/CLP and EUR/CLP quotes dated today — no network calls.
    Dating it "today" (rather than a fixed date) keeps it on the same
    FxRate row as fx_service.set_rate's date.today(), regardless of when
    the suite runs.
    """

    _RATES = {"USDCLP=X": 950.0, "EURCLP=X": 1020.0, "JPYCLP=X": 6.4}

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

    def get_price_on(self, symbol: str, on: date) -> QuoteResult | None:
        return None


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
    assert resp.json() == {"CLP": 1.0, "USD": 950.0, "EUR": 1020.0, "JPY": 6.4}

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


def test_get_rate_on_date_looks_up_asof_not_latest(db_session):
    from app.models.market import FxRate
    from app.modules.fx.service import get_rate_on_date, get_rates_on_dates

    db_session.add_all(
        [
            FxRate(base="USD", quote="CLP", date=date(2026, 1, 1), rate=800.0, source="yahoo"),
            FxRate(base="USD", quote="CLP", date=date(2026, 6, 1), rate=900.0, source="yahoo"),
            FxRate(base="USD", quote="CLP", date=date(2026, 8, 1), rate=950.0, source="yahoo"),
        ]
    )
    db_session.commit()

    assert get_rate_on_date(db_session, "USD", date(2026, 6, 1)) == 900.0  # exact match
    assert get_rate_on_date(db_session, "USD", date(2026, 7, 15)) == 900.0  # between two known dates
    assert get_rate_on_date(db_session, "USD", date(2026, 12, 1)) == 950.0  # after the last known date
    # Before the first known date: falls back to the earliest known rate,
    # never fabricates history further back than what was actually ingested.
    assert get_rate_on_date(db_session, "USD", date(2025, 1, 1)) == 800.0
    assert get_rate_on_date(db_session, "EUR", date(2026, 1, 1)) == 1050.0  # no history at all -> seed default
    assert get_rate_on_date(db_session, "CLP", date(2020, 1, 1)) == 1.0  # CLP is always 1, any date

    batch = get_rates_on_dates(db_session, "USD", [date(2026, 1, 1), date(2026, 6, 1), date(2026, 12, 1)])
    assert batch == {date(2026, 1, 1): 800.0, date(2026, 6, 1): 900.0, date(2026, 12, 1): 950.0}
