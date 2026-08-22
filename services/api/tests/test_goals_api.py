from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta

from app.models.strategy import Goal
from app.modules.ingestion.providers.base import Provider, QuoteResult


class FlatProvider(Provider):
    """No price history (get_history -> []), so an asset's value stays flat
    at qty * purchase price for every sample date — makes patrimonio_total
    fully predictable for the envelope/pace-projection tests below.
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


def _register_and_login(client, email: str = "goals-test@example.com") -> str:
    resp = client.post("/v1/auth/register", json={"email": email, "password": "SuperSecret123!"})
    assert resp.status_code == 201
    return resp.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_upsert_goals_stays_singleton_per_kind(client):
    token = _register_and_login(client)
    client.put(
        "/v1/goals",
        json=[
            {"kind": "monthly_dividends", "target_amount": 300.0, "currency": "USD"},
            {"kind": "cost_coverage", "target_amount": 1800.0, "currency": "USD", "monthly_expenses": 1800.0},
        ],
        headers=_auth(token),
    )
    # Saving again updates in place — still exactly 2 goals, not 4.
    resp = client.put(
        "/v1/goals",
        json=[
            {"kind": "monthly_dividends", "target_amount": 500.0, "currency": "USD"},
            {"kind": "cost_coverage", "target_amount": 2000.0, "currency": "USD", "monthly_expenses": 2000.0},
        ],
        headers=_auth(token),
    )
    assert resp.status_code == 200
    goals = resp.json()
    assert len(goals) == 2
    assert next(g for g in goals if g["kind"] == "monthly_dividends")["target_amount"] == 500.0


def test_custom_goal_crud_and_progress(client):
    token = _register_and_login(client)

    resp = client.post(
        "/v1/goals/custom",
        json={"name": "Viaje a Europa", "target_amount": 2_000_000.0, "currency": "CLP", "target_date": "2027-01-01"},
        headers=_auth(token),
    )
    assert resp.status_code == 201
    goal = resp.json()
    assert goal["name"] == "Viaje a Europa"
    assert goal["kind"] == "net_worth"
    goal_id = goal["id"]

    # Shows up in the plain goals list too (not just the custom-goal path).
    listed = client.get("/v1/goals", headers=_auth(token)).json()
    assert any(g["id"] == goal_id for g in listed)

    # And in progress, with a computed pct (0% since there's no portfolio yet).
    progress = client.get("/v1/goals/progress?currency=CLP", headers=_auth(token)).json()
    custom = next(g for g in progress["custom_goals"] if g["id"] == goal_id)
    assert custom["target_amount"] == 2_000_000.0
    assert custom["current_amount"] == 0.0
    assert custom["pct"] == 0.0
    assert custom["target_date"] == "2027-01-01"

    # Editing it.
    resp = client.patch(
        f"/v1/goals/custom/{goal_id}",
        json={"name": "Viaje a Japón", "target_amount": 3_000_000.0, "currency": "CLP"},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Viaje a Japón"
    assert resp.json()["target_amount"] == 3_000_000.0

    # Deleting it.
    assert client.delete(f"/v1/goals/custom/{goal_id}", headers=_auth(token)).status_code == 204
    progress = client.get("/v1/goals/progress?currency=CLP", headers=_auth(token)).json()
    assert progress["custom_goals"] == []


def test_custom_goals_envelope_allocation(client, db_session, monkeypatch):
    """Two custom goals sharing one patrimonio pool used to both show 100%
    of it (the reported "no envelope" gap). Now the older goal claims first:
    with patrimonio=1000 CLP, a 600 target is fully funded (100%) and the
    remaining 400 goes to the newer 800-target goal (50%), not another 1000.
    """
    monkeypatch.setattr("app.modules.portfolios.router.YahooProvider", FlatProvider)
    token = _register_and_login(client, email="envelope-test@example.com")

    portfolio_id = client.post("/v1/portfolios", json={"name": "CL", "currency": "CLP"}, headers=_auth(token)).json()["id"]
    client.post(
        f"/v1/portfolios/{portfolio_id}/transactions",
        json={"yahoo_symbol": "CHILE.SN", "type": "buy", "trade_date": date.today().isoformat(), "quantity": 10, "price": 100.0},
        headers=_auth(token),
    )

    goal_a = client.post(
        "/v1/goals/custom", json={"name": "A", "target_amount": 600.0, "currency": "CLP"}, headers=_auth(token)
    ).json()
    goal_b = client.post(
        "/v1/goals/custom", json={"name": "B", "target_amount": 800.0, "currency": "CLP"}, headers=_auth(token)
    ).json()

    # A must be strictly older than B for envelope priority — set directly
    # rather than relying on real-clock ordering between the two requests.
    db_session.get(Goal, uuid.UUID(goal_a["id"])).created_at = datetime.now(UTC).replace(tzinfo=None) - timedelta(days=30)
    db_session.commit()

    progress = client.get("/v1/goals/progress?currency=CLP", headers=_auth(token)).json()
    by_name = {g["name"]: g for g in progress["custom_goals"]}

    assert by_name["A"]["current_amount"] == 600.0
    assert by_name["A"]["pct"] == 100.0
    assert by_name["A"]["on_track"] is True

    assert by_name["B"]["current_amount"] == 400.0
    assert by_name["B"]["pct"] == 50.0
    # B was "created" moments ago (0 days elapsed) — not enough history for
    # a pace projection yet.
    assert by_name["B"]["projected_date"] is None
    assert by_name["B"]["on_track"] is None


def test_custom_goal_pace_projection_against_target_date(client, db_session, monkeypatch):
    """current_amount=1000 reached over 100 days (10/day) with 1000 still
    needed to hit a 2000 target projects 100 more days — compared against
    target_date to say whether that's on time.
    """
    monkeypatch.setattr("app.modules.portfolios.router.YahooProvider", FlatProvider)
    token = _register_and_login(client, email="pace-test@example.com")

    portfolio_id = client.post("/v1/portfolios", json={"name": "CL", "currency": "CLP"}, headers=_auth(token)).json()["id"]
    client.post(
        f"/v1/portfolios/{portfolio_id}/transactions",
        json={"yahoo_symbol": "CHILE.SN", "type": "buy", "trade_date": date.today().isoformat(), "quantity": 10, "price": 100.0},
        headers=_auth(token),
    )

    target_date = (date.today() + timedelta(days=200)).isoformat()
    goal = client.post(
        "/v1/goals/custom",
        json={"name": "Meta", "target_amount": 2000.0, "currency": "CLP", "target_date": target_date},
        headers=_auth(token),
    ).json()
    db_session.get(Goal, uuid.UUID(goal["id"])).created_at = datetime.now(UTC).replace(tzinfo=None) - timedelta(days=100)
    db_session.commit()

    progress = client.get("/v1/goals/progress?currency=CLP", headers=_auth(token)).json()
    custom = next(g for g in progress["custom_goals"] if g["id"] == goal["id"])

    assert custom["current_amount"] == 1000.0
    assert custom["projected_date"] == (date.today() + timedelta(days=100)).isoformat()
    assert custom["on_track"] is True

    # Tighten the deadline to something the current rate can't hit.
    resp = client.patch(
        f"/v1/goals/custom/{goal['id']}",
        json={"name": "Meta", "target_amount": 2000.0, "currency": "CLP", "target_date": (date.today() + timedelta(days=10)).isoformat()},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    progress = client.get("/v1/goals/progress?currency=CLP", headers=_auth(token)).json()
    custom = next(g for g in progress["custom_goals"] if g["id"] == goal["id"])
    assert custom["on_track"] is False


def test_fi_ladder_has_no_projection_when_patrimonio_is_flat(client, monkeypatch):
    """A single buy with no price history held unchanged since (this test's
    FlatProvider never returns price history, so market value is always
    exactly qty * purchase price) has zero observed growth — the FI ladder
    must not fabricate a projected date from a flat series.
    """
    monkeypatch.setattr("app.modules.portfolios.router.YahooProvider", FlatProvider)
    token = _register_and_login(client, email="fi-ladder-flat-test@example.com")

    portfolio_id = client.post(
        "/v1/portfolios", json={"name": "USA", "currency": "USD"}, headers=_auth(token)
    ).json()["id"]
    client.post(
        f"/v1/portfolios/{portfolio_id}/transactions",
        json={
            "yahoo_symbol": "AAPL",
            "type": "buy",
            "trade_date": (date.today() - timedelta(days=100)).isoformat(),
            "quantity": 10,
            "price": 100.0,
        },
        headers=_auth(token),
    )

    progress = client.get("/v1/goals/progress?currency=USD", headers=_auth(token)).json()
    assert all(h["projected_date"] is None for h in progress["hitos_fi"])
    assert progress["numero_fi_projected_date"] is None


def test_fi_ladder_projects_forward_when_patrimonio_is_growing(client, monkeypatch):
    """Two buys 100 and 50 days apart double the holding (flat price, no
    history — value is purely qty * price), giving a real positive growth
    rate. Each hito's projected_date should be a real future date, and
    farther-away milestones should project farther out at the same rate.
    """
    monkeypatch.setattr("app.modules.portfolios.router.YahooProvider", FlatProvider)
    token = _register_and_login(client, email="fi-ladder-growth-test@example.com")

    portfolio_id = client.post(
        "/v1/portfolios", json={"name": "USA", "currency": "USD"}, headers=_auth(token)
    ).json()["id"]
    client.post(
        f"/v1/portfolios/{portfolio_id}/transactions",
        json={
            "yahoo_symbol": "AAPL",
            "type": "buy",
            "trade_date": (date.today() - timedelta(days=100)).isoformat(),
            "quantity": 50,
            "price": 100.0,
        },
        headers=_auth(token),
    )
    client.post(
        f"/v1/portfolios/{portfolio_id}/transactions",
        json={
            "yahoo_symbol": "AAPL",
            "type": "buy",
            "trade_date": (date.today() - timedelta(days=50)).isoformat(),
            "quantity": 50,
            "price": 100.0,
        },
        headers=_auth(token),
    )

    progress = client.get("/v1/goals/progress?currency=USD", headers=_auth(token)).json()
    assert progress["patrimonio_total"] == 10_000.0

    projected = [date.fromisoformat(h["projected_date"]) for h in progress["hitos_fi"]]
    assert all(d > date.today() for d in projected)
    assert projected == sorted(projected)
    assert progress["numero_fi_projected_date"] is not None


def test_custom_goal_upsert_never_touches_it(client):
    """A net_worth-kind custom goal must survive saving the fixed
    monthly_dividends/cost_coverage cards — different path entirely."""
    token = _register_and_login(client)
    goal_id = client.post(
        "/v1/goals/custom",
        json={"name": "Emergencia", "target_amount": 500_000.0, "currency": "CLP"},
        headers=_auth(token),
    ).json()["id"]

    client.put(
        "/v1/goals",
        json=[{"kind": "monthly_dividends", "target_amount": 300.0, "currency": "USD"}],
        headers=_auth(token),
    )

    listed = client.get("/v1/goals", headers=_auth(token)).json()
    assert any(g["id"] == goal_id and g["name"] == "Emergencia" for g in listed)


def test_custom_goal_scoped_to_owner(client):
    token_a = _register_and_login(client, "goals-a@example.com")
    token_b = _register_and_login(client, "goals-b@example.com")
    goal_id = client.post(
        "/v1/goals/custom",
        json={"name": "Emergencia", "target_amount": 500_000.0, "currency": "CLP"},
        headers=_auth(token_a),
    ).json()["id"]

    resp = client.patch(
        f"/v1/goals/custom/{goal_id}",
        json={"name": "hijacked", "target_amount": 1.0, "currency": "CLP"},
        headers=_auth(token_b),
    )
    assert resp.status_code == 404

    resp = client.delete(f"/v1/goals/custom/{goal_id}", headers=_auth(token_b))
    assert resp.status_code == 404


def test_delete_tag(client):
    token = _register_and_login(client)
    client.post("/v1/tags", json={"label": "DGI"}, headers=_auth(token))
    client.post("/v1/tags", json={"label": "Growth"}, headers=_auth(token))

    resp = client.delete("/v1/tags/DGI", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json() == [{"label": "Growth", "target_weight": None}]

    # Deleting an unknown label is a no-op, not an error.
    resp = client.delete("/v1/tags/Nope", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json() == [{"label": "Growth", "target_weight": None}]
