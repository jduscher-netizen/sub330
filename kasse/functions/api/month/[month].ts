import { fail, isMonth, json, materializeRecurring, todayBerlin, type Env } from "../../_lib/util";

// Alles für die Monatsansicht in einem Abruf: Buchungen, Abschluss, Übersicht aller Monate
// und häufige Stichwörter für die Vorschläge.
export const onRequestGet: PagesFunction<Env, "month"> = async ({ env, params }) => {
  const month = String(params.month);
  if (!isMonth(month)) return fail("Monat ist ungültig.");

  await materializeRecurring(env);

  const [entries, settlement, months, settlements, labels] = await Promise.all([
    env.DB.prepare(
      `SELECT e.id, e.date, e.amount_cents, e.label, e.category, e.payer, e.kind, e.recurring_id, e.created_by,
              r.end_month AS recurring_end
         FROM entries e LEFT JOIN recurring r ON r.id = e.recurring_id
        WHERE e.month = ? AND e.deleted_at IS NULL
        ORDER BY e.date DESC, e.id DESC`,
    ).bind(month).all(),
    env.DB.prepare("SELECT * FROM settlements WHERE month = ?").bind(month).first(),
    env.DB.prepare(
      `SELECT month,
              SUM(CASE WHEN kind = 'expense' AND payer = 'J' THEN amount_cents ELSE 0 END) AS total_j,
              SUM(CASE WHEN kind = 'expense' AND payer = 'M' THEN amount_cents ELSE 0 END) AS total_m,
              SUM(CASE WHEN kind = 'payment' AND payer = 'J' THEN amount_cents ELSE 0 END) AS pay_j,
              SUM(CASE WHEN kind = 'payment' AND payer = 'M' THEN amount_cents ELSE 0 END) AS pay_m,
              COUNT(*) AS n
         FROM entries WHERE deleted_at IS NULL GROUP BY month ORDER BY month DESC LIMIT 36`,
    ).all(),
    env.DB.prepare("SELECT month, balance_cents, settled_at, settled_by FROM settlements ORDER BY month DESC LIMIT 36").all(),
    env.DB.prepare(
      `SELECT label, category, COUNT(*) AS n, MAX(id) AS last_id
         FROM entries WHERE deleted_at IS NULL AND kind = 'expense'
        GROUP BY lower(label) ORDER BY n DESC, last_id DESC LIMIT 60`,
    ).all(),
  ]);

  return json({
    ok: true,
    month,
    today: todayBerlin(),
    entries: entries.results,
    settlement: settlement ?? null,
    months: months.results,
    settlements: settlements.results,
    labels: labels.results.map((l) => ({ label: l.label, category: l.category, n: l.n })),
  });
};
