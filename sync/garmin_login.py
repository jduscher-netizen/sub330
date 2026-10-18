"""Erst-Login bei Garmin mit Zwei-Faktor-Code (Workflow garmin-login, manuell gestartet).

1. Anmeldung mit GARMIN_EMAIL/GARMIN_PASSWORD, Garmin schickt einen Code.
2. Jan tippt den Code in der App ein (Profil › Garmin verbinden), die App legt ihn in garmin_mfa ab.
3. Dieses Skript liest garmin_mfa bis zu 5 Minuten lang, schließt den Login ab
   und speichert die Tokens in garmin_auth. Danach braucht der Sync kein Passwort mehr.

Der Fortschritt steht als Eintrag mit source = 'garmin_login' in sync_log, damit die App ihn zeigen kann.
"""

from __future__ import annotations

import os
import sys
import time

from d1 import D1, D1Error
from garmin_sync import log_finish, log_start, save_tokens, short_error

WAIT_S = 5 * 60
POLL_S = 4


def set_message(db: D1, log_id: int, message: str) -> None:
    db.query("UPDATE sync_log SET message = ? WHERE id = ?", [message, log_id])


def next_code(db: D1, since: str) -> str | None:
    """Neuester unbenutzter Code, der nach Start dieses Logins eingegeben wurde."""
    row = db.first(
        "SELECT id, code FROM garmin_mfa WHERE used = 0 AND created_at >= ? ORDER BY id DESC LIMIT 1", [since]
    )
    if not row:
        return None
    db.query("UPDATE garmin_mfa SET used = 1 WHERE id <= ?", [row["id"]])
    return str(row["code"]).strip()


def login(db: D1, log_id: int) -> tuple[bool, str]:
    from garminconnect import Garmin, GarminConnectAuthenticationError, GarminConnectTooManyRequestsError

    email, password = os.environ.get("GARMIN_EMAIL"), os.environ.get("GARMIN_PASSWORD")
    if not email or not password:
        return False, "GitHub-Secrets GARMIN_EMAIL oder GARMIN_PASSWORD fehlen"

    since = db.first("SELECT datetime('now') AS now")["now"]
    # Alte, nie verwendete Codes aufräumen
    db.query("DELETE FROM garmin_mfa WHERE created_at < datetime('now', '-1 day')")

    garmin = Garmin(email=email, password=password, return_on_mfa=True)
    try:
        status, state = garmin.login()
    except GarminConnectTooManyRequestsError:
        return False, "Garmin blockt gerade zu viele Anmeldungen. In 15 Minuten erneut versuchen."
    except GarminConnectAuthenticationError as e:
        return False, f"Anmeldung abgelehnt, E-Mail oder Passwort prüfen ({short_error(e)})"

    if status == "needs_mfa":
        set_message(db, log_id, "Warte auf Code")
        print("Garmin hat einen Code geschickt. Bitte in der App unter Profil › Garmin verbinden eintippen.")
        deadline = time.monotonic() + WAIT_S
        while True:
            if time.monotonic() > deadline:
                return False, "Kein Code innerhalb von 5 Minuten eingegangen. Workflow neu starten."
            code = next_code(db, since)
            if not code:
                time.sleep(POLL_S)
                continue
            try:
                garmin.resume_login(state, code)
                break
            except GarminConnectAuthenticationError as e:
                # Falscher Code: die Garmin-Sitzung bleibt offen, ein neuer Code darf folgen.
                print(f"Code abgelehnt: {short_error(e)}")
                set_message(db, log_id, "Code falsch, bitte erneut eingeben")

    tokens = garmin.client.dumps()
    if not tokens or '"di_refresh_token": null' in tokens:
        return False, "Garmin hat keine Tokens geliefert"
    save_tokens(db, tokens)
    db.query("DELETE FROM garmin_mfa")
    return True, "Garmin verbunden"


def main() -> int:
    try:
        db = D1.from_env()
    except D1Error as e:
        print(f"::error::{e}")
        return 1

    log_id = log_start(db, "garmin_login")
    try:
        ok, message = login(db, log_id)
    except Exception as e:
        ok, message = False, f"Unerwarteter Fehler: {short_error(e)}"
    log_finish(db, log_id, ok, message)
    print(("OK: " if ok else "Fehler: ") + message)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
