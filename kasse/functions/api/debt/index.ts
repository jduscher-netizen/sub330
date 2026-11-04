import { debtOverview, parseDebt } from "../../_lib/debt";
import { fail, json, type Env } from "../../_lib/util";

// Übersicht der Rückzahlung: Miete (berechnet), Posten, Summen je Kategorie
export const onRequestGet: PagesFunction<Env> = async ({ env }) => json(await debtOverview(env));

// Neuer Posten: Schulden dazu oder Rückzahlung
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const e = parseDebt((await request.json().catch(() => ({}))) as Record<string, unknown>);
  if (typeof e === "string") return fail(e);
  const row = await env.DB.prepare(
    "INSERT INTO debt_entries (date, amount_cents, kind, category, label, created_by) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
  ).bind(e.date, e.amount_cents, e.kind, e.category, e.label, e.by).first<{ id: number }>();
  return json({ ok: true, id: row?.id });
};
