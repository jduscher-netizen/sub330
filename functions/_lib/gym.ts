import { isIsoDate, todayBerlin } from "./types";

// Prüfung der Tagebuch-Eingaben, gemeinsam für Anlegen und Ändern.

export interface EntryInput { date?: unknown; exercise?: unknown; sets?: unknown; reps?: unknown; weight_kg?: unknown; note?: unknown }

/** Prüft eine Eingabe und liefert die Werte oder eine verständliche Meldung */
export function parseEntry(body: EntryInput): { ok: true; v: [string, string, number, number, number | null, string | null] } | { ok: false; message: string } {
  const date = typeof body.date === "string" && isIsoDate(body.date) ? body.date : todayBerlin();
  const exercise = typeof body.exercise === "string" ? body.exercise.trim().replace(/\s+/g, " ") : "";
  if (!exercise || exercise.length > 60) return { ok: false, message: "Bitte eine Übung eintragen." };
  const sets = Number(body.sets), reps = Number(body.reps);
  if (!Number.isInteger(sets) || sets < 1 || sets > 20) return { ok: false, message: "Sätze: 1 bis 20." };
  if (!Number.isInteger(reps) || reps < 1 || reps > 100) return { ok: false, message: "Wiederholungen: 1 bis 100." };
  let weight: number | null = null;
  if (body.weight_kg !== null && body.weight_kg !== undefined && body.weight_kg !== "") {
    weight = Number(String(body.weight_kg).replace(",", "."));
    if (!Number.isFinite(weight) || weight < 0 || weight > 500) return { ok: false, message: "Gewicht: 0 bis 500 kg." };
    weight = Math.round(weight * 4) / 4; // auf 0,25 kg
  }
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 200) : null;
  return { ok: true, v: [date, exercise, sets, reps, weight, note] };
}
