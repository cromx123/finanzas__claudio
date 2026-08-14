from __future__ import annotations


def test_register_login_me_refresh_flow(client):
    register_resp = client.post(
        "/v1/auth/register",
        json={
            "email": "User@Example.com",
            "password": "supersecret1",
            "locale": "es-CL",
            "base_currency": "clp",
        },
    )
    assert register_resp.status_code == 201
    tokens = register_resp.json()
    assert "access_token" in tokens and "refresh_token" in tokens

    dup = client.post(
        "/v1/auth/register",
        json={"email": "user@example.com", "password": "supersecret1"},
    )
    assert dup.status_code == 409

    login_resp = client.post(
        "/v1/auth/login", json={"email": "user@example.com", "password": "supersecret1"}
    )
    assert login_resp.status_code == 200
    login_tokens = login_resp.json()

    wrong_login = client.post(
        "/v1/auth/login", json={"email": "user@example.com", "password": "wrong"}
    )
    assert wrong_login.status_code == 401

    me_resp = client.get(
        "/v1/me", headers={"Authorization": f"Bearer {login_tokens['access_token']}"}
    )
    assert me_resp.status_code == 200
    body = me_resp.json()
    assert body["email"] == "user@example.com"
    assert body["base_currency"] == "CLP"

    unauthenticated = client.get("/v1/me")
    assert unauthenticated.status_code in (401, 403)

    refresh_resp = client.post(
        "/v1/auth/refresh", json={"refresh_token": login_tokens["refresh_token"]}
    )
    assert refresh_resp.status_code == 200
    new_access = refresh_resp.json()["access_token"]

    me_resp_2 = client.get("/v1/me", headers={"Authorization": f"Bearer {new_access}"})
    assert me_resp_2.status_code == 200


def test_patch_me_updates_locale_and_currency(client):
    register_resp = client.post(
        "/v1/auth/register", json={"email": "patch@example.com", "password": "supersecret1"}
    )
    headers = {"Authorization": f"Bearer {register_resp.json()['access_token']}"}

    patch_resp = client.patch("/v1/me", json={"base_currency": "usd"}, headers=headers)
    assert patch_resp.status_code == 200
    assert patch_resp.json()["base_currency"] == "USD"


def test_tax_rules_put_replaces_existing_rows(client):
    register_resp = client.post(
        "/v1/auth/register", json={"email": "tax@example.com", "password": "supersecret1"}
    )
    headers = {"Authorization": f"Bearer {register_resp.json()['access_token']}"}

    first_put = client.put(
        "/v1/me/tax-rules",
        json=[{"country_code": "US", "withholding_pct": 30}],
        headers=headers,
    )
    assert first_put.status_code == 200
    assert len(first_put.json()) == 1

    second_put = client.put(
        "/v1/me/tax-rules",
        json=[
            {"country_code": "US", "withholding_pct": 30},
            {"country_code": "CL", "withholding_pct": 0},
        ],
        headers=headers,
    )
    assert second_put.status_code == 200

    get_resp = client.get("/v1/me/tax-rules", headers=headers)
    assert get_resp.status_code == 200
    rows = get_resp.json()
    assert len(rows) == 2
    assert {r["country_code"] for r in rows} == {"US", "CL"}
