export interface Env {
  DB: D1Database;
  /** Passwort für den Login (Pages-Secret) */
  APP_PASSWORD?: string;
  /** GitHub-Token (fine-grained, nur Actions: write auf dieses Repo) für "Jetzt synchronisieren" */
  GH_ACTIONS_TOKEN?: string;
  /** Claude-API für den KI-Coach und die Kommentare zu Läufen (Pages-Secret) */
  ANTHROPIC_API_KEY?: string;
  /** Nur für lokale Tests gegen einen Nachbau der API */
  ANTHROPIC_BASE_URL?: string;
  /** Nur lokal: "1" schaltet die Zugangsprüfung ab (.dev.vars) */
  DEV_NO_AUTH?: string;
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

/** Heutiges Datum in Europe/Berlin als YYYY-MM-DD */
export function todayBerlin(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
}

export function isIsoDate(s: string | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function addDays(date: string, days: number): string {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function mondayOf(date: string): string {
  const d = new Date(date + "T12:00:00Z");
  return addDays(date, -((d.getUTCDay() + 6) % 7)); // Montag = 0
}

const ACTIVITY_COLS = "id, source, sport, name, start_time, duration_s, distance_m, avg_hr, zone_seconds_json";

/** Garmin-Aktivitäten zwischen zwei Tagen (inklusive) */
export function activitiesBetween(env: Env, start: string, end: string) {
  return env.DB.prepare(
    `SELECT ${ACTIVITY_COLS} FROM activities WHERE substr(start_time, 1, 10) BETWEEN ? AND ? ORDER BY start_time`,
  ).bind(start, end).all();
}

/** Wochenziele (Gym, Schwimmen, Padel, Rad) einer Woche */
export function weekTargets(env: Env, monday: string) {
  return env.DB.prepare("SELECT category, target_min, target_max, note FROM week_targets WHERE week_start = ?")
    .bind(monday).all();
}
