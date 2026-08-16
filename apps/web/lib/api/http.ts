"use client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const ACCESS_KEY = "inversiones-3.0:access-token";
const REFRESH_KEY = "inversiones-3.0:refresh-token";

// Fixed dev-only identity: no login screen yet (see root README), so the
// app silently registers/logs in as this account on first load. Swapping
// this for a real login flow later doesn't touch anything below.
const DEV_EMAIL = "dev@example.com";
const DEV_PASSWORD = "DevPassword123!";

interface TokenPair {
  access_token: string;
  refresh_token: string;
}

function getStoredAccess(): string | null {
  return window.localStorage.getItem(ACCESS_KEY);
}

function storeTokens(tokens: TokenPair) {
  window.localStorage.setItem(ACCESS_KEY, tokens.access_token);
  window.localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
}

async function rawFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
}

async function registerOrLogin(): Promise<TokenPair> {
  const registerRes = await rawFetch("/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({ email: DEV_EMAIL, password: DEV_PASSWORD }),
  });
  if (registerRes.ok) return registerRes.json();

  const loginRes = await rawFetch("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: DEV_EMAIL, password: DEV_PASSWORD }),
  });
  if (!loginRes.ok) throw new Error("dev auth bootstrap failed");
  return loginRes.json();
}

let ensureSessionPromise: Promise<string> | null = null;

/** Resolves once a valid access token is stored, registering/logging in the
 * fixed dev account on first call. Safe to call repeatedly — concurrent
 * callers share the same in-flight bootstrap request. */
export function ensureSession(): Promise<string> {
  const existing = getStoredAccess();
  if (existing) return Promise.resolve(existing);
  if (!ensureSessionPromise) {
    ensureSessionPromise = registerOrLogin().then((tokens) => {
      storeTokens(tokens);
      return tokens.access_token;
    });
  }
  return ensureSessionPromise;
}

async function refreshSession(): Promise<string | null> {
  const refreshToken = window.localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;
  const res = await rawFetch("/v1/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) return null;
  const tokens: TokenPair = await res.json();
  storeTokens(tokens);
  return tokens.access_token;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let token = await ensureSession();

  let res = await rawFetch(path, { ...init, headers: { Authorization: `Bearer ${token}`, ...init?.headers } });

  if (res.status === 401) {
    const refreshed = await refreshSession();
    token = refreshed ?? (await registerOrLogin().then((t) => (storeTokens(t), t.access_token)));
    res = await rawFetch(path, { ...init, headers: { Authorization: `Bearer ${token}`, ...init?.headers } });
  }

  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, body || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
};
