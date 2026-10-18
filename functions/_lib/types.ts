export interface Env {
  DB: D1Database;
  /** Team-Domain von Cloudflare Access, z. B. "sub330.cloudflareaccess.com" */
  ACCESS_TEAM_DOMAIN?: string;
  /** Audience-Tag der Access-Anwendung */
  ACCESS_AUD?: string;
  /** Nur lokal: "1" schaltet die Zugangsprüfung ab (.dev.vars) */
  DEV_NO_AUTH?: string;
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

/** Heutiges Datum in Europe/Berlin als YYYY-MM-DD */
export function todayBerlin(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
}

export function isIsoDate(s: string | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function addDays(date: string, days: number): string {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
