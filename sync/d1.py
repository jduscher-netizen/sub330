"""Schmaler Client für die Cloudflare-D1-API (nur serverseitig in GitHub Actions)."""

from __future__ import annotations

import os
from typing import Any

import requests

API = "https://api.cloudflare.com/client/v4"
DB_NAME = "sub330"


class D1Error(RuntimeError):
    pass


class D1:
    def __init__(self, token: str, account_id: str, database_id: str | None = None) -> None:
        self.account_id = account_id
        self.session = requests.Session()
        self.session.headers["Authorization"] = f"Bearer {token}"
        self.database_id = database_id or self._lookup_database_id()

    @classmethod
    def from_env(cls) -> "D1":
        token = os.environ.get("CLOUDFLARE_API_TOKEN")
        account = os.environ.get("CLOUDFLARE_ACCOUNT_ID")
        if not token or not account:
            raise D1Error("CLOUDFLARE_API_TOKEN oder CLOUDFLARE_ACCOUNT_ID fehlt")
        return cls(token, account, os.environ.get("D1_DATABASE_ID") or None)

    def _lookup_database_id(self) -> str:
        res = self.session.get(
            f"{API}/accounts/{self.account_id}/d1/database", params={"name": DB_NAME}, timeout=30
        )
        body = _body(res)
        for db in body.get("result") or []:
            if db.get("name") == DB_NAME:
                return db["uuid"]
        raise D1Error(f"D1-Datenbank {DB_NAME} nicht gefunden")

    def query(self, sql: str, params: list[Any] | None = None) -> list[dict[str, Any]]:
        """Führt eine Anweisung aus und liefert die Ergebniszeilen."""
        res = self.session.post(
            f"{API}/accounts/{self.account_id}/d1/database/{self.database_id}/query",
            json={"sql": sql, "params": params or []},
            timeout=30,
        )
        body = _body(res)
        results = body.get("result") or []
        return results[0].get("results", []) if results else []

    def first(self, sql: str, params: list[Any] | None = None) -> dict[str, Any] | None:
        rows = self.query(sql, params)
        return rows[0] if rows else None


def _body(res: requests.Response) -> dict[str, Any]:
    try:
        body = res.json()
    except ValueError:
        raise D1Error(f"D1-API antwortet mit HTTP {res.status_code}") from None
    if not res.ok or not body.get("success", False):
        msgs = "; ".join(e.get("message", "") for e in body.get("errors") or []) or f"HTTP {res.status_code}"
        raise D1Error(f"D1-API: {msgs}")
    return body
