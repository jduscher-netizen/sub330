import { isIsoDate, json, todayBerlin, type Env } from "../_lib/types";

// Alles für den Heute-Screen in einem Aufruf.
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const q = new URL(request.url).searchParams.get("date");
  const date = isIsoDate(q) ? q : todayBerlin();

  const [metrics, sessions, sync] = await Promise.all([
    env.DB.prepare("SELECT * FROM daily_metrics WHERE date <= ? ORDER BY date DESC LIMIT 1").bind(date).first(),
    env.DB.prepare("SELECT * FROM planned_sessions WHERE date = ? ORDER BY sort, id").bind(date).all(),
    lastSync(env),
  ]);

  return json({
    date,
    metrics: metrics ? { ...metrics, factors: parse(metrics.factors_json as string | null) } : null,
    sessions: sessions.results.map((s) => ({ ...s, structure: parse(s.structure_json as string | null) })),
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
