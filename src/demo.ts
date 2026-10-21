import type { Activity, ActivityDetail, CoachData, GarminStatus, GymData, Lap, OverviewData, Session, TodayData, WeekData, WeekTarget } from "./api";
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
  { category: "mobility", target_min: 2, target_max: 2, note: "Von Hand abhaken, Garmin zeichnet das nicht auf" },
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
    manual: [{ id: 1, date: mo, category: "mobility" }],
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
    manual: [{ id: 1, date: mo, category: "mobility" }],
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
  const isToday = d === todayIso();
  const legs = ["Kniebeuge", "Rumänisches Kreuzheben", "Beinpresse", "Ausfallschritte", "Beinbeuger", "Wadenheben"];
  const last = (exercise: string, daysAgo: number, sets: number, reps: number, weight_kg: number | null) => ({ exercise, date: addDays(d, -daysAgo), sets, reps, weight_kg });
  return {
    date: d,
    entries: isToday ? [
      { id: 1, date: d, exercise: "Kniebeuge", sets: 4, reps: 8, weight_kg: 82.5, note: null, day_type: "legs" as const },
      { id: 2, date: d, exercise: "Rumänisches Kreuzheben", sets: 3, reps: 10, weight_kg: 70, note: null, day_type: "legs" as const },
    ] : [],
    exercises: [
      last("Kniebeuge", 5, 4, 8, 80), last("Rumänisches Kreuzheben", 5, 3, 10, 67.5), last("Beinpresse", 5, 3, 12, 140),
      last("Ausfallschritte", 5, 3, 12, 20), last("Beinbeuger", 5, 3, 12, 45), last("Wadenheben", 5, 4, 15, 60),
      last("Bankdrücken", 3, 4, 8, 72.5), last("Schulterdrücken", 3, 3, 10, 22), last("Klimmzüge", 2, 4, 6, null), last("Rudern am Kabel", 2, 3, 12, 55),
    ],
    days: [
      ...(isToday ? [{ date: d, day_type: "legs" as const, exercises: 2, sets: 7, volume: 4740 }] : []),
      { date: addDays(d, -2), day_type: "pull" as const, exercises: 5, sets: 16, volume: 6120 },
      { date: addDays(d, -3), day_type: "push" as const, exercises: 5, sets: 15, volume: 5900 },
      { date: addDays(d, -5), day_type: "legs" as const, exercises: 6, sets: 20, volume: 9250 },
    ],
    templates: { push: ["Bankdrücken", "Schulterdrücken", "Schrägbankdrücken", "Seitheben", "Trizepsdrücken"], pull: ["Klimmzüge", "Rudern am Kabel", "Latzug", "Face Pulls", "Bizepscurls"], legs },
    last_by_type: { push: addDays(d, -3), pull: addDays(d, -2), legs: addDays(d, -5) },
  };
}

/** Beispiel-Intervalllauf mit Verlauf und Runden für die Detailansicht */
export function demoActivity(id: string): ActivityDetail {
  const date = todayIso();
  const laps: Lap[] = [{ dist: 2600, dur: 900, v: 2.89, hr: 141, hr_max: 149, cad: 166, elev: 6, kind: "WARMUP" }];
  for (let i = 0; i < 5; i++) {
    laps.push({ dist: 760 - i * 8, dur: 180, v: 4.22 - i * 0.045, hr: 168 + i, hr_max: 176 + i, cad: 182, elev: 1, kind: "INTERVAL" });
    if (i < 4) laps.push({ dist: 300, dur: 120, v: 2.5, hr: 152, hr_max: 165, cad: 160, elev: 0, kind: "RECOVERY" });
  }
  laps.push({ dist: 1700, dur: 600, v: 2.83, hr: 146, hr_max: 152, cad: 164, elev: 3, kind: "COOLDOWN" });
  const t: number[] = [], hr: number[] = [], v: number[] = [], alt: number[] = [], cad: number[] = [];
  let time = 0, h = 120;
  for (const l of laps) {
    for (let s = 0; s < l.dur; s += 10) {
      time += 10;
      h += ((l.hr ?? 140) + (l.kind === "INTERVAL" ? 6 * (s / l.dur) : 0) - h) * 0.12;
      t.push(time); hr.push(Math.round(h)); v.push(Math.round((l.v + Math.sin(time / 37) * 0.05) * 100) / 100);
      alt.push(Math.round((180 + Math.sin(time / 400) * 6) * 10) / 10); cad.push(l.cad ?? 165);
    }
  }
  const zones = [420, 1260, 360, 600, 540];
  return {
    activity: { id, source: "garmin", sport: "run", name: "Würzburg Intervalle", start_time: `${date}T18:05:00`, duration_s: time, distance_m: 9800, avg_hr: 154, max_hr: 181, training_load: 142, zones },
    details: { avg_speed: 3.11, elev_gain: 38, cadence: 171, te_aerobic: 3.6, te_anaerobic: 3.1, te_label: "VO2MAX", calories: 640, vo2max: 51 },
    laps, stream: { t, hr, v, alt, cad },
    planned: { id: 2, date, type: "intervals", title: "VO2max-Intervalle, 5 × 3 min", zone: "Z5", duration_min: 62, distance_km: 11, hard: 1, status: "geplant", notes: null },
    analysis: {
      verdict: "erfüllt", headline: "VO2max-Intervalle, 5 × 3 min: Vorgabe erfüllt",
      findings: [
        { tone: "good", text: "Umfang passt: 55 von 62 min." },
        { tone: "good", text: "9 min in Z5 und 10 min in Z4 bei 15 min geplanter Belastung. Intensität erreicht." },
        { tone: "good", text: "5 von 5 Belastungen erkannt, Schnitt 4:05/km." },
        { tone: "warn", text: "Letzte Belastung 4:12/km, erste 3:57/km: deutlich nachgelassen. Erste Wiederholung kontrollierter angehen." },
      ],
      pace_s_per_km: 3300 / 9.8, zones: { sec: zones, pct: [13, 39, 11, 19, 17] }, easy_pct: 52, decoupling_pct: null,
      splits: [348, 344, 300, 262, 330, 251, 318, 247, 335].map((sec, i) => ({ km: i + 1, sec, hr: [139, 144, 158, 171, 155, 174, 157, 177, 149][i] })),
      reps: laps.filter((l) => l.kind === "INTERVAL").map((l, i) => ({ n: i + 1, dur: l.dur, dist: l.dist, pace: 1000 / l.v, hr: l.hr, hr_max: l.hr_max })),
      planned: { title: "VO2max-Intervalle, 5 × 3 min", type: "intervals", duration_min: 62, distance_km: 11, target_min: { Z2: 15, Z5: 15, Z1: 18 } },
    },
    metrics: { readiness_score: 78, hrv_last_night: 58, sleep_score: 84, resting_hr: 52 },
    ai_comment: null, ai_enabled: true,
  };
}

export function demoCoach(): CoachData {
  const at = new Date().toISOString();
  return {
    thread: 1, enabled: true,
    messages: [
      { role: "user", text: "Wie war meine Woche bisher?", at },
      { role: "assistant", text: "Bisher 23 km in 2 von 4 Läufen, beide im Soll. Die Intervalle am Dienstag waren stark, nur die letzte Wiederholung wurde langsamer.\n\nGym 3 von 3 bis 4 ist schon erfüllt, Schwimmen fehlt noch. Morgen steht die Schwelle an, heute also nur Oberkörper oder Schwimmen, keine Beine.", tools: ["get_week", "analyze_activity"], at },
    ],
  };
}
