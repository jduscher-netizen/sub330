import { addDays, isIsoDate, json, todayBerlin, type Env } from "../_lib/types";

// Wochenplan: geplante Einheiten und absolvierte Aktivitäten von Montag bis Sonntag.
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const q = new URL(request.url).searchParams.get("start");
  const start = mondayOf(isIsoDate(q) ? q : todayBerlin());
  const end = addDays(start, 6);

  const [sessions, activities] = await Promise.all([
    env.DB.prepare("SELECT * FROM planned_sessions WHERE date BETWEEN ? AND ? ORDER BY date, sort, id")
      .bind(start, end).all(),
    env.DB.prepare(
      "SELECT id, source, sport, name, start_time, duration_s, distance_m, avg_hr FROM activities WHERE substr(start_time, 1, 10) BETWEEN ? AND ? ORDER BY start_time",
    ).bind(start, end).all(),
  ]);

  return json({ start, end, sessions: sessions.results, activities: activities.results });
};

function mondayOf(date: string): string {
  const d = new Date(date + "T12:00:00Z");
  const offset = (d.getUTCDay() + 6) % 7; // Montag = 0
  return addDays(date, -offset);
}
