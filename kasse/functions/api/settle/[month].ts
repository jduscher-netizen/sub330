import { settleEntry } from "../../_lib/debt";
import { fail, isMonth, json, type Env } from "../../_lib/util";

// Monat als ausgeglichen markieren. Der Saldo wird hier berechnet und mit abgelegt.
// Mit toDebt: true wird der Betrag nicht überwiesen, sondern auf die Rückzahlung gebucht.
export const onRequestPut: PagesFunction<Env, "month"> = async ({ request, env, params }) => {
  const month = String(params.month);
  if (!isMonth(month)) return fail("Monat ist ungültig.");
  const body = (await request.json().catch(() => ({}))) as { by?: string; toDebt?: boolean };
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
  const toDebt = body.toDebt === true && balance !== 0;

  const stmts = [
    env.DB.prepare("DELETE FROM debt_entries WHERE settle_month = ?").bind(month),
    env.DB.prepare(
      `INSERT OR REPLACE INTO settlements (month, balance_cents, total_j, total_m, settled_by, settled_at, to_debt)
       VALUES (?, ?, ?, ?, ?, datetime('now'), ?)`,
    ).bind(month, balance, j, m, by, toDebt ? 1 : 0),
  ];
  if (toDebt) {
    const d = settleEntry(month, balance);
    const [y, mo] = month.split("-").map(Number);
    const lastDay = new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10);
    stmts.push(
      env.DB.prepare(
        "INSERT INTO debt_entries (date, amount_cents, kind, category, label, settle_month, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ).bind(lastDay, d.amount, d.kind, d.category, d.label, month, by),
    );
  }
  await env.DB.batch(stmts);
  return json({ ok: true, balance_cents: balance, to_debt: toDebt });
};

// Monat wieder öffnen (ein auf die Rückzahlung gebuchter Betrag wird dort wieder entfernt)
export const onRequestDelete: PagesFunction<Env, "month"> = async ({ env, params }) => {
  const month = String(params.month);
  if (!isMonth(month)) return fail("Monat ist ungültig.");
  await env.DB.batch([
    env.DB.prepare("DELETE FROM settlements WHERE month = ?").bind(month),
    env.DB.prepare("DELETE FROM debt_entries WHERE settle_month = ?").bind(month),
  ]);
  return json({ ok: true });
};
