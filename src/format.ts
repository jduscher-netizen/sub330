// Datums- und Zeitformate, immer in Europe/Berlin und auf Deutsch.

const TZ = "Europe/Berlin";

export function todayIso(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ }).format(new Date());
}

export function addDays(date: string, days: number): string {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function mondayOf(date: string): string {
  const d = new Date(date + "T12:00:00Z");
  return addDays(date, -((d.getUTCDay() + 6) % 7));
}

export function longDate(date: string): string {
  return new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
    .format(new Date(date + "T12:00:00Z"));
}

export function shortWeekday(date: string): string {
  return new Intl.DateTimeFormat("de-DE", { weekday: "short", timeZone: "UTC" })
    .format(new Date(date + "T12:00:00Z")).replace(".", "");
}

export function dayOfMonth(date: string): string {
  return String(Number(date.slice(8, 10)));
}

export function weekRange(start: string, end: string): string {
  const fmt = (d: string, withMonth: boolean) =>
    new Intl.DateTimeFormat("de-DE", withMonth ? { day: "numeric", month: "short", timeZone: "UTC" } : { day: "numeric", timeZone: "UTC" })
      .format(new Date(d + "T12:00:00Z"));
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  return `${fmt(start, !sameMonth)} bis ${fmt(end, true)}`;
}

/** 5879 → "1:37:59" */
export function hms(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

/** Zeit seit einem Zeitpunkt, z. B. "vor 8 Min." */
export function ago(iso: string | null): string {
  if (!iso) return "noch nie";
  const t = Date.parse(iso.includes("T") || iso.endsWith("Z") ? iso : iso.replace(" ", "T") + "Z");
  const min = Math.max(0, Math.round((Date.now() - t) / 60_000));
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  return `vor ${Math.round(h / 24)} Tagen`;
}

/** Wochen von heute bis zu einem Datum, aufgerundet */
export function weeksUntil(date: string): number {
  const ms = Date.parse(date + "T12:00:00Z") - Date.parse(todayIso() + "T12:00:00Z");
  return Math.max(0, Math.ceil(ms / (7 * 86_400_000)));
}
