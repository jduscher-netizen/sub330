"""Erzeugt den Plan bis zum WVV Halbmarathon (23.05.2027) als SQL-Migration.

Laufen ist fest nach Tagen geplant (ab 26.10.2026), alles andere nur als Wochenziel
(ab 19.10.2026): Jan entscheidet täglich, wann er Gym, Schwimmen, Padel oder Rad macht.

Aufruf: python plan/generate_plan.py > migrations/0004_plan_hm2027.sql
"""

from __future__ import annotations

import json
from datetime import date, timedelta

RUN_START = date(2026, 10, 26)   # Woche 1, Montag
FLEX_START = date(2026, 10, 19)  # Wochenziele ab hier
RACE = date(2027, 5, 23)

# Geschätzte Pace je Zone in min/km, nur für die Distanz-Angabe
PACE = {"Z1": 6.5, "Z2": 6.0, "Z3": 5.2, "Z4": 4.65, "Z5": 4.3}
WARM, COOL = (15, "Z2"), (10, "Z1")

Block = tuple[int | float, str]


def km(blocks: list[Block]) -> float:
    return round(sum(m / PACE[z] for m, z in blocks), 1)


def easy(minutes: int, note: str | None = None, strides: bool = False) -> dict:
    blocks: list[Block] = [(minutes, "Z2")]
    title = f"Lockerer Lauf, {minutes} min Z2" + (" mit Steigerungen" if strides else "")
    if strides:
        note = (note + " " if note else "") + "Am Ende 6 Steigerungen über 20 s, locker zurücktraben."
    return dict(type="easy", title=title, zone="Z2", hard=0, priority=1, blocks=blocks, notes=note)


def intervals(reps: int, on: float, off: float) -> dict:
    blocks: list[Block] = [WARM]
    for i in range(reps):
        blocks.append((on, "Z5"))
        if i < reps - 1:
            blocks.append((off, "Z1"))
    blocks.append(COOL)
    on_txt = f"{on:g} min"
    note = f"15 min einlaufen, {reps} × {on_txt} in Z5 (ab 172 bpm) mit {off:g} min Trabpause, 10 min auslaufen."
    return dict(type="intervals", title=f"VO2max-Intervalle, {reps} × {on_txt}", zone="Z5", hard=1, priority=2,
                blocks=blocks, notes=note)


def threshold(reps: int, on: int, off: int = 2, hm_pace: bool = False) -> dict:
    blocks: list[Block] = [WARM]
    for i in range(reps):
        blocks.append((on, "Z4"))
        if i < reps - 1:
            blocks.append((off, "Z1"))
    blocks.append(COOL)
    if hm_pace:
        what = "HM-Tempo 4:38/km"
        title = f"HM-Tempo, {reps} × {on} min" if reps > 1 else f"HM-Tempo, {on} min am Stück"
    else:
        what = "Schwelle (160 bis 171 bpm)"
        title = f"Schwelle, {reps} × {on} min Z4" if reps > 1 else f"Tempodauerlauf, {on} min Z4"
    pause = f" mit {off} min Trabpause" if reps > 1 else ""
    note = f"15 min einlaufen, {reps} × {on} min {what}{pause}, 10 min auslaufen." if reps > 1 else \
        f"15 min einlaufen, {on} min {what}, 10 min auslaufen."
    return dict(type="threshold", title=title, zone="Z4", hard=1, priority=2, blocks=blocks, notes=note)


def long(minutes: int, hm_finish: int = 0, hm_blocks: tuple[int, int] | None = None) -> dict:
    if hm_blocks:
        reps, on = hm_blocks
        body = minutes - reps * on - (reps - 1) * 5
        blocks: list[Block] = [(body - 15, "Z2")]
        for i in range(reps):
            blocks.append((on, "Z4"))
            if i < reps - 1:
                blocks.append((5, "Z2"))
        blocks.append((15, "Z2"))
        note = f"Locker in Z2, darin {reps} × {on} min im HM-Tempo 4:38/km mit 5 min locker dazwischen."
    elif hm_finish:
        blocks = [(minutes - hm_finish, "Z2"), (hm_finish, "Z4")]
        note = f"Locker in Z2, die letzten {hm_finish} min im HM-Tempo 4:38/km."
    else:
        blocks = [(minutes, "Z2")]
        note = "Ruhig in Z2 (140 bis 149 bpm), Verpflegung üben ab 90 min."
    k = km(blocks)
    return dict(type="long", title=f"Long Run, {minutes} min (ca. {round(k):d} km)", zone="Z2", hard=1, priority=3,
                blocks=blocks, notes=note)


def test_10k() -> dict:
    blocks: list[Block] = [WARM, (46, "Z4"), COOL]
    return dict(type="threshold", title="Testlauf 10 km", zone="Z4", hard=1, priority=3, blocks=blocks,
                notes="10 km volle Kontrolle, Ziel unter 46:00. Gibt einen echten Stand für das HM-Tempo.")


def race() -> dict:
    blocks: list[Block] = [(10, "Z2"), (98, "Z4")]
    return dict(type="race", title="WVV Halbmarathon", zone="Z4", hard=1, priority=4, blocks=blocks,
                notes="Ziel unter 1:38:00, also 4:38/km. Erste 5 km kontrolliert, ab km 15 laufen lassen.",
                distance=21.1)


# Wochen 1 bis 30: (Phase, Intervall-Tag, Schwellen-Tag, Fr oder None, So, Notiz zur Woche)
# Tage: Schwelle bzw. HM-Tempo am Dienstag, Intervalle am Donnerstag (Wunsch von Jan, 18.10.2026)
THRESHOLD_DAY, INTERVAL_DAY = 1, 3
WEEKS = [
    # Grundlage
    ("Grundlage", easy(30, "Zwei Wochen nach dem Marathon: nur locker."), easy(35), None, easy(50), "Wiedereinstieg"),
    ("Grundlage", easy(40, strides=True), easy(40), None, long(60), None),
    ("Grundlage", intervals(6, 1, 2), threshold(3, 6), easy(40), long(70), None),
    ("Grundlage", intervals(8, 1, 2), threshold(3, 8), easy(40), long(80), None),
    ("Grundlage", intervals(5, 2, 2), threshold(3, 8), easy(45), long(85), None),
    ("Grundlage", intervals(6, 1, 2), threshold(2, 8), None, long(70), "Entlastungswoche"),
    ("Grundlage", intervals(5, 3, 2), threshold(3, 10), easy(45), long(90), None),
    ("Grundlage", intervals(6, 3, 2), threshold(2, 12, 3), easy(45), long(95), None),
    ("Grundlage", intervals(5, 2, 2), threshold(2, 10), None, long(75), "Weihnachten: Entlastungswoche"),
    ("Grundlage", intervals(5, 3, 2), threshold(3, 10), easy(45), long(100), None),
    # Aufbau
    ("Aufbau", intervals(5, 3, 2), threshold(3, 10), easy(45), long(100), None),
    ("Aufbau", intervals(6, 3, 2), threshold(2, 15, 3), easy(50), long(105), None),
    ("Aufbau", intervals(5, 4, 2.5), threshold(3, 12, 2), easy(50), long(110), None),
    ("Aufbau", intervals(5, 3, 2), threshold(2, 10), None, long(85), "Entlastungswoche"),
    ("Aufbau", intervals(4, 5, 3), threshold(2, 15, 3), easy(50), long(115), None),
    ("Aufbau", intervals(6, 4, 2.5), threshold(1, 25), easy(50), long(120), None),
    ("Aufbau", intervals(5, 5, 3), threshold(3, 12, 2), easy(55), long(125), None),
    ("Aufbau", intervals(5, 3, 2), threshold(2, 12, 3), None, long(90), "Entlastungswoche"),
    ("Aufbau", intervals(6, 4, 2.5), threshold(1, 30), easy(55), long(130), None),
    # Spezifisch
    ("Spezifisch", intervals(6, 4, 2.5), threshold(3, 10, 2, True), easy(50), long(110, hm_finish=20), None),
    ("Spezifisch", intervals(5, 5, 3), threshold(2, 15, 3, True), easy(55), long(120, hm_blocks=(2, 15)), None),
    ("Spezifisch", intervals(8, 2, 1.5), threshold(3, 12, 2, True), easy(55), long(125, hm_finish=30), None),
    ("Spezifisch", intervals(5, 3, 2), threshold(2, 10, 2, True), None, long(90), "Entlastungswoche"),
    ("Spezifisch", intervals(5, 4, 2.5), threshold(2, 15, 3, True), easy(50), test_10k(), "Testlauf am Sonntag"),
    ("Spezifisch", intervals(6, 4, 2.5), threshold(2, 20, 3, True), easy(55), long(120, hm_blocks=(2, 15)), None),
    ("Spezifisch", intervals(5, 5, 3), threshold(1, 25, hm_pace=True), easy(55), long(130, hm_finish=30), None),
    ("Spezifisch", intervals(6, 3, 2), threshold(2, 20, 3, True), easy(50), long(110, hm_finish=20), None),
    # Tapering
    ("Tapering", intervals(5, 3, 2), threshold(2, 12, 2, True), easy(45), long(90), None),
    ("Tapering", intervals(4, 3, 2), threshold(2, 10, 2, True), easy(40), long(70), None),
    ("Tapering", intervals(5, 2, 2), threshold(3, 5, 2, True), None, race(), "Rennwoche"),
]


def week_targets(week_no: int, phase: str | None, note: str | None) -> list[tuple[str, int, int, str | None]]:
    """Wochenziele für Gym, Schwimmen, Padel, Rad: (Kategorie, min, max, Hinweis)."""
    deload = note and "Entlastung" in note
    if week_no == 0:
        return [("gym", 3, 4, "Laufpause nach dem Marathon: Gym und Schwimmen dürfen den Ton angeben."),
                ("swim", 1, 2, "Kraultechnik"), ("padel", 1, 1, None), ("bike", 0, 2, "Statt Laufen, nur Z2")]
    if week_no == 30:
        return [("gym", 1, 2, "Rennwoche: keine schweren Beine"), ("swim", 0, 1, "Nur locker"),
                ("padel", 0, 0, "Rennwoche: kein Padel"), ("bike", 0, 1, "Nur locker Z2")]
    if phase == "Tapering":
        return [("gym", 2, 3, "Beine leichter, Oberkörper normal"), ("swim", 1, 2, "Kraultechnik"),
                ("padel", 0, 1, None), ("bike", 0, 1, "Nur Z2")]
    return [("gym", 2 if deload else 3, 3 if deload else 4, "Entlastungswoche: ein Gym weniger ist okay" if deload else None),
            ("swim", 1, 2, "Kraultechnik"), ("padel", 1, 1, None), ("bike", 0, 1, "Optional, nur Z2")]


def q(v) -> str:
    if v is None:
        return "NULL"
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace("'", "''") + "'"


def main() -> None:
    out = ["-- Plan bis zum WVV Halbmarathon 23.05.2027, erzeugt mit plan/generate_plan.py (Schwelle Di, Intervalle Do)",
           "DELETE FROM planned_sessions WHERE date BETWEEN '2026-10-19' AND '2027-05-23';",
           "DELETE FROM week_targets WHERE week_start BETWEEN '2026-10-19' AND '2027-05-23';"]
    assert RUN_START + timedelta(weeks=len(WEEKS) - 1, days=6) == RACE, "Woche 30 muss mit dem Renntag enden"

    rows = []
    for i, (phase, quality_a, quality_b, fri, sun, note) in enumerate(WEEKS):
        monday = RUN_START + timedelta(weeks=i)
        sat_easy = easy(20, strides=True) if i == len(WEEKS) - 1 else None
        # quality_a steht in WEEKS an erster Stelle (Intervalle bzw. in Woche 1 und 2 locker), quality_b an zweiter
        for offset, s in ((INTERVAL_DAY, quality_a), (THRESHOLD_DAY, quality_b), (4, fri), (5, sat_easy), (6, sun)):
            if not s:
                continue
            d = monday + timedelta(days=offset)
            blocks = s["blocks"]
            minutes = round(sum(m for m, _ in blocks))
            structure = json.dumps([{"min": m, "zone": z} for m, z in blocks])
            dist = s.get("distance") or km(blocks)
            rows.append(f"({q(d.isoformat())}, 0, {q(s['type'])}, {q(s['title'])}, {q(s['zone'])}, {minutes}, {dist}, "
                        f"{s['hard']}, {s['priority']}, 'geplant', {q(structure)}, {q(s['notes'])})")
    out.append("INSERT INTO planned_sessions (date, sort, type, title, zone, duration_min, distance_km, hard, priority, "
               "status, structure_json, notes) VALUES\n  " + ",\n  ".join(rows) + ";")

    trows = []
    for week_no in range(0, len(WEEKS) + 1):
        monday = FLEX_START + timedelta(weeks=week_no)
        phase, note = (WEEKS[week_no - 1][0], WEEKS[week_no - 1][5]) if week_no else (None, None)
        for cat, lo, hi, hint in week_targets(week_no, phase, note):
            trows.append(f"({q(monday.isoformat())}, {q(cat)}, {lo}, {hi}, {q(hint)})")
    out.append("INSERT INTO week_targets (week_start, category, target_min, target_max, note) VALUES\n  "
               + ",\n  ".join(trows) + ";")
    print("\n\n".join(out))


if __name__ == "__main__":
    main()
