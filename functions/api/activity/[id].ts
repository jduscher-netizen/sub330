import { analyze } from "../../_lib/analysis";
import { loadActivity, plannedFor } from "../../_lib/coach";
import { json, type Env } from "../../_lib/types";

// Eine Aktivität mit Auswertung, Plan-Abgleich, Runden und Verlauf für die Detailansicht.
export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  const id = decodeURIComponent(String(params.id));
  const a = await loadActivity(env, id);
  if (!a) return json({ error: "not_found", message: "Aktivität nicht gefunden." }, 404);
  const plan = await plannedFor(env, a);
  const day = a.start_time.slice(0, 10);
  const metrics = await env.DB.prepare("SELECT readiness_score, hrv_last_night, hrv_status, sleep_score, resting_hr FROM daily_metrics WHERE date = ?").bind(day).first();
  const parse = (s: string | null | undefined) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };
  return json({
    activity: { ...a, details_json: undefined, laps_json: undefined, stream_json: undefined, zone_seconds_json: undefined, zones: parse(a.zone_seconds_json) },
    details: parse(a.details_json),
    laps: parse(a.laps_json) ?? [],
    stream: parse(a.stream_json),
    planned: plan,
    analysis: analyze(a, plan),
    metrics,
    ai_comment: (a as { ai_comment?: string | null }).ai_comment ?? null,
    ai_enabled: Boolean(env.ANTHROPIC_API_KEY),
  });
};
