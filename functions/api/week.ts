import { activitiesBetween, addDays, isIsoDate, json, manualBetween, mondayOf, todayBerlin, weekTargets, type Env } from "../_lib/types";

// Wochenplan: geplante Läufe, Wochenziele und absolvierte Aktivitäten von Montag bis Sonntag.
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const q = new URL(request.url).searchParams.get("start");
  const start = mondayOf(isIsoDate(q) ? q : todayBerlin());
  const end = addDays(start, 6);

  const [sessions, activities, targets, manual] = await Promise.all([
    env.DB.prepare("SELECT * FROM planned_sessions WHERE date BETWEEN ? AND ? ORDER BY date, sort, id")
      .bind(start, end).all(),
    activitiesBetween(env, start, end),
    weekTargets(env, start),
    manualBetween(env, start, end),
  ]);

  const parsed = sessions.results.map((s) => {
    let structure = null;
    try { structure = s.structure_json ? JSON.parse(s.structure_json as string) : null; } catch { structure = null; }
    return { ...s, structure };
  });
  return json({ start, end, sessions: parsed, activities: activities.results, targets: targets.results, manual: manual.results });
};
