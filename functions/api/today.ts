import { activitiesBetween, addDays, isIsoDate, json, manualBetween, mondayOf, todayBerlin, weekTargets, type Env } from "../_lib/types";

// Alles für den Heute-Screen in einem Aufruf.
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const q = new URL(request.url).searchParams.get("date");
  const date = isIsoDate(q) ? q : todayBerlin();

  const monday = mondayOf(date);
  const [metrics, sessions, around, weekActs, targets, manual, sync] = await Promise.all([
    // Zeilen nur mit Gewicht (von Hand eingetragen) zählen nicht als Tageswerte von Garmin
    env.DB.prepare(
      "SELECT * FROM daily_metrics WHERE date <= ? AND (readiness_score IS NOT NULL OR resting_hr IS NOT NULL OR hrv_last_night IS NOT NULL) ORDER BY date DESC LIMIT 1",
    ).bind(date).first(),
    env.DB.prepare("SELECT * FROM planned_sessions WHERE date = ? ORDER BY sort, id").bind(date).all(),
    // Gestern und morgen, für die Hinweise zu harten Tagen
    env.DB.prepare("SELECT date, type, title, hard FROM planned_sessions WHERE date IN (?, ?) ORDER BY date, sort, id")
      .bind(addDays(date, -1), addDays(date, 1)).all(),
    activitiesBetween(env, monday, addDays(monday, 6)),
    weekTargets(env, monday),
    manualBetween(env, monday, addDays(monday, 6)),
    lastSync(env),
  ]);

  return json({
    date,
    metrics: metrics ? { ...metrics, factors: parse(metrics.factors_json as string | null) } : null,
    sessions: sessions.results.map((s) => ({ ...s, structure: parse(s.structure_json as string | null) })),
    yesterday: around.results.filter((s) => s.date === addDays(date, -1)),
    tomorrow: around.results.filter((s) => s.date === addDays(date, 1)),
    activities: weekActs.results.filter((a) => String(a.start_time).slice(0, 10) === date),
    week_activities: weekActs.results,
    targets: targets.results,
    manual: manual.results,
    sync,
  });
};

export async function lastSync(env: Env) {
  const rows = await env.DB.prepare(
    `SELECT source,
            MAX(CASE WHEN ok = 1 THEN finished_at END) AS last_ok,
            (SELECT message FROM sync_log l2 WHERE l2.source = l.source ORDER BY started_at DESC LIMIT 1) AS last_message,
            (SELECT ok FROM sync_log l3 WHERE l3.source = l.source ORDER BY started_at DESC LIMIT 1) AS last_ok_flag
     FROM sync_log l GROUP BY source`,
  ).all();
  return rows.results;
}

function parse(s: string | null): unknown {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
