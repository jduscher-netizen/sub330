import { addMonth, isDate, monthName, todayBerlin, type Env, type Person } from "./util";

export const DEBT_CATEGORIES = ["geliehen", "urlaub", "monat", "sonstiges"] as const;

export interface RentRule { id: number; extra_cents: number; share_pct: number; start_month: string; end_month: string | null }

/** Anzahl Monate von a bis b einschließlich (0, wenn b vor a liegt) */
export function monthsBetween(a: string, b: string): number {
  if (b < a) return 0;
  const [ya, ma] = a.split("-").map(Number);
  const [yb, mb] = b.split("-").map(Number);
  return (yb - ya) * 12 + (mb - ma) + 1;
}

/** Miete je Regel bis zum aktuellen Monat (am 1. fällig) */
export function rentPhases(rules: RentRule[], current: string) {
  return rules.map((r) => {
    const last = r.end_month && r.end_month < current ? r.end_month : current;
    const months = monthsBetween(r.start_month, last);
    const perMonth = Math.round((r.extra_cents * r.share_pct) / 100);
    return { ...r, last_month: last, months, per_month_cents: perMonth, total_cents: months * perMonth, running: !r.end_month };
  });
}

export async function debtOverview(env: Env) {
  const current = todayBerlin().slice(0, 7);
  const [rules, entries] = await Promise.all([
    env.DB.prepare("SELECT id, extra_cents, share_pct, start_month, end_month FROM rent_rules ORDER BY start_month DESC").all<RentRule>(),
    env.DB.prepare(
      "SELECT id, date, amount_cents, kind, category, label, settle_month, created_by FROM debt_entries ORDER BY date DESC, id DESC",
    ).all<{ id: number; date: string; amount_cents: number; kind: string; category: string; label: string; settle_month: string | null }>(),
  ]);
  const phases = rentPhases(rules.results, current);
  const rent = phases.reduce((s, p) => s + p.total_cents, 0);
  const byCategory: Record<string, number> = { miete: rent };
  let repaid = 0;
  for (const e of entries.results) {
    if (e.kind === "repayment") repaid += e.amount_cents;
    else byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount_cents;
  }
  const owed = Object.values(byCategory).reduce((s, v) => s + v, 0);
  return { ok: true, today: todayBerlin(), rent: { phases, total_cents: rent }, entries: entries.results, byCategory, owed_cents: owed, repaid_cents: repaid, open_cents: owed - repaid };
}

export interface DebtInput { date: string; amount_cents: number; kind: "debt" | "repayment"; category: string; label: string; by: Person | null }

export function parseDebt(b: Record<string, unknown>): DebtInput | string {
  if (!isDate(b.date)) return "Datum fehlt oder ist ungültig.";
  const amount = Number(b.amount_cents);
  if (!Number.isInteger(amount) || amount <= 0 || amount > 100_000_000) return "Betrag ist ungültig.";
  const kind = b.kind === "repayment" ? "repayment" : "debt";
  let category = kind === "repayment" ? "rueckzahlung" : String(b.category ?? "sonstiges");
  if (kind === "debt" && !(DEBT_CATEGORIES as readonly string[]).includes(category)) category = "sonstiges";
  const label = (typeof b.label === "string" ? b.label.trim().slice(0, 80) : "") || (kind === "repayment" ? "Rückzahlung" : "");
  if (!label) return "Wofür? Ein Stichwort reicht.";
  const by = b.by === "J" || b.by === "M" ? b.by : null;
  return { date: b.date, amount_cents: amount, kind, category, label, by };
}

/** Posten für einen auf die Rückzahlung gebuchten Monatsausgleich */
export function settleEntry(month: string, balance: number) {
  const name = `${monthName(month)} ${month.slice(0, 4)}`;
  return balance > 0
    ? { kind: "debt", category: "monat", label: name, amount: balance }
    : { kind: "repayment", category: "rueckzahlung", label: `${name}: Jans Anteil verrechnet`, amount: -balance };
}

export { addMonth };
