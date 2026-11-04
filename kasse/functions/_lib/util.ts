export interface Env {
  DB: D1Database;
  /** Gemeinsames Passwort für Jan und Milena (Pages-Secret, kommt aus dem GitHub-Secret KASSE_PASSWORD) */
  KASSE_PASSWORD?: string;
  /** Nur lokal: "1" schaltet die Zugangsprüfung ab (.dev.vars) */
  DEV_NO_AUTH?: string;
}

export type Person = "J" | "M";
export type Kind = "expense" | "payment";

export const CATEGORIES = ["lebensmittel", "drogerie", "essen", "haushalt", "online", "abos", "freizeit", "sonstiges"] as const;

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export const fail = (message: string, status = 400) => json({ ok: false, message }, status);

/** Heutiges Datum in Europe/Berlin als YYYY-MM-DD */
export function todayBerlin(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
}

export const isMonth = (s: unknown): s is string => typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

export function isDate(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T12:00:00Z");
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function addMonth(m: string, n: number): string {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

const isPerson = (p: unknown): p is Person => p === "J" || p === "M";

export interface EntryInput {
  date: string;
  amount_cents: number;
  label: string;
  category: string;
  payer: Person;
  kind: Kind;
  by: Person | null;
}

/** Prüft eine Buchung aus dem Frontend. Gibt die bereinigten Werte oder eine Fehlermeldung zurück. */
export function parseEntry(b: Record<string, unknown>): EntryInput | string {
  if (!isDate(b.date)) return "Datum fehlt oder ist ungültig.";
  const amount = Number(b.amount_cents);
  if (!Number.isInteger(amount) || amount <= 0 || amount > 10_000_000) return "Betrag ist ungültig.";
  const kind: Kind = b.kind === "payment" ? "payment" : "expense";
  const label = typeof b.label === "string" ? b.label.trim().slice(0, 60) : "";
  if (!label) return "Stichwort fehlt.";
  if (!isPerson(b.payer)) return "Wer hat bezahlt?";
  let category = kind === "payment" ? "ausgleich" : String(b.category ?? "sonstiges");
  if (kind === "expense" && !(CATEGORIES as readonly string[]).includes(category)) category = "sonstiges";
  return { date: b.date, amount_cents: amount, label, category, payer: b.payer, kind, by: isPerson(b.by) ? b.by : null };
}

export async function isSettled(env: Env, month: string): Promise<boolean> {
  return !!(await env.DB.prepare("SELECT 1 FROM settlements WHERE month = ?").bind(month).first());
}

export const monthName = (m: string) =>
  new Date(m + "-15T12:00:00Z").toLocaleDateString("de-DE", { month: "long", timeZone: "UTC" });

/**
 * Legt für jede aktive Wiederholung die Buchungen bis zum aktuellen Monat an.
 * Abgeschlossene Monate bleiben unberührt. Gelöschte Wiederholungs-Buchungen bleiben als
 * gelöscht stehen, deshalb kommen sie über den eindeutigen Index nicht zurück.
 */
export async function materializeRecurring(env: Env): Promise<void> {
  const current = todayBerlin().slice(0, 7);
  const { results: rules } = await env.DB.prepare(
    "SELECT * FROM recurring WHERE start_month <= ? AND (end_month IS NULL OR end_month >= start_month)",
  ).bind(current).all<{ id: number; label: string; category: string; amount_cents: number; payer: Person; day: number; start_month: string; end_month: string | null }>();
  if (!rules.length) return;
  const settled = new Set(
    (await env.DB.prepare("SELECT month FROM settlements").all<{ month: string }>()).results.map((r) => r.month),
  );
  const stmts: D1PreparedStatement[] = [];
  for (const r of rules) {
    const last = r.end_month && r.end_month < current ? r.end_month : current;
    for (let m = r.start_month, i = 0; m <= last && i < 120; m = addMonth(m, 1), i++) {
      if (settled.has(m)) continue;
      const date = `${m}-${String(Math.min(Math.max(r.day, 1), 28)).padStart(2, "0")}`;
      stmts.push(
        env.DB.prepare(
          `INSERT OR IGNORE INTO entries (date, month, amount_cents, label, category, payer, kind, recurring_id, created_by)
           VALUES (?, ?, ?, ?, ?, ?, 'expense', ?, NULL)`,
        ).bind(date, m, r.amount_cents, r.label, r.category, r.payer, r.id),
      );
    }
  }
  if (stmts.length) await env.DB.batch(stmts);
}
