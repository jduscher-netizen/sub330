import { addMonth } from "../_lib/debt";
import { fail, isMonth, json, type Env } from "../_lib/util";

// Mehrkosten Miete ab einem Monat ändern. extra_cents = 0 beendet die laufende Miete.
// Die laufende Regel endet im Vormonat; beginnt sie erst ab dem neuen Monat, wird sie ersetzt.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const b = (await request.json().catch(() => ({}))) as { extra_cents?: unknown; from_month?: unknown };
  const extra = Number(b.extra_cents);
  const from = b.from_month;
  if (!isMonth(from)) return fail("Ab welchem Monat?");
  if (!Number.isInteger(extra) || extra < 0 || extra > 10_000_000) return fail("Betrag ist ungültig.");

  // Gleicher Betrag wie die Phase davor: diese einfach weiterlaufen lassen statt eine neue anzulegen
  const cont = extra > 0
    ? await env.DB.prepare(
        "SELECT id FROM rent_rules WHERE start_month < ? AND extra_cents = ? AND (end_month IS NULL OR end_month >= ?) ORDER BY start_month DESC LIMIT 1",
      ).bind(from, extra, addMonth(from, -1)).first<{ id: number }>()
    : null;
  if (cont) {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM rent_rules WHERE start_month >= ?").bind(from),
      env.DB.prepare("UPDATE rent_rules SET end_month = NULL WHERE id = ?").bind(cont.id),
    ]);
    return json({ ok: true });
  }

  const stmts: D1PreparedStatement[] = [
    env.DB.prepare("DELETE FROM rent_rules WHERE start_month >= ?").bind(from),
    env.DB.prepare("UPDATE rent_rules SET end_month = ? WHERE start_month < ? AND (end_month IS NULL OR end_month >= ?)")
      .bind(addMonth(from, -1), from, from),
  ];
  if (extra > 0) {
    stmts.push(env.DB.prepare("INSERT INTO rent_rules (extra_cents, share_pct, start_month) VALUES (?, 50, ?)").bind(extra, from));
  }
  await env.DB.batch(stmts);
  return json({ ok: true });
};
