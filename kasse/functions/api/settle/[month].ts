import { fail, isMonth, json, type Env } from "../../_lib/util";

// Monat als ausgeglichen markieren. Der Saldo wird hier berechnet und mit abgelegt.
export const onRequestPut: PagesFunction<Env, "month"> = async ({ request, env, params }) => {
  const month = String(params.month);
  if (!isMonth(month)) return fail("Monat ist ungültig.");
  const body = (await request.json().catch(() => ({}))) as { by?: string };
  const s = await env.DB.prepare(
    `SELECT COALESCE(SUM(CASE WHEN kind = 'expense' AND payer = 'J' THEN amount_cents END), 0) AS j,
            COALESCE(SUM(CASE WHEN kind = 'expense' AND payer = 'M' THEN amount_cents END), 0) AS m,
            COALESCE(SUM(CASE WHEN kind = 'payment' AND payer = 'J' THEN amount_cents END), 0) AS pj,
            COALESCE(SUM(CASE WHEN kind = 'payment' AND payer = 'M' THEN amount_cents END), 0) AS pm
       FROM entries WHERE month = ? AND deleted_at IS NULL`,
  ).bind(month).first<{ j: number; m: number; pj: number; pm: number }>();
  const { j = 0, m = 0, pj = 0, pm = 0 } = s ?? {};
  const balance = Math.round((j - m) / 2 + pj - pm);
  const by = body.by === "J" || body.by === "M" ? body.by : null;
  await env.DB.prepare(
    `INSERT OR REPLACE INTO settlements (month, balance_cents, total_j, total_m, settled_by, settled_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`,
  ).bind(month, balance, j, m, by).run();
  return json({ ok: true, balance_cents: balance });
};

// Monat wieder öffnen
export const onRequestDelete: PagesFunction<Env, "month"> = async ({ env, params }) => {
  const month = String(params.month);
  if (!isMonth(month)) return fail("Monat ist ungültig.");
  await env.DB.prepare("DELETE FROM settlements WHERE month = ?").bind(month).run();
  return json({ ok: true });
};
