import { dayType } from "../../_lib/gym";
import { json, type Env } from "../../_lib/types";

// Übungsliste eines Gym-Tages (Push, Pull, Legs) in fester Reihenfolge speichern.
export const onRequestPut: PagesFunction<Env> = async ({ request, env }) => {
  const body = (await request.json().catch(() => ({}))) as { day_type?: unknown; exercises?: unknown };
  const type = dayType(body.day_type);
  if (!type) return json({ ok: false, message: "Unbekannter Gym-Tag." }, 400);
  const list = Array.isArray(body.exercises) ? body.exercises : null;
  if (!list || list.length > 30) return json({ ok: false, message: "Höchstens 30 Übungen." }, 400);
  const names: string[] = [];
  for (const x of list) {
    const n = typeof x === "string" ? x.trim().replace(/\s+/g, " ") : "";
    if (!n || n.length > 60) return json({ ok: false, message: "Übungsnamen dürfen nicht leer sein." }, 400);
    if (!names.some((m) => m.toLowerCase() === n.toLowerCase())) names.push(n);
  }
  const insert = env.DB.prepare("INSERT INTO gym_templates (day_type, exercise, ord) VALUES (?, ?, ?)");
  await env.DB.batch([
    env.DB.prepare("DELETE FROM gym_templates WHERE day_type = ?").bind(type),
    ...names.map((n, i) => insert.bind(type, n, i + 1)),
  ]);
  return json({ ok: true });
};
