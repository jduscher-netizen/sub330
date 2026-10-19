import type { Activity, Session, SessionLite, WeekTarget } from "./api";
import { hms } from "./format";

// Gemeinsame Regeln für Plan und Heute: Läufe sind fest geplant, alles andere läuft über Wochenziele.

export const RUN_TYPES = ["intervals", "threshold", "long", "easy", "run", "race"];
export const isRun = (type: string) => RUN_TYPES.includes(type);

export const FLEX: Record<string, { label: string; sport: string; color: string }> = {
  gym: { label: "Gym", sport: "strength", color: "var(--gym)" },
  swim: { label: "Schwimmen", sport: "swim", color: "var(--z1)" },
  padel: { label: "Padel", sport: "padel", color: "var(--z3)" },
  bike: { label: "Rad", sport: "bike", color: "var(--z2)" },
};
const FLEX_ORDER = ["gym", "swim", "padel", "bike"];

const SPORT: Record<string, { label: string; color: string }> = {
  run: { label: "Laufen", color: "var(--bib)" },
  strength: { label: "Gym", color: "var(--gym)" },
  swim: { label: "Schwimmen", color: "var(--z1)" },
  padel: { label: "Padel", color: "var(--z3)" },
  bike: { label: "Rad", color: "var(--z2)" },
  other: { label: "Aktivität", color: "var(--text-muted)" },
};
export const sportInfo = (sport: string) => SPORT[sport] ?? SPORT.other;

const num = (v: number, digits = 1) => v.toLocaleString("de-DE", { maximumFractionDigits: digits });

/** "8,2 km in 46:30, Ø 144 bpm" bzw. "55 min, Ø 118 bpm" */
export function activityFacts(a: Activity): string {
  const parts: string[] = [];
  const dist = a.distance_m && a.distance_m >= 100 ? `${num(a.distance_m / 1000)} km` : null;
  if (dist && a.duration_s) parts.push(`${dist} in ${hms(a.duration_s)}`);
  else if (a.duration_s) parts.push(`${Math.round(a.duration_s / 60)} min`);
  else if (dist) parts.push(dist);
  if (a.avg_hr) parts.push(`Ø ${a.avg_hr} bpm`);
  return parts.join(", ");
}

/** Läufe eines Tages den geplanten Laufeinheiten zuordnen (Anzeige, bis das echte Matching kommt) */
export function matchRuns(sessions: Session[], acts: Activity[]): { matched: Map<number, Activity>; rest: Activity[] } {
  const matched = new Map<number, Activity>();
  const used = new Set<string>();
  const byId = new Map(acts.map((a) => [a.id, a]));
  for (const s of sessions) {
    const linked = s.activity_id ? byId.get(s.activity_id) : undefined;
    if (linked) { matched.set(s.id, linked); used.add(linked.id); }
  }
  for (const s of sessions) {
    if (matched.has(s.id) || !isRun(s.type)) continue;
    const a = acts.find((x) => !used.has(x.id) && x.sport === "run" && x.start_time.slice(0, 10) === s.date);
    if (a) { matched.set(s.id, a); used.add(a.id); }
  }
  return { matched, rest: acts.filter((a) => !used.has(a.id)) };
}

export interface FlexProgress { key: string; label: string; color: string; done: number; min: number; max: number; note: string | null; acts: Activity[] }

export function flexProgress(targets: WeekTarget[], acts: Activity[]): FlexProgress[] {
  return FLEX_ORDER.flatMap((key) => {
    const t = targets.find((x) => x.category === key);
    if (!t) return [];
    const f = FLEX[key];
    const mine = acts.filter((a) => a.sport === f.sport);
    return [{ key, label: f.label, color: f.color, done: mine.length, min: t.target_min, max: t.target_max, note: t.note, acts: mine }];
  });
}

/** "3 bis 4×", "1×", "optional" */
export function targetText(min: number, max: number): string {
  if (max === 0) return "diese Woche nicht";
  if (min === 0) return max === 1 ? "optional" : `optional, bis ${max}×`;
  return min === max ? `${min}×` : `${min} bis ${max}×`;
}

const KEY = ["intervals", "long", "race"];
const dayName = (rel: "gestern" | "morgen") => (rel === "gestern" ? "Gestern" : "Morgen");

/**
 * Was passt heute? Regeln aus der CLAUDE.md: nie zwei harte Tage hintereinander,
 * kein Bein-Gym am Tag vor Intervallen oder Long Run.
 */
export function todayAdvice(today: SessionLite[], yesterday: SessionLite[], tomorrow: SessionLite[]): { text: string; easyOnly: boolean } {
  const hardToday = today.find((s) => s.hard === 1);
  const keyTomorrow = tomorrow.find((s) => KEY.includes(s.type));
  const hardTomorrow = tomorrow.find((s) => s.hard === 1);
  const hardYesterday = yesterday.find((s) => s.hard === 1);
  const good = "Gut passen Oberkörper, Schwimmen oder Rad in Z2.";
  if (hardToday) return { text: `Heute ist schon hart (${hardToday.title}). Padel und Bein-Gym lieber an einem anderen Tag. ${good}`, easyOnly: true };
  if (keyTomorrow) return { text: `${dayName("morgen")}: ${keyTomorrow.title}. Heute kein Bein-Gym und kein Padel. ${good}`, easyOnly: true };
  if (hardTomorrow) return { text: `${dayName("morgen")}: ${hardTomorrow.title}. Heute lieber kein Padel und keine schweren Beine. ${good}`, easyOnly: true };
  if (hardYesterday) return { text: `${dayName("gestern")} war hart (${hardYesterday.title}). Heute kein Padel und keine schweren Beine. ${good}`, easyOnly: true };
  return { text: "Heute passt alles, auch Padel oder Bein-Gym.", easyOnly: false };
}

/** Ziel erreicht? Optionale Ziele gelten erst mit einer Einheit als erledigt. */
export const flexReached = (f: FlexProgress) => f.max > 0 && f.done > 0 && f.done >= f.min;

/** Kurztext unter der Kachel: "von 3", "von 1 bis 2", "optional", "Pause" */
export function flexGoal(f: FlexProgress): string {
  if (f.max === 0) return "Pause";
  if (f.min === 0) return "optional";
  return f.min === f.max ? `von ${f.min}` : `von ${f.min} bis ${f.max}`;
}

/** Link zur Detailansicht einer Aktivität (Demo-Parameter bleibt erhalten) */
export const activityHref = (id: string) => `${location.search}#/aktivitaet/${encodeURIComponent(id)}`;
