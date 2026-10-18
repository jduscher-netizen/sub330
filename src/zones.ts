import type { Session, Zone } from "./api";

export const ZONES: Record<Zone, { color: string; label: string; bpm: string }> = {
  Z1: { color: "var(--z1)", label: "Recovery", bpm: "bis 139 bpm" },
  Z2: { color: "var(--z2)", label: "GA1", bpm: "140 bis 149 bpm" },
  Z3: { color: "var(--z3)", label: "GA2", bpm: "150 bis 159 bpm" },
  Z4: { color: "var(--z4)", label: "Schwelle", bpm: "160 bis 171 bpm" },
  Z5: { color: "var(--z5)", label: "VO2max", bpm: "172 bis 185 bpm" },
};

/** Höhe eines Ablauf-Blocks im Diagramm, nach Intensität */
export const ZONE_HEIGHT: Record<Zone, number> = { Z1: 16, Z2: 34, Z3: 55, Z4: 78, Z5: 100 };

export function sessionColor(s: Pick<Session, "zone" | "type">): string {
  if (s.type.startsWith("gym")) return "var(--gym)";
  if (s.type === "padel") return "var(--z3)";
  return s.zone ? ZONES[s.zone].color : "var(--gym)";
}

const SHOES: Record<string, string> = {
  intervals: "Adizero EVO SL",
  threshold: "Adizero EVO SL",
  long: "Glycerin Max",
  easy: "Glycerin Max",
  race: "Adizero EVO SL",
};
export const shoeFor = (type: string): string | null => SHOES[type] ?? null;
