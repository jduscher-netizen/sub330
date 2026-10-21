import { addToTemplate, dayType, parseEntry, type EntryInput } from "../../_lib/gym";
import { isIsoDate, json, todayBerlin, type Env } from "../../_lib/types";

// Trainingstagebuch: Übungen eines Tages, bekannte Übungen mit letzten Werten, letzte Trainingstage.
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const q = new URL(request.url).searchParams.get("date");
  const date = isIsoDate(q) ? q : todayBerlin();

  const [entries, exercises, days, templates, lastByType] = await Promise.all([
    env.DB.prepare("SELECT id, date, exercise, sets, reps, weight_kg, note, day_type FROM gym_entries WHERE date = ? ORDER BY id")
      .bind(date).all(),
    // Letzter Eintrag je Übung vor diesem Tag, für Vorschläge und "letztes Mal"
    env.DB.prepare(
      `SELECT g.exercise, g.date, g.sets, g.reps, g.weight_kg FROM gym_entries g
       JOIN (SELECT exercise COLLATE NOCASE AS ex, MAX(id) AS id FROM gym_entries WHERE date < ? GROUP BY ex) last ON last.id = g.id
       ORDER BY g.date DESC, g.id DESC LIMIT 200`,
    ).bind(date).all(),
    env.DB.prepare(
      `SELECT date, MAX(day_type) AS day_type, COUNT(*) AS exercises, SUM(sets) AS sets, SUM(sets * reps * COALESCE(weight_kg, 0)) AS volume
       FROM gym_entries GROUP BY date ORDER BY date DESC LIMIT 12`,
    ).all(),
    env.DB.prepare("SELECT day_type, exercise FROM gym_templates ORDER BY day_type, ord").all<{ day_type: string; exercise: string }>(),
    env.DB.prepare("SELECT day_type, MAX(date) AS date FROM gym_entries WHERE day_type IS NOT NULL AND date < ? GROUP BY day_type").bind(date).all<{ day_type: string; date: string }>(),
  ]);
  const tpl: Record<string, string[]> = { push: [], pull: [], legs: [] };
  for (const t of templates.results) (tpl[t.day_type] ??= []).push(t.exercise);
  const last: Record<string, string | null> = { push: null, pull: null, legs: null };
  for (const l of lastByType.results) last[l.day_type] = l.date;
  return json({ date, entries: entries.results, exercises: exercises.results, days: days.results, templates: tpl, last_by_type: last });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const input = (await request.json().catch(() => ({}))) as EntryInput;
  const parsed = parseEntry(input);
  if (!parsed.ok) return json({ ok: false, message: parsed.message }, 400);
  const p = { ...parsed, input };
  const body = p.input;
  const type = dayType(body.day_type);
  const insert = env.DB.prepare(
    "INSERT INTO gym_entries (date, exercise, sets, reps, weight_kg, note, day_type) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id",
  ).bind(...p.v, type);
  const [res] = await env.DB.batch<{ id: number }>(type ? [insert, addToTemplate(env.DB, type, p.v[1])] : [insert]);
  return json({ ok: true, id: res.results[0]?.id });
};
