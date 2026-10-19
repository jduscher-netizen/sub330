import type { Activity, GarminStatus, GymData, OverviewData, Session, TodayData, WeekData, WeekTarget } from "./api";
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

const demoTargets = (): WeekTarget[] => [
  { category: "gym", target_min: 3, target_max: 4, note: null },
  { category: "swim", target_min: 1, target_max: 2, note: "Kraultechnik" },
  { category: "padel", target_min: 1, target_max: 1, note: null },
  { category: "bike", target_min: 0, target_max: 1, note: "Optional, nur Z2" },
];

function act(id: number, date: string, time: string, sport: string, name: string, min: number, m: number | null, hr: number, zones?: number[]): Activity {
  return { id: `garmin:${id}`, source: "garmin", sport, name, start_time: `${date}T${time}`, duration_s: min * 60, distance_m: m, avg_hr: hr, zone_seconds_json: zones ? JSON.stringify(zones) : null };
}

/** Aktivitäten der Beispielwoche: nur Tage vor heute, dazu Gym heute früh */
function demoActivities(mo: string, today: string): Activity[] {
  const d = (i: number) => addDays(mo, i);
  const all = [
    act(1, d(0), "07:10:00", "strength", "Gym Oberkörper", 55, null, 112),
    act(2, d(1), "18:05:00", "run", "Würzburg Intervalle", 62, 11400, 156, [300, 1500, 540, 600, 780]),
    act(3, d(2), "19:30:00", "swim", "Hallenbad", 40, 1500, 128),
    act(4, d(3), "17:45:00", "run", "Schwelle", 59, 11800, 158, [420, 1260, 360, 1500, 0]),
    act(5, d(3), "20:00:00", "padel", "Padel", 85, null, 141),
    act(6, d(4), "07:00:00", "strength", "Gym Beine", 50, null, 118),
    act(7, d(5), "10:00:00", "bike", "Rolle Z2", 60, 28000, 138, [900, 2700, 0, 0, 0]),
  ];
  const past = all.filter((a) => a.start_time.slice(0, 10) < today);
  return [...past, act(9, today, "06:45:00", "strength", "Gym Oberkörper", 50, null, 110)];
}

export function demoToday(): TodayData {
  const date = todayIso();
  const mo = mondayOf(date);
  const week = demoActivities(mo, date);
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
    sessions: [intervals(date)],
    yesterday: [],
    tomorrow: [{ date: addDays(date, 1), type: "easy", title: "Lockerer Lauf, 45 min Z2", hard: 0 }],
    activities: week.filter((a) => a.start_time.slice(0, 10) === date),
    week_activities: week,
    targets: demoTargets(),
    sync: [{ source: "garmin", last_ok: new Date(Date.now() - 8 * 60_000).toISOString(), last_message: null, last_ok_flag: 1 }],
  };
}

export function demoWeek(start?: string): WeekData {
  const mo = mondayOf(start ?? todayIso());
  const d = (i: number) => addDays(mo, i);
  const s = (id: number, i: number, type: string, title: string, zone: Session["zone"], hard: number, min: number, km: number): Session =>
    ({ id, date: d(i), type, title, zone, duration_min: min, distance_km: km, hard, status: "geplant", notes: null, structure: null });
  return {
    start: mo, end: d(6),
    sessions: [
      { ...s(3, 1, "intervals", "VO2max-Intervalle, 5 × 3 min", "Z5", 1, 60, 11), structure: intervals(d(1)).structure },
      s(7, 3, "threshold", "Schwelle, 3 × 10 min Z4", "Z4", 1, 65, 13),
      s(9, 4, "easy", "Lockerer Lauf, 45 min Z2", "Z2", 0, 45, 7.5),
      s(11, 6, "long", "Long Run, 100 min (ca. 17 km)", "Z2", 1, 100, 17),
    ],
    activities: demoActivities(mo, todayIso()),
    targets: demoTargets(),
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

export function demoGym(date?: string): GymData {
  const d = date ?? todayIso();
  const e = (id: number, exercise: string, sets: number, reps: number, weight_kg: number | null) => ({ id, date: d, exercise, sets, reps, weight_kg, note: null });
  const isToday = d === todayIso();
  return {
    date: d,
    entries: isToday ? [e(1, "Kniebeuge", 4, 8, 80), e(2, "Rumänisches Kreuzheben", 3, 10, 70), e(3, "Ausfallschritte", 3, 12, 20)] : [],
    exercises: [
      { exercise: "Bankdrücken", date: addDays(d, -2), sets: 4, reps: 8, weight_kg: 72.5 },
      { exercise: "Klimmzüge", date: addDays(d, -2), sets: 4, reps: 6, weight_kg: null },
      { exercise: "Kniebeuge", date: addDays(d, -5), sets: 4, reps: 8, weight_kg: 77.5 },
      { exercise: "Rumänisches Kreuzheben", date: addDays(d, -5), sets: 3, reps: 10, weight_kg: 67.5 },
      { exercise: "Ausfallschritte", date: addDays(d, -5), sets: 3, reps: 12, weight_kg: 20 },
      { exercise: "Rudern am Kabel", date: addDays(d, -2), sets: 3, reps: 12, weight_kg: 55 },
    ],
    days: [
      ...(isToday ? [{ date: d, exercises: 3, sets: 10, volume: 5380 }] : []),
      { date: addDays(d, -2), exercises: 4, sets: 15, volume: 6120 },
      { date: addDays(d, -5), exercises: 5, sets: 16, volume: 7250 },
    ],
  };
}
