import Anthropic from "@anthropic-ai/sdk";
import { analyze, type ActivityRow, type PlannedRow } from "./analysis";
import { addDays, isIsoDate, mondayOf, todayBerlin, type Env } from "./types";

// KI-Coach: Claude mit lesendem Zugriff auf Jans Trainingsdaten über Werkzeuge (D1-Abfragen).

export const MODEL = "claude-opus-5-5";
const MAX_TOOL_ROUNDS = 8;
const RUN_TYPES = ["easy", "long", "intervals", "threshold", "race", "run"];

/** Fester Teil des Systemprompts (wird gecacht, daher hier nichts, was sich täglich ändert) */
export const SYSTEM = `Du bist der persönliche Lauf- und Trainingscoach von Jan in seiner Trainings-App SUB330. Du antwortest auf Deutsch, direkt und konkret, wie ein erfahrener Trainer, der Jans Daten kennt. Duze Jan.

Athlet:
- Laktatschwelle 170 bpm, HFmax 195 bpm, Gewicht etwa 85 kg (Ziel 3 bis 4 kg Fett weniger), Uhr Garmin Forerunner 970.
- Bestzeiten: Halbmarathon 1:44:42 (Marbella, 27.09.2026), Marathon 3:59:09 (München, 11.10.2026).
- Herzfrequenzzonen: Z1 bis 139 (Recovery), Z2 140 bis 149 (GA1), Z3 150 bis 159 (GA2, Grauzone), Z4 160 bis 171 (Schwelle), Z5 ab 172 (VO2max).
- Trainingsphilosophie: polarisiert 80/20, möglichst wenig Zeit in Z3.

Ziele 2027:
- WVV Halbmarathon Würzburg am 23.05.2027 unter 1:38 (4:38/km).
- Marathon im Oktober 2027 unter 3:30.
- VO2max steigern, Kraulschwimmen lernen (Entscheidung über Triathlon 2028).

Plan und Woche:
- Laufen fest nach Tagen: Dienstag Schwelle bzw. HM-Tempo, Donnerstag VO2max-Intervalle, Freitag locker, Sonntag Long Run. 30 Wochen ab 26.10.2026, Phasen Grundlage, Aufbau, Spezifisch, Tapering.
- Gym, Schwimmen, Padel und Rad nur als Wochenziel (Gym 3 bis 4 mal, Schwimmen 1 bis 2 mal, Padel 1 mal, Rad optional nur Z2). Jan entscheidet täglich.
- Regeln: nie zwei harte Tage hintereinander (Intervalle, Schwelle, Long Run, Padel, Bein-Gym zählen als hart), kein Bein-Gym am Tag vor Intervallen oder Long Run, Long Run hat Vorrang vor Tempo, Tempo vor lockerem Lauf, Wochenumfang nie mehr als 10 % über Plan.

Arbeitsweise:
- Hol dir Daten mit den Werkzeugen, bevor du über konkrete Läufe, Werte oder Wochen sprichst. Erfinde keine Zahlen. Wenn Daten fehlen (z. B. noch nicht synchronisiert), sag das.
- Beziehe dich auf Jans Zonen und den Plan. Nenne konkrete Zahlen (Pace als min:ss/km, Puls in bpm, Minuten je Zone).
- Bei Schmerzen, Verletzungsverdacht oder Krankheit: vorsichtig sein und zu ärztlicher Abklärung raten.
- Antworte kompakt: kurze Absätze oder knappe Listen, keine Tabellen, keine Überschriften. Verwende keine Gedankenstriche, schreibe stattdessen ganze Sätze oder Kommas.`;

type Input = Record<string, unknown>;

const dateArg = (v: unknown, fallback: string) => (typeof v === "string" && isIsoDate(v) ? v : fallback);

/** Spanne begrenzen, damit Antworten der Werkzeuge klein bleiben */
function range(input: Input, defaultDays: number, maxDays: number): [string, string] {
  const today = todayBerlin();
  const to = dateArg(input.to, today);
  let from = dateArg(input.from, addDays(to, -(defaultDays - 1)));
  if (from > to) from = to;
  if (addDays(from, maxDays - 1) < to) from = addDays(to, -(maxDays - 1));
  return [from, to];
}

export const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "get_week",
    description: "Trainingswoche (Montag bis Sonntag): geplante Läufe, Wochenziele für Gym/Schwimmen/Padel/Rad und alle Garmin-Aktivitäten der Woche mit Kurzdaten. Ohne Datum die aktuelle Woche.",
    input_schema: { type: "object", properties: { date: { type: "string", description: "Ein beliebiger Tag der Woche, YYYY-MM-DD" } }, additionalProperties: false },
  },
  {
    name: "list_activities",
    description: "Garmin-Aktivitäten in einem Zeitraum (höchstens 92 Tage) mit Sportart, Dauer, Distanz, Pace, Puls, Zonenzeiten und Trainingslast. Für Fragen zu Umfang, Verlauf und einzelnen Einheiten.",
    input_schema: {
      type: "object",
      properties: {
        from: { type: "string", description: "Startdatum YYYY-MM-DD, Standard 14 Tage zurück" },
        to: { type: "string", description: "Enddatum YYYY-MM-DD, Standard heute" },
        sport: { type: "string", enum: ["run", "bike", "swim", "strength", "padel", "other"] },
      },
      additionalProperties: false,
    },
  },
  {
    name: "analyze_activity",
    description: "Ausführliche Auswertung einer Aktivität: Abgleich mit der geplanten Einheit, Zonenverteilung, Kilometer-Splits, erkannte Belastungsrunden, aerobe Entkopplung, Kadenz, Trainingseffekt. Die ID kommt aus list_activities oder get_week.",
    input_schema: { type: "object", properties: { activity_id: { type: "string" } }, required: ["activity_id"], additionalProperties: false },
  },
  {
    name: "get_health",
    description: "Tageswerte von Garmin im Zeitraum (höchstens 92 Tage): Trainingsbereitschaft mit Faktoren, HRV, Schlaf, Ruhepuls, Body Battery, Stress, akute Last, VO2max, Gewicht.",
    input_schema: {
      type: "object",
      properties: { from: { type: "string", description: "YYYY-MM-DD, Standard 7 Tage zurück" }, to: { type: "string", description: "YYYY-MM-DD, Standard heute" } },
      additionalProperties: false,
    },
  },
  {
    name: "get_plan",
    description: "Geplante Laufeinheiten im Zeitraum (höchstens 92 Tage) mit Typ, Zone, Dauer, Distanz, Ablauf und Status. Gut für Ausblick und Fragen zum Plan.",
    input_schema: {
      type: "object",
      properties: { from: { type: "string", description: "YYYY-MM-DD, Standard heute" }, to: { type: "string", description: "YYYY-MM-DD, Standard 14 Tage voraus" } },
      additionalProperties: false,
    },
  },
  {
    name: "get_gym_log",
    description: "Einträge aus dem Gym-Tagebuch (Übung, Sätze, Wiederholungen, Gewicht) im Zeitraum, höchstens 92 Tage.",
    input_schema: {
      type: "object",
      properties: { from: { type: "string", description: "YYYY-MM-DD, Standard 28 Tage zurück" }, to: { type: "string", description: "YYYY-MM-DD, Standard heute" } },
      additionalProperties: false,
    },
  },
];

const ACT_COLS = "id, sport, name, start_time, duration_s, distance_m, avg_hr, max_hr, zone_seconds_json, training_load";

function summarizeActivity(a: Record<string, unknown>) {
  const dur = Number(a.duration_s ?? 0), dist = Number(a.distance_m ?? 0);
  return {
    id: a.id, sport: a.sport, name: a.name, start: a.start_time,
    min: dur ? Math.round(dur / 60) : null, km: dist ? Math.round(dist / 100) / 10 : null,
    pace_min_km: a.sport === "run" && dist > 200 && dur ? `${Math.floor(dur / (dist / 1000) / 60)}:${String(Math.round((dur / (dist / 1000)) % 60)).padStart(2, "0")}` : null,
    avg_hr: a.avg_hr, max_hr: a.max_hr, zone_sec_z1_to_z5: a.zone_seconds_json ? JSON.parse(String(a.zone_seconds_json)) : null,
    training_load: a.training_load,
  };
}

/** Geplante Laufeinheit für eine Aktivität: verknüpft, sonst die erste Laufeinheit des Tages */
export async function plannedFor(env: Env, a: ActivityRow): Promise<PlannedRow | null> {
  if (a.sport !== "run") return null;
  const rows = await env.DB.prepare(
    `SELECT id, date, type, title, zone, duration_min, distance_km, structure_json, notes, activity_id FROM planned_sessions
     WHERE date = ? AND type IN (${RUN_TYPES.map(() => "?").join(", ")}) ORDER BY sort, id`,
  ).bind(a.start_time.slice(0, 10), ...RUN_TYPES).all<PlannedRow & { activity_id: string | null }>();
  return rows.results.find((p) => p.activity_id === a.id) ?? rows.results.find((p) => !p.activity_id) ?? null;
}

export async function loadActivity(env: Env, id: string): Promise<ActivityRow | null> {
  return env.DB.prepare(`SELECT ${ACT_COLS}, details_json, laps_json, stream_json, ai_comment FROM activities WHERE id = ?`)
    .bind(id).first<ActivityRow>();
}

export async function runTool(env: Env, name: string, input: Input): Promise<unknown> {
  switch (name) {
    case "get_week": {
      const start = mondayOf(dateArg(input.date, todayBerlin()));
      const end = addDays(start, 6);
      const [sessions, acts, targets] = await Promise.all([
        env.DB.prepare("SELECT date, type, title, zone, duration_min, distance_km, status, activity_id FROM planned_sessions WHERE date BETWEEN ? AND ? ORDER BY date, sort").bind(start, end).all(),
        env.DB.prepare(`SELECT ${ACT_COLS} FROM activities WHERE substr(start_time, 1, 10) BETWEEN ? AND ? ORDER BY start_time`).bind(start, end).all(),
        env.DB.prepare("SELECT category, target_min, target_max, note FROM week_targets WHERE week_start = ?").bind(start).all(),
      ]);
      return { week: `${start} bis ${end}`, planned_runs: sessions.results, activities: acts.results.map(summarizeActivity), weekly_targets: targets.results };
    }
    case "list_activities": {
      const [from, to] = range(input, 14, 92);
      const sport = typeof input.sport === "string" ? input.sport : null;
      const rows = await env.DB.prepare(
        `SELECT ${ACT_COLS} FROM activities WHERE substr(start_time, 1, 10) BETWEEN ? AND ? ${sport ? "AND sport = ?" : ""} ORDER BY start_time LIMIT 150`,
      ).bind(...(sport ? [from, to, sport] : [from, to])).all();
      return { from, to, count: rows.results.length, activities: rows.results.map(summarizeActivity) };
    }
    case "analyze_activity": {
      const a = await loadActivity(env, String(input.activity_id ?? ""));
      if (!a) return { error: "Aktivität nicht gefunden" };
      const plan = await plannedFor(env, a);
      const an = analyze(a, plan);
      return {
        activity: summarizeActivity(a as unknown as Record<string, unknown>),
        details: a.details_json ? JSON.parse(a.details_json) : null,
        planned: plan ? { title: plan.title, type: plan.type, duration_min: plan.duration_min, distance_km: plan.distance_km, notes: plan.notes } : null,
        verdict: an.verdict, findings: an.findings.map((f) => `${f.tone}: ${f.text}`),
        zones_pct_z1_to_z5: an.zones?.pct ?? null, decoupling_pct: an.decoupling_pct,
        km_splits: an.splits.map((s) => ({ km: s.km, sec: s.sec, hr: s.hr })), work_reps: an.reps,
      };
    }
    case "get_health": {
      const [from, to] = range(input, 7, 92);
      const rows = await env.DB.prepare(
        `SELECT date, readiness_score, readiness_level, sleep_score, sleep_seconds, recovery_hours, hrv_last_night, hrv_status, acute_load,
                acute_load_status, stress_avg, body_battery_high, body_battery_low, resting_hr, vo2max, weight_kg, factors_json
         FROM daily_metrics WHERE date BETWEEN ? AND ? ORDER BY date`,
      ).bind(from, to).all();
      return { from, to, days: rows.results.map((r) => ({ ...r, factors_json: undefined, factors: r.factors_json ? JSON.parse(String(r.factors_json)) : null })) };
    }
    case "get_plan": {
      const today = todayBerlin();
      const from = dateArg(input.from, today);
      let to = dateArg(input.to, addDays(from, 13));
      if (addDays(from, 91) < to) to = addDays(from, 91);
      const rows = await env.DB.prepare(
        "SELECT date, type, title, zone, duration_min, distance_km, hard, status, notes FROM planned_sessions WHERE date BETWEEN ? AND ? ORDER BY date, sort",
      ).bind(from, to).all();
      return { from, to, sessions: rows.results };
    }
    case "get_gym_log": {
      const [from, to] = range(input, 28, 92);
      const rows = await env.DB.prepare(
        "SELECT date, exercise, sets, reps, weight_kg FROM gym_entries WHERE date BETWEEN ? AND ? ORDER BY date, id LIMIT 400",
      ).bind(from, to).all();
      return { from, to, entries: rows.results };
    }
    default:
      return { error: `Unbekanntes Werkzeug ${name}` };
  }
}

/** Tageskontext als eigener, nicht gecachter Systemblock */
export function todayContext(): string {
  const today = todayBerlin();
  const wd = new Intl.DateTimeFormat("de-DE", { weekday: "long", timeZone: "UTC" }).format(new Date(today + "T12:00:00Z"));
  return `Heute ist ${wd}, der ${today}.`;
}

export function client(env: Env): Anthropic {
  return new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 2, ...(env.ANTHROPIC_BASE_URL ? { baseURL: env.ANTHROPIC_BASE_URL } : {}) });
}

export type CoachMessage = Anthropic.Beta.BetaMessageParam;

/**
 * Ein Coach-Zug: ruft Claude so lange mit Werkzeugen auf, bis eine Antwort fertig ist.
 * Gibt alle neuen Nachrichten zurück (Assistent und Werkzeug-Ergebnisse), unverändert zum Speichern.
 */
export async function coachTurn(env: Env, history: CoachMessage[]): Promise<{ added: CoachMessage[]; text: string; refused: boolean }> {
  const api = client(env);
  const messages = [...history];
  const added: CoachMessage[] = [];
  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const res = await api.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: [
        { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
        { type: "text", text: todayContext() },
      ],
      tools: TOOLS,
      messages,
    });

    if (res.stop_reason === "refusal") {
      return { added, text: "Dazu kann ich dir hier leider keine Antwort geben.", refused: true };
    }
    const assistant: CoachMessage = { role: "assistant", content: res.content as Anthropic.Beta.BetaContentBlockParam[] };
    messages.push(assistant);
    added.push(assistant);

    const uses = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (res.stop_reason !== "tool_use" || uses.length === 0) {
      if (res.stop_reason === "pause_turn") continue;
      const text = res.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n\n").trim();
      return { added, text, refused: false };
    }

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = await Promise.all(uses.map(async (u) => {
      try {
        const out = await runTool(env, u.name, (u.input ?? {}) as Input);
        return { type: "tool_result" as const, tool_use_id: u.id, content: JSON.stringify(out) };
      } catch (e) {
        return { type: "tool_result" as const, tool_use_id: u.id, content: `Fehler: ${e instanceof Error ? e.message : "unbekannt"}`, is_error: true };
      }
    }));
    const toolMsg: CoachMessage = { role: "user", content: results };
    messages.push(toolMsg);
    added.push(toolMsg);
  }
  return { added, text: "Das war mir zu viel auf einmal. Frag bitte etwas genauer.", refused: false };
}

/** Kurzer Kommentar zu einer einzelnen Aktivität (ohne Werkzeuge, alle Daten im Prompt) */
export async function activityComment(env: Env, payload: unknown): Promise<string> {
  const api = client(env);
  const res = await api.beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system: [
      { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
      { type: "text", text: todayContext() },
    ],
    messages: [{
      role: "user",
      content: `Bewerte diese Einheit für Jan in 4 bis 6 Sätzen: Was lief gut, was nicht, und was bedeutet das für die nächsten Tage im Plan? Nur Fließtext, keine Liste.\n\n${JSON.stringify(payload)}`,
    }],
  });
  if (res.stop_reason === "refusal") return "Für diese Einheit gibt es keinen Kommentar.";
  return res.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n\n").trim();
}
