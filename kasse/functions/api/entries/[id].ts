import { fail, isSettled, json, monthName, parseEntry, type Env } from "../../_lib/util";

interface Row { id: number; month: string; recurring_id: number | null }

async function load(env: Env, id: string): Promise<Row | null> {
  if (!/^\d+$/.test(id)) return null;
  return env.DB.prepare("SELECT id, month, recurring_id FROM entries WHERE id = ? AND deleted_at IS NULL").bind(Number(id)).first<Row>();
}

// Buchung ändern. Bei einer Wiederholung mit applyToRule: true gelten Betrag, Stichwort,
// Kategorie und Zahler auch für die kommenden Monate.
export const onRequestPut: PagesFunction<Env, "id"> = async ({ request, env, params }) => {
  const old = await load(env, String(params.id));
  if (!old) return fail("Buchung nicht gefunden.", 404);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const e = parseEntry(body);
  if (typeof e === "string") return fail(e);
  const month = e.date.slice(0, 7);
  for (const m of new Set([old.month, month])) {
    if (await isSettled(env, m)) return fail(`${monthName(m)} ist schon ausgeglichen. Erst wieder öffnen.`, 409);
  }
  if (old.recurring_id && e.kind !== "expense") return fail("Eine monatliche Ausgabe kann keine Ausgleichszahlung sein.");

  const stmts = [
    env.DB.prepare(
      `UPDATE entries SET date = ?, month = ?, amount_cents = ?, label = ?, category = ?, payer = ?, kind = ?,
              updated_at = datetime('now') WHERE id = ?`,
    ).bind(e.date, month, e.amount_cents, e.label, e.category, e.payer, e.kind, old.id),
  ];
  if (old.recurring_id && body.applyToRule === true) {
    stmts.push(
      env.DB.prepare("UPDATE recurring SET label = ?, category = ?, amount_cents = ?, payer = ? WHERE id = ?")
        .bind(e.label, e.category, e.amount_cents, e.payer, old.recurring_id),
    );
  }
  try {
    await env.DB.batch(stmts);
  } catch (err) {
    if (String(err).includes("UNIQUE")) return fail(`In ${monthName(month)} gibt es diese monatliche Ausgabe schon.`, 409);
    throw err;
  }
  return json({ ok: true, month });
};

// Löschen bleibt als Markierung stehen, damit eine monatliche Ausgabe nicht wieder auftaucht.
export const onRequestDelete: PagesFunction<Env, "id"> = async ({ env, params }) => {
  const old = await load(env, String(params.id));
  if (!old) return fail("Buchung nicht gefunden.", 404);
  if (await isSettled(env, old.month)) return fail(`${monthName(old.month)} ist schon ausgeglichen. Erst wieder öffnen.`, 409);
  await env.DB.prepare("UPDATE entries SET deleted_at = datetime('now') WHERE id = ?").bind(old.id).run();
  return json({ ok: true });
};
