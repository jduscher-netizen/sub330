import { isIsoDate, json, todayBerlin, type Env } from "../../_lib/types";

// Geplante Einheit auf einen anderen Tag legen. Das ursprüngliche Datum bleibt in moved_from,
// zurück auf den ursprünglichen Tag löscht den Vermerk.
export const onRequestPatch: PagesFunction<Env> = async ({ request, env, params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return json({ ok: false, message: "Einheit nicht gefunden." }, 404);
  const body = (await request.json().catch(() => ({}))) as { date?: unknown };
  const date = typeof body.date === "string" && isIsoDate(body.date) ? body.date : null;
  if (!date) return json({ ok: false, message: "Bitte einen Tag wählen." }, 400);
  if (date < todayBerlin()) return json({ ok: false, message: "In die Vergangenheit lässt sich nichts verschieben." }, 400);

  const s = await env.DB.prepare("SELECT date, moved_from FROM planned_sessions WHERE id = ?").bind(id).first<{ date: string; moved_from: string | null }>();
  if (!s) return json({ ok: false, message: "Einheit nicht gefunden." }, 404);
  const original = s.moved_from ?? s.date;
  await env.DB.prepare("UPDATE planned_sessions SET date = ?, moved_from = ?, status = 'geplant' WHERE id = ?")
    .bind(date, date === original ? null : original, id).run();
  return json({ ok: true });
};
