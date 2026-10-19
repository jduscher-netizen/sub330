import { parseEntry, type EntryInput } from "../../_lib/gym";
import { isIsoDate, json, todayBerlin, type Env } from "../../_lib/types";

// Trainingstagebuch: Übungen eines Tages, bekannte Übungen mit letzten Werten, letzte Trainingstage.
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const q = new URL(request.url).searchParams.get("date");
  const date = isIsoDate(q) ? q : todayBerlin();

  const [entries, exercises, days] = await Promise.all([
    env.DB.prepare("SELECT id, date, exercise, sets, reps, weight_kg, note FROM gym_entries WHERE date = ? ORDER BY id")
      .bind(date).all(),
    // Letzter Eintrag je Übung vor diesem Tag, für Vorschläge und "letztes Mal"
    env.DB.prepare(
      `SELECT g.exercise, g.date, g.sets, g.reps, g.weight_kg FROM gym_entries g
       JOIN (SELECT exercise COLLATE NOCASE AS ex, MAX(id) AS id FROM gym_entries WHERE date < ? GROUP BY ex) last ON last.id = g.id
       ORDER BY g.date DESC, g.id DESC LIMIT 200`,
    ).bind(date).all(),
    env.DB.prepare(
      `SELECT date, COUNT(*) AS exercises, SUM(sets) AS sets, SUM(sets * reps * COALESCE(weight_kg, 0)) AS volume
       FROM gym_entries GROUP BY date ORDER BY date DESC LIMIT 12`,
    ).all(),
  ]);
  return json({ date, entries: entries.results, exercises: exercises.results, days: days.results });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const p = parseEntry((await request.json().catch(() => ({}))) as EntryInput);
  if (!p.ok) return json({ ok: false, message: p.message }, 400);
  const row = await env.DB.prepare(
    "INSERT INTO gym_entries (date, exercise, sets, reps, weight_kg, note) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
  ).bind(...p.v).first<{ id: number }>();
  return json({ ok: true, id: row?.id });
};
