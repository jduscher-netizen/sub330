import { fail, isMonth, json, type Env } from "../../_lib/util";

// Wiederholung beenden: Der angegebene Monat behält seine Buchung, danach kommt keine mehr.
export const onRequestDelete: PagesFunction<Env, "id"> = async ({ request, env, params }) => {
  const id = Number(params.id);
  const month = new URL(request.url).searchParams.get("month");
  if (!Number.isInteger(id) || !isMonth(month)) return fail("Angaben unvollständig.");
  const rule = await env.DB.prepare("SELECT id FROM recurring WHERE id = ?").bind(id).first();
  if (!rule) return fail("Wiederholung nicht gefunden.", 404);
  await env.DB.batch([
    env.DB.prepare("UPDATE recurring SET end_month = ? WHERE id = ?").bind(month, id),
    env.DB.prepare(
      `UPDATE entries SET deleted_at = datetime('now')
        WHERE recurring_id = ? AND month > ? AND deleted_at IS NULL
          AND month NOT IN (SELECT month FROM settlements)`,
    ).bind(id, month),
  ]);
  return json({ ok: true });
};
