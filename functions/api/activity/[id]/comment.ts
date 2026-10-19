import Anthropic from "@anthropic-ai/sdk";
import { analyze } from "../../../_lib/analysis";
import { activityComment, loadActivity, plannedFor } from "../../../_lib/coach";
import { json, type Env } from "../../../_lib/types";

// KI-Kommentar zu einer Aktivität erzeugen und speichern.
export const onRequestPost: PagesFunction<Env> = async ({ env, params }) => {
  if (!env.ANTHROPIC_API_KEY) return json({ ok: false, message: "Der KI-Coach ist noch nicht eingerichtet: GitHub-Secret ANTHROPIC_API_KEY fehlt." }, 503);
  const id = decodeURIComponent(String(params.id));
  const a = await loadActivity(env, id);
  if (!a) return json({ ok: false, message: "Aktivität nicht gefunden." }, 404);
  const plan = await plannedFor(env, a);
  const an = analyze(a, plan);
  const day = a.start_time.slice(0, 10);
  const [metrics, recent] = await Promise.all([
    env.DB.prepare("SELECT readiness_score, hrv_last_night, hrv_status, sleep_score, resting_hr, acute_load FROM daily_metrics WHERE date = ?").bind(day).first(),
    env.DB.prepare("SELECT date, type, title FROM planned_sessions WHERE date > ? ORDER BY date LIMIT 4").bind(day).all(),
  ]);
  try {
    const text = await activityComment(env, {
      aktivitaet: { sport: a.sport, name: a.name, start: a.start_time, dauer_min: Math.round((a.duration_s ?? 0) / 60), km: (a.distance_m ?? 0) / 1000, puls_schnitt: a.avg_hr, puls_max: a.max_hr },
      details: a.details_json ? JSON.parse(a.details_json) : null,
      geplant: plan ? { titel: plan.title, typ: plan.type, dauer_min: plan.duration_min, km: plan.distance_km, hinweis: plan.notes } : null,
      auswertung: { urteil: an.verdict, befunde: an.findings, zonen_prozent: an.zones?.pct, entkopplung_prozent: an.decoupling_pct, km_splits: an.splits, belastungen: an.reps },
      tageswerte: metrics,
      naechste_einheiten: recent.results,
    });
    await env.DB.prepare("UPDATE activities SET ai_comment = ?, ai_comment_at = datetime('now') WHERE id = ?").bind(text, id).run();
    return json({ ok: true, text });
  } catch (e) {
    const message = e instanceof Anthropic.RateLimitError ? "Der KI-Dienst ist gerade ausgelastet. Bitte gleich nochmal."
      : e instanceof Anthropic.AuthenticationError ? "Der API-Schlüssel wird abgelehnt. Prüfe ANTHROPIC_API_KEY."
      : e instanceof Anthropic.APIError ? `KI-Dienst meldet Fehler ${e.status}.`
      : "KI-Kommentar konnte nicht erstellt werden.";
    return json({ ok: false, message }, 502);
  }
};
