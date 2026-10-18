"""Stündlicher Garmin-Sync: Tageswerte und Aktivitäten nach D1.

Lädt die Tokens aus garmin_auth, holt Trainingsbereitschaft, HRV, Schlaf, Body Battery,
Ruhepuls, VO2max, Gewicht und die Aktivitäten der letzten Tage und schreibt jeden Lauf
in sync_log. Fehler einzelner Endpunkte brechen den Lauf nicht ab, werden aber gemeldet.
"""

from __future__ import annotations

import json
import os
import sys
import traceback
from datetime import date, datetime, timedelta
from typing import Any, Callable
from zoneinfo import ZoneInfo

from d1 import D1, D1Error

TZ = ZoneInfo("Europe/Berlin")
ACTIVITY_DAYS = 3
METRIC_DAYS = 2  # heute und gestern (gestern wird nachts noch fertig)
MAX_BACKFILL_DAYS = 120


def backfill_days() -> int:
    """SYNC_DAYS (z. B. 56) holt einmalig mehr Historie; sonst der normale kurze Zeitraum."""
    try:
        return max(0, min(MAX_BACKFILL_DAYS, int(os.environ.get("SYNC_DAYS") or 0)))
    except ValueError:
        return 0
RELOGIN = "Garmin neu verbinden"

# ---------------------------------------------------------------------------
# Übersetzungen
# ---------------------------------------------------------------------------

FEEDBACK_DE = {
    "EXCELLENT": "ausgezeichnet",
    "VERY_GOOD": "sehr gut",
    "GOOD": "gut",
    "FAIR": "mäßig",
    "MODERATE": "mäßig",
    "POOR": "schwach",
    "VERY_POOR": "sehr schwach",
    "LOW": "niedrig",
    "HIGH": "hoch",
    "VERY_HIGH": "sehr hoch",
    "OPTIMAL": "optimal",
    "BALANCED": "ausgeglichen",
    "UNBALANCED": "unausgeglichen",
}

SPORTS = {
    "run": ("running", "trail_running", "treadmill_running", "track_running", "street_running",
            "indoor_running", "virtual_run", "ultra_run", "obstacle_run"),
    "bike": ("cycling", "indoor_cycling", "virtual_ride", "road_biking", "mountain_biking",
             "gravel_cycling", "e_bike_fitness", "e_bike_mountain"),
    "swim": ("lap_swimming", "open_water_swimming", "swimming"),
    "strength": ("strength_training", "indoor_cardio", "hiit"),
    "padel": ("padel", "paddelball", "pickleball", "tennis", "squash", "racket"),
}


def de(word: str | None) -> str | None:
    if not word:
        return None
    return FEEDBACK_DE.get(word.upper(), word.replace("_", " ").lower())


def sport_of(type_key: str | None) -> str:
    key = (type_key or "").lower()
    for sport, keys in SPORTS.items():
        if key in keys:
            return sport
    if "run" in key:
        return "run"
    if "cycl" in key or "bik" in key:
        return "bike"
    if "swim" in key:
        return "swim"
    if "padel" in key:
        return "padel"
    return "other"


# ---------------------------------------------------------------------------
# Aufbereitung (rein, ohne Netz, getestet in test_garmin_sync.py)
# ---------------------------------------------------------------------------


def _num(v: Any) -> float | None:
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None


def _int(v: Any) -> int | None:
    n = _num(v)
    return round(n) if n is not None else None


def latest_readiness(data: Any) -> dict[str, Any] | None:
    """Neuester Eintrag der Trainingsbereitschaft (Garmin liefert mehrere pro Tag)."""
    if isinstance(data, dict):
        return data or None
    if not isinstance(data, list) or not data:
        return None
    entries = [e for e in data if isinstance(e, dict)]
    if not entries:
        return None
    return max(entries, key=lambda e: str(e.get("timestampLocal") or e.get("timestamp") or ""))


def acute_load(training_status: Any) -> tuple[int | None, str | None]:
    """Akute Last und ACWR-Status aus dem Trainingsstatus (pro Gerät verschachtelt)."""
    try:
        devices = training_status["mostRecentTrainingStatus"]["latestTrainingStatusData"]
    except (KeyError, TypeError):
        return None, None
    for dev in (devices or {}).values():
        dto = (dev or {}).get("acuteTrainingLoadDTO") or {}
        load = _int(dto.get("dailyTrainingLoadAcute"))
        if load is not None:
            return load, dto.get("acwrStatus")
    return None, None


def vo2max_of(max_metrics: Any, training_status: Any) -> float | None:
    rows = max_metrics if isinstance(max_metrics, list) else [max_metrics]
    for row in rows:
        generic = (row or {}).get("generic") or {} if isinstance(row, dict) else {}
        v = _num(generic.get("vo2MaxPreciseValue")) or _num(generic.get("vo2MaxValue"))
        if v:
            return round(v, 1)
    if isinstance(training_status, dict):
        generic = (training_status.get("mostRecentVO2Max") or {}).get("generic") or {}
        v = _num(generic.get("vo2MaxPreciseValue")) or _num(generic.get("vo2MaxValue"))
        if v:
            return round(v, 1)
    return None


def weight_of(body_comp: Any) -> float | None:
    if not isinstance(body_comp, dict):
        return None
    entries = [e for e in body_comp.get("dateWeightList") or [] if _num((e or {}).get("weight"))]
    grams = _num(entries[-1]["weight"]) if entries else _num((body_comp.get("totalAverage") or {}).get("weight"))
    return round(grams / 1000, 1) if grams else None


def hm(seconds: int) -> str:
    return f"{seconds // 3600}:{seconds % 3600 // 60:02d} h"


def build_metrics(day: str, raw: dict[str, Any]) -> dict[str, Any]:
    """Eine Zeile für daily_metrics aus den Rohdaten der einzelnen Endpunkte."""
    tr = latest_readiness(raw.get("readiness")) or {}
    hrv = (raw.get("hrv") or {}).get("hrvSummary") or {}
    sleep = (raw.get("sleep") or {}).get("dailySleepDTO") or {}
    summary = raw.get("summary") or {}
    load, acwr = acute_load(raw.get("training_status"))

    sleep_score = _int(((sleep.get("sleepScores") or {}).get("overall") or {}).get("value")) or _int(tr.get("sleepScore"))
    sleep_s = _int(sleep.get("sleepTimeSeconds"))
    recovery_min = _num(tr.get("recoveryTime"))
    recovery_h = round(recovery_min / 60, 1) if recovery_min is not None else None
    hrv_night = _int(hrv.get("lastNightAvg"))
    hrv_status = hrv.get("status")
    if load is None:
        load = _int(tr.get("acuteLoad"))
    stress_avg = _int(summary.get("averageStressLevel"))
    if stress_avg is not None and stress_avg < 0:
        stress_avg = None  # Garmin meldet -1/-2, wenn keine Messung vorliegt
    resting = _int(summary.get("restingHeartRate"))
    if resting is None:
        try:
            resting = _int(raw["rhr"]["allMetrics"]["metricsMap"]["WELLNESS_RESTING_HEART_RATE"][0]["value"])
        except (KeyError, IndexError, TypeError):
            resting = None

    factors: list[dict[str, Any]] = []

    def factor(label: str, percent: Any, value: str | None) -> None:
        p = _int(percent)
        if p is not None:
            factors.append({"label": label, "value": value or "", "percent": max(0, min(100, p))})

    if tr:
        sleep_txt = ", ".join(x for x in (hm(sleep_s) if sleep_s else None,
                                          f"Score {sleep_score}" if sleep_score is not None else None) if x)
        factor("Schlaf", tr.get("sleepScoreFactorPercent"), sleep_txt or de(tr.get("sleepScoreFactorFeedback")))
        if recovery_h is not None:
            rec_txt = "erholt" if recovery_h < 1 else f"noch {round(recovery_h)} h"
        else:
            rec_txt = de(tr.get("recoveryTimeFactorFeedback"))
        factor("Erholungszeit", tr.get("recoveryTimeFactorPercent"), rec_txt)
        hrv_ms = hrv_night if hrv_night is not None else _int(tr.get("hrvWeeklyAverage"))
        hrv_txt = ", ".join(x for x in (f"{hrv_ms} ms" if hrv_ms is not None else None,
                                        de(hrv_status) or de(tr.get("hrvFactorFeedback"))) if x)
        factor("HRV-Status", tr.get("hrvFactorPercent"), hrv_txt)
        load_txt = ", ".join(x for x in (str(load) if load is not None else None,
                                         de(acwr) or de(tr.get("acwrFactorFeedback"))) if x)
        factor("Akute Belastung", tr.get("acwrFactorPercent"), load_txt)
        factor("Stress", tr.get("stressHistoryFactorPercent"), de(tr.get("stressHistoryFactorFeedback")))

    return {
        "date": day,
        "readiness_score": _int(tr.get("score")),
        "readiness_level": tr.get("level"),
        "readiness_feedback": tr.get("feedbackShort"),
        "sleep_score": sleep_score,
        "sleep_seconds": sleep_s,
        "recovery_hours": recovery_h,
        "hrv_last_night": hrv_night,
        "hrv_status": hrv_status,
        "acute_load": load,
        "acute_load_status": acwr,
        "stress_avg": stress_avg,
        "body_battery_high": _int(summary.get("bodyBatteryHighestValue")),
        "body_battery_low": _int(summary.get("bodyBatteryLowestValue")),
        "resting_hr": resting,
        "vo2max": vo2max_of(raw.get("max_metrics"), raw.get("training_status")),
        "weight_kg": weight_of(raw.get("body_comp")),
        "factors_json": json.dumps(factors, ensure_ascii=False) if factors else None,
    }


def zone_seconds(act: dict[str, Any], hr_zones: Any = None) -> list[int] | None:
    """Zeit in Z1 bis Z5; erst aus der Aktivitätsliste, sonst aus hrTimeInZones."""
    zs = [_num(act.get(f"hrTimeInZone_{i}")) for i in range(1, 6)]
    if any(z is not None for z in zs):
        return [round(z or 0) for z in zs]
    if isinstance(hr_zones, list) and hr_zones:
        out = [0] * 5
        for z in hr_zones:
            n = _int((z or {}).get("zoneNumber"))
            if n and 1 <= n <= 5:
                out[n - 1] = round(_num(z.get("secsInZone")) or 0)
        return out
    return None


def build_activity(act: dict[str, Any], hr_zones: Any = None) -> dict[str, Any] | None:
    ext = act.get("activityId")
    start = act.get("startTimeLocal")
    if ext is None or not start:
        return None
    zones = zone_seconds(act, hr_zones)
    return {
        "id": f"garmin:{ext}",
        "source": "garmin",
        "external_id": str(ext),
        "sport": sport_of((act.get("activityType") or {}).get("typeKey")),
        "name": act.get("activityName"),
        "start_time": str(start).replace(" ", "T")[:19],
        "duration_s": _int(act.get("duration")),
        "distance_m": round(_num(act.get("distance")), 1) if _num(act.get("distance")) else None,
        "avg_hr": _int(act.get("averageHR")),
        "max_hr": _int(act.get("maxHR")),
        "zone_seconds_json": json.dumps(zones) if zones else None,
        "training_load": round(_num(act.get("activityTrainingLoad")), 1) if _num(act.get("activityTrainingLoad")) else None,
    }


# ---------------------------------------------------------------------------
# Schreiben nach D1
# ---------------------------------------------------------------------------

METRIC_COLS = [
    "readiness_score", "readiness_level", "readiness_feedback", "sleep_score", "sleep_seconds",
    "recovery_hours", "hrv_last_night", "hrv_status", "acute_load", "acute_load_status", "stress_avg",
    "body_battery_high", "body_battery_low", "resting_hr", "vo2max", "weight_kg", "factors_json",
]
ACTIVITY_COLS = [
    "source", "external_id", "sport", "name", "start_time", "duration_s", "distance_m",
    "avg_hr", "max_hr", "zone_seconds_json", "training_load",
]


def upsert_metrics(db: D1, row: dict[str, Any]) -> None:
    # Vorhandene Werte nicht mit NULL überschreiben (z. B. Gewicht nur an Wiegetagen).
    cols = ["date", *METRIC_COLS]
    sets = ", ".join(f"{c} = COALESCE(excluded.{c}, daily_metrics.{c})" for c in METRIC_COLS)
    db.query(
        f"INSERT INTO daily_metrics ({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))}) "
        f"ON CONFLICT(date) DO UPDATE SET {sets}, updated_at = datetime('now')",
        [row[c] for c in cols],
    )


def upsert_activity(db: D1, row: dict[str, Any]) -> None:
    cols = ["id", *ACTIVITY_COLS]
    sets = ", ".join(f"{c} = excluded.{c}" for c in ACTIVITY_COLS)
    db.query(
        f"INSERT INTO activities ({', '.join(cols)}) VALUES ({', '.join('?' * len(cols))}) "
        f"ON CONFLICT(id) DO UPDATE SET {sets}, updated_at = datetime('now')",
        [row[c] for c in cols],
    )


def log_start(db: D1, source: str = "garmin") -> int:
    row = db.first("INSERT INTO sync_log (source, started_at) VALUES (?, datetime('now')) RETURNING id", [source])
    return int(row["id"]) if row else 0


def log_finish(db: D1, log_id: int, ok: bool, message: str | None) -> None:
    db.query(
        "UPDATE sync_log SET finished_at = datetime('now'), ok = ?, message = ? WHERE id = ?",
        [1 if ok else 0, (message or None) and message[:500], log_id],
    )


def load_tokens(db: D1) -> str | None:
    row = db.first("SELECT tokens_json FROM garmin_auth WHERE id = 1")
    return row["tokens_json"] if row else None


def save_tokens(db: D1, tokens: str) -> None:
    db.query(
        "INSERT INTO garmin_auth (id, tokens_json) VALUES (1, ?) "
        "ON CONFLICT(id) DO UPDATE SET tokens_json = excluded.tokens_json, updated_at = datetime('now')",
        [tokens],
    )


# ---------------------------------------------------------------------------
# Ablauf
# ---------------------------------------------------------------------------


def short_error(e: BaseException) -> str:
    text = str(e).strip().splitlines()[0] if str(e).strip() else type(e).__name__
    return text[:160]


def in_sync_window(now: datetime) -> bool:
    return 6 <= now.hour <= 22


def run(db: D1) -> tuple[bool, str]:
    from garminconnect import Garmin, GarminConnectAuthenticationError

    tokens = load_tokens(db)
    if not tokens:
        return False, f"{RELOGIN}: noch keine Anmeldung gespeichert"

    garmin = Garmin()
    try:
        garmin.login(tokenstore=tokens)
    except GarminConnectAuthenticationError as e:
        print(f"Token-Login abgelehnt: {short_error(e)}")
        return False, f"{RELOGIN}: gespeicherte Anmeldung ist abgelaufen oder ungültig"
    except Exception as e:  # Netz, Garmin-Störung, geänderte Endpunkte
        if "token" in str(e).lower() or "auth" in str(e).lower():
            return False, f"{RELOGIN}: {short_error(e)}"
        return False, f"Login fehlgeschlagen: {short_error(e)}"

    # Erneuerte Tokens sofort sichern, damit sie auch bei späteren Fehlern nicht verloren gehen.
    fresh = garmin.client.dumps()
    if fresh and fresh != tokens:
        save_tokens(db, fresh)

    errors: list[str] = []

    def fetch(label: str, fn: Callable[[], Any]) -> Any:
        try:
            return fn()
        except Exception as e:
            errors.append(f"{label}: {short_error(e)}")
            return None

    today = datetime.now(TZ).date()
    extra = backfill_days()
    metric_days_n = max(METRIC_DAYS, extra)
    activity_days_n = max(ACTIVITY_DAYS, extra)
    days = [(today - timedelta(days=i)).isoformat() for i in range(metric_days_n)]

    training_status = fetch("Trainingsstatus", lambda: garmin.get_training_status(today.isoformat()))
    metric_days = 0
    for day in days:
        raw = {
            "readiness": fetch(f"Bereitschaft {day}", lambda: garmin.get_training_readiness(day)),
            "hrv": fetch(f"HRV {day}", lambda: garmin.get_hrv_data(day)),
            "sleep": fetch(f"Schlaf {day}", lambda: garmin.get_sleep_data(day)),
            "summary": fetch(f"Tageswerte {day}", lambda: garmin.get_user_summary(day)),
            "max_metrics": fetch(f"VO2max {day}", lambda: garmin.get_max_metrics(day)),
            "body_comp": fetch(f"Gewicht {day}", lambda: garmin.get_body_composition(day)),
            # Trainingsstatus gilt für heute; gestern bekommt ihn nicht erneut.
            "training_status": training_status if day == days[0] else None,
        }
        if raw["summary"] and raw["summary"].get("restingHeartRate") is None:
            raw["rhr"] = fetch(f"Ruhepuls {day}", lambda: garmin.get_rhr_day(day))
        row = build_metrics(day, raw)
        if any(row[c] is not None for c in METRIC_COLS):
            upsert_metrics(db, row)
            metric_days += 1

    start = (today - timedelta(days=activity_days_n - 1)).isoformat()
    acts = fetch("Aktivitäten", lambda: garmin.get_activities_by_date(start, today.isoformat())) or []
    n_acts = 0
    for act in acts:
        if not isinstance(act, dict):
            continue
        hr_zones = None
        if act.get("hrTimeInZone_1") is None and act.get("averageHR") and act.get("activityId"):
            hr_zones = fetch(f"HF-Zonen {act['activityId']}", lambda: garmin.get_activity_hr_in_timezones(act["activityId"]))
        row = build_activity(act, hr_zones)
        if row:
            upsert_activity(db, row)
            n_acts += 1

    summary = (f"{metric_days} {'Tag' if metric_days == 1 else 'Tage'} Gesundheitswerte, "
               f"{n_acts} {'Aktivität' if n_acts == 1 else 'Aktivitäten'}")
    if errors:
        return False, f"Teilweise fehlgeschlagen ({summary}). " + "; ".join(errors)
    return True, summary


def main() -> int:
    now = datetime.now(TZ)
    if os.environ.get("GITHUB_EVENT_NAME") == "schedule" and not in_sync_window(now):
        print(f"Außerhalb von 6 bis 22 Uhr ({now:%H:%M}), kein Sync.")
        return 0

    try:
        db = D1.from_env()
    except D1Error as e:
        print(f"::error::{e}")
        return 1

    log_id = log_start(db)
    try:
        ok, message = run(db)
    except Exception as e:
        traceback.print_exc()
        ok, message = False, f"Unerwarteter Fehler: {short_error(e)}"
    log_finish(db, log_id, ok, message)

    print(("OK: " if ok else "Fehler: ") + message)
    if not ok:
        print(f"::warning::{message}")
    # Ein Garmin-Problem steht im Sync-Status der App; der Workflow schlägt nur fehl,
    # wenn neu verbunden werden muss, damit GitHub zusätzlich per Mail Bescheid gibt.
    return 1 if message.startswith(RELOGIN) else 0


if __name__ == "__main__":
    sys.exit(main())
