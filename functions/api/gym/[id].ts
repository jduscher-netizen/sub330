import { json, type Env } from "../../_lib/types";
import { parseEntry } from "../../_lib/gym";

// Einzelnen Tagebuch-Eintrag ändern oder löschen.
function idOf(params: Record<string, string | string[]>): number | null {
  const n = Number(params.id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export const onRequestPut: PagesFunction<Env> = async ({ request, env, params }) => {
  const id = idOf(params);
  if (!id) return json({ ok: false, message: "Eintrag nicht gefunden." }, 404);
  const p = parseEntry((await request.json().catch(() => ({}))) as Record<string, unknown>);
  if (!p.ok) return json({ ok: false, message: p.message }, 400);
  const res = await env.DB.prepare(
    "UPDATE gym_entries SET date = ?, exercise = ?, sets = ?, reps = ?, weight_kg = ?, note = ? WHERE id = ?",
  ).bind(...p.v, id).run();
  if (!res.meta.changes) return json({ ok: false, message: "Eintrag nicht gefunden." }, 404);
  return json({ ok: true });
};

export const onRequestDelete: PagesFunction<Env> = async ({ env, params }) => {
  const id = idOf(params);
  if (!id) return json({ ok: false, message: "Eintrag nicht gefunden." }, 404);
  await env.DB.prepare("DELETE FROM gym_entries WHERE id = ?").bind(id).run();
  return json({ ok: true });
};
