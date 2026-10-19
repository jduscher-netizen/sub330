// Auswertung einer Aktivität und Abgleich mit der geplanten Einheit.
// Regeln nach Jans Zonen (LTHR 170) und dem polarisierten 80/20-Ansatz. Reine Funktionen, ohne Datenbank.

export interface Lap { dist: number; dur: number; v: number; hr: number | null; hr_max: number | null; cad: number | null; elev: number | null; kind: string | null }
export interface Stream { t: number[]; hr: (number | null)[]; v: (number | null)[]; alt: (number | null)[]; cad: (number | null)[] }
export interface Details { [k: string]: number | string | undefined }
export interface ActivityRow {
  id: string; sport: string; name: string | null; start_time: string; duration_s: number | null; distance_m: number | null;
  avg_hr: number | null; max_hr: number | null; zone_seconds_json: string | null; training_load: number | null;
  details_json?: string | null; laps_json?: string | null; stream_json?: string | null;
}
export interface PlannedRow {
  id: number; date: string; type: string; title: string; zone: string | null; duration_min: number | null;
  distance_km: number | null; structure_json?: string | null; notes?: string | null;
}

export type Tone = "good" | "warn" | "bad" | "info";
export interface Finding { tone: Tone; text: string }
export interface Split { km: number; sec: number; hr: number | null }
export interface WorkRep { n: number; dur: number; dist: number; pace: number | null; hr: number | null; hr_max: number | null }

export interface Analysis {
  verdict: "erfüllt" | "teilweise" | "verfehlt" | "ohne Plan";
  headline: string;
  findings: Finding[];
  pace_s_per_km: number | null;
  zones: { sec: number[]; pct: number[] } | null;
  easy_pct: number | null;
  decoupling_pct: number | null;
  splits: Split[];
  reps: WorkRep[];
  planned: { title: string; type: string; duration_min: number | null; distance_km: number | null; target_min: Record<string, number> } | null;
}

const HM_PACE = 278; // 4:38/km
const RUN_TYPES = ["easy", "long", "intervals", "threshold", "race", "run"];

export function parseJson<T>(s: string | null | undefined): T | null {
  if (!s) return null;
  try { return JSON.parse(s) as T; } catch { return null; }
}

/** 278 → "4:38" */
export function pace(sec: number | null): string {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return "-";
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const minutes = (sec: number) => Math.round(sec / 60);
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

/** Geplante Minuten je Zone aus dem Ablauf der Einheit */
function plannedZoneMinutes(p: PlannedRow): Record<string, number> {
  const blocks = parseJson<{ min: number; zone: string }[]>(p.structure_json) ?? (p.zone && p.duration_min ? [{ min: p.duration_min, zone: p.zone }] : []);
  const out: Record<string, number> = {};
  for (const b of blocks) out[b.zone] = (out[b.zone] ?? 0) + b.min;
  return out;
}

/** Kilometer-Splits aus dem Verlauf (Tempo integriert über die Zeit) */
function kmSplits(st: Stream): Split[] {
  const out: Split[] = [];
  let dist = 0, lastT = st.t[0] ?? 0, kmStartT = lastT, hrSum = 0, hrN = 0;
  for (let i = 1; i < st.t.length; i++) {
    const dt = st.t[i] - lastT;
    lastT = st.t[i];
    const v = st.v[i] ?? 0;
    if (dt <= 0 || dt > 120) continue;
    dist += v * dt;
    if (st.hr[i] != null) { hrSum += st.hr[i]!; hrN++; }
    if (dist >= (out.length + 1) * 1000) {
      out.push({ km: out.length + 1, sec: Math.round(st.t[i] - kmStartT), hr: hrN ? Math.round(hrSum / hrN) : null });
      kmStartT = st.t[i]; hrSum = 0; hrN = 0;
    }
  }
  return out;
}

/** Aerobe Entkopplung: Verhältnis Tempo zu Puls in der ersten gegen die zweite Hälfte (ohne die ersten 10 min) */
function decoupling(st: Stream): number | null {
  const pts = st.t.map((t, i) => ({ t, v: st.v[i], hr: st.hr[i] })).filter((p) => p.t >= 600 && p.v && p.hr && p.v > 1.5);
  if (pts.length < 20) return null;
  const mid = pts[Math.floor(pts.length / 2)].t;
  const ef = (xs: typeof pts) => xs.reduce((a, p) => a + p.v! / p.hr!, 0) / xs.length;
  const a = ef(pts.filter((p) => p.t < mid)), b = ef(pts.filter((p) => p.t >= mid));
  return a > 0 ? Math.round(((a - b) / a) * 1000) / 10 : null;
}

/** Belastungsrunden erkennen: Workout-Schritte (INTERVAL/ACTIVE) oder Runden deutlich schneller als der Rest */
function workReps(laps: Lap[]): WorkRep[] {
  if (laps.length < 3) return [];
  const flagged = laps.filter((l) => l.kind === "INTERVAL");
  let work = flagged;
  if (work.length === 0) {
    const speeds = laps.map((l) => l.v).filter((v) => v > 0).sort((a, b) => a - b);
    const median = speeds[Math.floor(speeds.length / 2)] ?? 0;
    work = laps.filter((l) => l.v > median * 1.12 && l.dur >= 45 && l.dur <= 1500);
  }
  return work.map((l, i) => ({
    n: i + 1, dur: Math.round(l.dur), dist: Math.round(l.dist), pace: l.v > 0 ? 1000 / l.v : null, hr: l.hr, hr_max: l.hr_max,
  }));
}

export function analyze(a: ActivityRow, plan: PlannedRow | null): Analysis {
  const z = parseJson<number[]>(a.zone_seconds_json);
  const laps = parseJson<Lap[]>(a.laps_json) ?? [];
  const st = parseJson<Stream>(a.stream_json);
  const dur = a.duration_s ?? 0;
  const distKm = (a.distance_m ?? 0) / 1000;
  const paceSec = distKm > 0.2 && dur > 0 ? dur / distKm : null;
  const zTotal = z ? z.reduce((s, x) => s + x, 0) : 0;
  const zones = z && zTotal > 0 ? { sec: z, pct: z.map((x) => pct(x, zTotal)) } : null;
  const easyPct = z && zTotal > 0 ? pct(z[0] + z[1], zTotal) : null;
  const isRun = a.sport === "run";
  const splits = st && isRun ? kmSplits(st) : [];
  const dec = st && dur >= 2400 ? decoupling(st) : null;
  const reps = workReps(laps);

  const findings: Finding[] = [];
  const add = (tone: Tone, text: string) => findings.push({ tone, text });
  let score = 0, checks = 0; // Punkte für das Gesamturteil
  const check = (ok: boolean | "half") => { checks++; score += ok === true ? 1 : ok === "half" ? 0.5 : 0; };

  const p = plan && isRun && RUN_TYPES.includes(plan.type) ? plan : null;
  const target = p ? plannedZoneMinutes(p) : {};

  if (p) {
    // Umfang
    if (p.duration_min) {
      const diff = pct(dur / 60 - p.duration_min, p.duration_min);
      if (Math.abs(diff) <= 10) { add("good", `Umfang passt: ${minutes(dur)} von ${p.duration_min} min.`); check(true); }
      else if (diff < -10) { add(diff < -30 ? "bad" : "warn", `${minutes(dur)} statt ${p.duration_min} min, ${Math.abs(diff)} % kürzer als geplant.`); check(diff < -30 ? false : "half"); }
      else { add(diff > 25 ? "warn" : "info", `${minutes(dur)} statt ${p.duration_min} min, ${diff} % länger als geplant.`); check(diff > 25 ? "half" : true); }
    }
    const z3 = z ? z[2] / 60 : 0, z4 = z ? z[3] / 60 : 0, z5 = z ? z[4] / 60 : 0;

    if (p.type === "easy" || (p.type === "long" && !target.Z4)) {
      if (easyPct != null) {
        if (easyPct >= 85) { add("good", `${easyPct} % in Z1 bis Z2, genau richtig für einen lockeren Lauf.`); check(true); }
        else if (easyPct >= 70) { add("warn", `Nur ${easyPct} % in Z1 bis Z2, ${Math.round(z3)} min in der Grauzone Z3. Etwas langsamer laufen.`); check("half"); }
        else { add("bad", `Zu schnell: nur ${easyPct} % locker, ${Math.round(z3 + z4 + z5)} min in Z3 und höher. Das war kein lockerer Lauf.`); check(false); }
      }
    }
    if (p.type === "long" && target.Z4) {
      add(z4 >= target.Z4 * 0.7 ? "good" : "warn", `HM-Tempo-Anteil: ${Math.round(z4)} von ${target.Z4} min in Z4.`);
      check(z4 >= target.Z4 * 0.7 ? true : "half");
    }
    if (p.type === "intervals") {
      const plannedZ5 = target.Z5 ?? 0;
      const reached = z5 + z4 * 0.5; // Puls hinkt bei kurzen Intervallen hinterher, Z4 zählt halb
      if (plannedZ5 > 0) {
        const r = reached / plannedZ5;
        if (r >= 0.6) add("good", `${Math.round(z5)} min in Z5 und ${Math.round(z4)} min in Z4 bei ${plannedZ5} min geplanter Belastung. Intensität erreicht.`);
        else add(r >= 0.35 ? "warn" : "bad", `Nur ${Math.round(z5)} min in Z5 bei ${plannedZ5} min geplant. Die Belastungen waren eher Schwelle als VO2max.`);
        check(r >= 0.6 ? true : r >= 0.35 ? "half" : false);
      }
      const plannedReps = (parseJson<{ min: number; zone: string }[]>(p.structure_json) ?? []).filter((b) => b.zone === "Z5").length;
      if (reps.length && plannedReps) {
        const avgPace = reps.reduce((s, r) => s + (r.pace ?? 0), 0) / reps.length;
        add(reps.length >= plannedReps ? "good" : "warn", `${reps.length} von ${plannedReps} Belastungen erkannt, Schnitt ${pace(avgPace)}/km.`);
        check(reps.length >= plannedReps ? true : "half");
        const first = reps[0].pace, last = reps[reps.length - 1].pace;
        if (first && last && reps.length >= 3) {
          const fade = ((last - first) / first) * 100;
          if (fade > 4) add("warn", `Letzte Belastung ${pace(last)}/km, erste ${pace(first)}/km: deutlich nachgelassen. Erste Wiederholung kontrollierter angehen.`);
          else add("good", `Gleichmäßig: erste ${pace(first)}/km, letzte ${pace(last)}/km.`);
        }
      }
    }
    if (p.type === "threshold" || p.type === "race") {
      const plannedZ4 = target.Z4 ?? 0;
      const isHm = /HM-Tempo|Halbmarathon/i.test(p.title);
      if (plannedZ4 > 0 && p.type !== "race") {
        const r = z4 / plannedZ4;
        if (r >= 0.7 && z5 <= plannedZ4 * 0.3) add("good", `${Math.round(z4)} von ${plannedZ4} min in Z4, sauber an der Schwelle.`);
        else if (z5 > plannedZ4 * 0.3) add("warn", `${Math.round(z5)} min in Z5: zu hart für eine Schwelleneinheit. Lieber knapp unter 171 bpm bleiben.`);
        else add(r >= 0.4 ? "warn" : "bad", `Nur ${Math.round(z4)} von ${plannedZ4} min in Z4. Die Belastung war zu locker oder zu kurz.`);
        check(r >= 0.7 && z5 <= plannedZ4 * 0.3 ? true : r >= 0.4 ? "half" : false);
      }
      if (isHm && reps.length) {
        const avg = reps.reduce((s, r) => s + (r.pace ?? 0), 0) / reps.length;
        const diff = Math.round(avg - HM_PACE);
        if (Math.abs(diff) <= 5) add("good", `HM-Tempo getroffen: ${pace(avg)}/km bei Ziel 4:38/km.`);
        else add("warn", `HM-Tempo ${pace(avg)}/km, Ziel 4:38/km (${diff > 0 ? `${diff} s zu langsam` : `${-diff} s zu schnell`}).`);
        check(Math.abs(diff) <= 5 ? true : Math.abs(diff) <= 12 ? "half" : false);
      }
      if (p.type === "race" && paceSec) add(paceSec <= HM_PACE ? "good" : "info", `Renntempo ${pace(paceSec)}/km, Ziel 4:38/km.`);
    }
  }

  // Unabhängig vom Plan
  if (dec != null && isRun) {
    if (dec <= 5) add("good", `Entkopplung ${dec.toString().replace(".", ",")} %: Puls und Tempo blieben stabil, gute Grundlage.`);
    else if (dec <= 8) add("info", `Entkopplung ${dec.toString().replace(".", ",")} %: Puls stieg in der zweiten Hälfte etwas an.`);
    else add("warn", `Entkopplung ${dec.toString().replace(".", ",")} %: deutlicher Pulsanstieg bei gleichem Tempo. Hitze, Müdigkeit oder zu wenig getrunken?`);
  }
  if (!p && isRun && easyPct != null) {
    add("info", `${easyPct} % in Z1 bis Z2. Für diesen Tag war kein Lauf geplant.`);
  }
  const det = parseJson<Details>(a.details_json) ?? {};
  if (isRun && typeof det.cadence === "number" && det.cadence > 0 && det.cadence < 160) {
    add("info", `Kadenz ${Math.round(det.cadence)} Schritte/min. Etwas kürzere, schnellere Schritte (Richtung 165 bis 170) schonen bei gleichem Tempo.`);
  }

  const ratio = checks ? score / checks : null;
  const verdict: Analysis["verdict"] = !p ? "ohne Plan" : ratio == null ? "teilweise" : ratio >= 0.8 ? "erfüllt" : ratio >= 0.45 ? "teilweise" : "verfehlt";
  const headline = !p ? "Freier Lauf ohne Vorgabe"
    : verdict === "erfüllt" ? `${p.title}: Vorgabe erfüllt`
    : verdict === "teilweise" ? `${p.title}: teilweise erfüllt`
    : `${p.title}: Vorgabe verfehlt`;

  return {
    verdict, headline, findings, pace_s_per_km: paceSec, zones, easy_pct: easyPct, decoupling_pct: dec, splits, reps,
    planned: p ? { title: p.title, type: p.type, duration_min: p.duration_min, distance_km: p.distance_km, target_min: target } : null,
  };
}
