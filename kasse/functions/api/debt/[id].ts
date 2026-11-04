import { parseDebt } from "../../_lib/debt";
import { fail, json, type Env } from "../../_lib/util";

async function load(env: Env, id: string) {
  if (!/^\d+$/.test(id)) return null;
  return env.DB.prepare("SELECT id, settle_month FROM debt_entries WHERE id = ?").bind(Number(id)).first<{ id: number; settle_month: string | null }>();
}

const LINKED = "Dieser Posten kommt aus einem Monatsausgleich. Ändern geht über den Monat (wieder öffnen).";

export const onRequestPut: PagesFunction<Env, "id"> = async ({ request, env, params }) => {
  const old = await load(env, String(params.id));
  if (!old) return fail("Posten nicht gefunden.", 404);
  if (old.settle_month) return fail(LINKED, 409);
  const e = parseDebt((await request.json().catch(() => ({}))) as Record<string, unknown>);
  if (typeof e === "string") return fail(e);
  await env.DB.prepare(
    "UPDATE debt_entries SET date = ?, amount_cents = ?, kind = ?, category = ?, label = ?, updated_at = datetime('now') WHERE id = ?",
  ).bind(e.date, e.amount_cents, e.kind, e.category, e.label, old.id).run();
  return json({ ok: true });
};

export const onRequestDelete: PagesFunction<Env, "id"> = async ({ env, params }) => {
  const old = await load(env, String(params.id));
  if (!old) return fail("Posten nicht gefunden.", 404);
  if (old.settle_month) return fail(LINKED, 409);
  await env.DB.prepare("DELETE FROM debt_entries WHERE id = ?").bind(old.id).run();
  return json({ ok: true });
};
