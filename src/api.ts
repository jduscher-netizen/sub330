import { demoGarmin, demoOverview, demoToday, demoWeek } from "./demo";

export type Zone = "Z1" | "Z2" | "Z3" | "Z4" | "Z5";

export interface Factor { label: string; value: string; percent: number }
export interface Metrics {
  date: string;
  readiness_score: number | null;
  readiness_level: string | null;
  readiness_feedback: string | null;
  vo2max: number | null;
  resting_hr: number | null;
  hrv_last_night: number | null;
  hrv_status: string | null;
  weight_kg: number | null;
  factors: Factor[] | null;
}
export interface Block { min: number; zone: Zone }
export interface Session {
  id: number;
  date: string;
  type: string;
  title: string;
  zone: Zone | null;
  duration_min: number | null;
  distance_km: number | null;
  hard: number;
  status: string;
  notes: string | null;
  structure?: Block[] | null;
  activity_id?: string | null;
}
export interface SyncState { source: string; last_ok: string | null; last_message: string | null; last_ok_flag: number | null }
export interface Activity { id: string; source: string; sport: string; name: string | null; start_time: string; duration_s: number | null; distance_m: number | null; avg_hr: number | null; zone_seconds_json?: string | null }
export interface Race { id: number; name: string; date: string | null; date_label: string | null; distance_km: number; target_seconds: number | null; pb_seconds: number | null }

export interface TodayData { date: string; metrics: Metrics | null; sessions: Session[]; sync: SyncState[] }
export interface WeekData { start: string; end: string; sessions: Session[]; activities: Activity[] }
export interface OverviewData { races: Race[]; history: Partial<Metrics>[]; sync: SyncState[] }
export interface SyncLogEntry { id?: number; started_at: string; finished_at: string | null; ok: number; message: string | null }
export interface GarminStatus { connected: boolean; tokens_updated_at: string | null; login: SyncLogEntry | null; log: SyncLogEntry[] }

export type Result<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

export const isDemo = new URLSearchParams(location.search).has("demo");

async function get<T>(path: string, demo: () => T): Promise<Result<T>> {
  if (isDemo) return { ok: true, data: demo() };
  try {
    const res = await fetch(path, { credentials: "include" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, status: res.status, message: body.message ?? `Fehler ${res.status}` };
    return { ok: true, data: body as T };
  } catch {
    return { ok: false, status: 0, message: "Keine Verbindung. Prüfe dein Netz und lade neu." };
  }
}

async function post(path: string, body?: unknown): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch(path, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, message: data.message };
  } catch {
    return { ok: false, message: "Keine Verbindung. Prüfe dein Netz." };
  }
}

export const api = {
  login: (password: string) => post("/api/login", { password }),
  logout: () => post("/api/logout"),
  today: () => get<TodayData>("/api/today", demoToday),
  week: (start?: string) => get<WeekData>(`/api/week${start ? `?start=${start}` : ""}`, () => demoWeek(start)),
  overview: () => get<OverviewData>("/api/overview", demoOverview),
  garmin: () => get<GarminStatus>("/api/garmin", demoGarmin),
  syncNow: () => (isDemo ? new Promise<{ ok: boolean; message?: string }>((r) => setTimeout(() => r({ ok: true }), 600)) : post("/api/garmin/sync")),
  sendMfaCode: (code: string) => (isDemo ? Promise.resolve({ ok: true, message: undefined }) : post("/api/garmin/mfa", { code })),
};
