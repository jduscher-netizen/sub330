import { fail, isSettled, json, monthName, parseEntry, type Env } from "../../_lib/util";

// Neue Buchung. Mit recurring: true wird daraus eine monatliche Wiederholung ab diesem Monat.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const e = parseEntry(body);
  if (typeof e === "string") return fail(e);
  const month = e.date.slice(0, 7);
  if (await isSettled(env, month)) return fail(`${monthName(month)} ist schon ausgeglichen. Erst wieder öffnen.`, 409);

  let recurringId: number | null = null;
  if (body.recurring === true && e.kind === "expense") {
    const rule = await env.DB.prepare(
      `INSERT INTO recurring (label, category, amount_cents, payer, day, start_month)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
    ).bind(e.label, e.category, e.amount_cents, e.payer, Math.min(Number(e.date.slice(8, 10)), 28), month).first<{ id: number }>();
    recurringId = rule?.id ?? null;
  }

  const row = await env.DB.prepare(
    `INSERT INTO entries (date, month, amount_cents, label, category, payer, kind, recurring_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  ).bind(e.date, month, e.amount_cents, e.label, e.category, e.payer, e.kind, recurringId, e.by).first<{ id: number }>();

  return json({ ok: true, id: row?.id, month });
};
