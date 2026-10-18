import type { GarminStatus, OverviewData, Session, TodayData, WeekData } from "./api";
import { addDays, mondayOf, todayIso } from "./format";

// Beispieldaten für die Ansicht mit ?demo, solange noch keine echten Daten da sind.

const intervals = (date: string): Session => ({
  id: 2, date, type: "intervals", title: "VO2max-Intervalle", zone: "Z5", duration_min: 60, distance_km: 11,
  hard: 1, status: "geplant", notes: "15 min einlaufen, 5 × 3 min in Z5 mit 2 min Trabpause, 10 min auslaufen",
  structure: [
    { min: 15, zone: "Z2" },
    ...Array.from({ length: 5 }).flatMap((_, i) => (i < 4 ? [{ min: 3, zone: "Z5" as const }, { min: 2, zone: "Z1" as const }] : [{ min: 3, zone: "Z5" as const }])),
    { min: 10, zone: "Z2" },
  ],
});

export function demoToday(): TodayData {
  const date = todayIso();
  return {
    date,
    metrics: {
      date, readiness_score: 78, readiness_level: "HIGH", readiness_feedback: null, vo2max: 51, resting_hr: 52,
      hrv_last_night: 58, hrv_status: "BALANCED", weight_kg: 85,
      factors: [
        { label: "Schlaf", value: "7:42 h, Score 84", percent: 84 },
        { label: "Erholungszeit", value: "noch 2 h", percent: 88 },
        { label: "HRV-Status", value: "58 ms, ausgeglichen", percent: 76 },
        { label: "Akute Belastung", value: "412, optimal", percent: 70 },
        { label: "Stress", value: "niedrig", percent: 82 },
      ],
    },
    sessions: [
      intervals(date),
      { id: 3, date, type: "gym_legs", title: "Gym Beine und hintere Kette", zone: null, duration_min: 50, distance_km: null, hard: 1, status: "geplant", notes: null },
    ],
    sync: [{ source: "garmin", last_ok: new Date(Date.now() - 8 * 60_000).toISOString(), last_message: null, last_ok_flag: 1 }],
  };
}

export function demoWeek(start?: string): WeekData {
  const mo = mondayOf(start ?? todayIso());
  const d = (i: number) => addDays(mo, i);
  const s = (id: number, i: number, type: string, title: string, zone: Session["zone"], hard = 0, status = "geplant"): Session =>
    ({ id, date: d(i), type, title, zone, duration_min: null, distance_km: null, hard, status, notes: null });
  return {
    start: mo, end: d(6),
    sessions: [
      s(1, 0, "easy", "Lockerer Lauf, 40 min Z2", "Z2", 0, "erledigt"),
      s(2, 0, "gym_upper", "Gym Oberkörper", null, 0, "erledigt"),
      s(3, 1, "intervals", "VO2max-Intervalle, 5 × 3 min", "Z5", 1),
      s(4, 1, "gym_legs", "Gym Beine, abends", null, 1),
      s(5, 2, "bike", "Rad auf der Rolle, 60 min Z2", "Z2"),
      s(6, 2, "swim", "Schwimmen, Kraultechnik", "Z1"),
      s(7, 3, "threshold", "Schwelle, 3 × 10 min Z4", "Z4", 1),
      s(8, 3, "padel", "Padel, abends", "Z3", 1),
      s(9, 4, "gym_full", "Gym Ganzkörper", null),
      s(10, 5, "swim", "Schwimmen, Kraultechnik", "Z1"),
      s(11, 6, "long", "Long Run, 20 km Z2", "Z2", 1),
    ],
    activities: [
      { id: "garmin:1", source: "garmin", sport: "run", name: "Lockerer Lauf", start_time: d(0) + "T17:40:00", duration_s: 2790, distance_m: 8200, avg_hr: 144 },
    ],
  };
}

export function demoOverview(): OverviewData {
  return {
    races: [
      { id: 1, name: "WVV Halbmarathon", date: "2027-05-23", date_label: "23. Mai 2027", distance_km: 21.0975, target_seconds: 5879, pb_seconds: 6282 },
      { id: 2, name: "Herbstmarathon", date: null, date_label: "Oktober 2027", distance_km: 42.195, target_seconds: 12599, pb_seconds: 14349 },
    ],
    history: [49, 49, 49.4, 49.5, 50, 49.9, 50, 50.4, 50.7, 50.9, 51, 51].map((v, i) => ({ date: addDays(todayIso(), (i - 11) * 7), vo2max: v, resting_hr: 52, hrv_last_night: 58, weight_kg: 85 })),
    sync: demoToday().sync,
  };
}

export function demoGarmin(): GarminStatus {
  const at = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
  return {
    connected: true,
    tokens_updated_at: at(8),
    login: { started_at: at(60 * 24 * 3), finished_at: at(60 * 24 * 3 - 1), ok: 1, message: "Garmin verbunden" },
    log: [
      { started_at: at(8), finished_at: at(8), ok: 1, message: "2 Tage Gesundheitswerte, 1 Aktivität" },
      { started_at: at(68), finished_at: at(68), ok: 1, message: "2 Tage Gesundheitswerte, 1 Aktivität" },
      { started_at: at(128), finished_at: at(128), ok: 0, message: "Teilweise fehlgeschlagen (2 Tage Gesundheitswerte, 1 Aktivität). HRV 2026-10-18: 503" },
    ],
  };
}
