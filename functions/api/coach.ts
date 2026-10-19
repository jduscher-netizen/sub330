import Anthropic from "@anthropic-ai/sdk";
import { coachTurn, type CoachMessage } from "../_lib/coach";
import { json, type Env } from "../_lib/types";

// KI-Coach: Gespräch lesen (GET) und eine Frage stellen (POST). Ein Gespräch = ein "thread".

interface Stored { id: number; role: string; content_json: string; created_at: string }

async function currentThread(env: Env): Promise<number> {
  const row = await env.DB.prepare("SELECT MAX(thread) AS t FROM coach_messages").first<{ t: number | null }>();
  return row?.t ?? 1;
}

async function loadThread(env: Env, thread: number): Promise<Stored[]> {
  const rows = await env.DB.prepare("SELECT id, role, content_json, created_at FROM coach_messages WHERE thread = ? ORDER BY id").bind(thread).all<Stored>();
  return rows.results;
}

/** Für die Anzeige: nur Fragen und Antworten, Werkzeug-Aufrufe als Hinweis an der Antwort */
function forDisplay(rows: Stored[]) {
  const out: { role: "user" | "assistant"; text: string; tools?: string[]; at: string }[] = [];
  let tools: string[] = [];
  for (const r of rows) {
    const content = JSON.parse(r.content_json) as CoachMessage["content"];
    if (r.role === "user") {
      if (typeof content === "string") out.push({ role: "user", text: content, at: r.created_at });
      continue;
    }
    const blocks: Anthropic.Beta.BetaContentBlockParam[] = typeof content === "string" ? [{ type: "text", text: content }] : content;
    for (const b of blocks) if (b.type === "tool_use") tools.push(b.name);
    const text = blocks.filter((b): b is Anthropic.Beta.BetaTextBlockParam => b.type === "text").map((b) => b.text).join("\n\n").trim();
    if (text) { out.push({ role: "assistant", text, tools: [...new Set(tools)], at: r.created_at }); tools = []; }
  }
  return out;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const thread = await currentThread(env);
  return json({ thread, enabled: Boolean(env.ANTHROPIC_API_KEY), messages: forDisplay(await loadThread(env, thread)) });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = (await request.json().catch(() => ({}))) as { text?: unknown; new_thread?: unknown };
  let thread = await currentThread(env);
  if (body.new_thread === true) {
    const has = await env.DB.prepare("SELECT 1 FROM coach_messages WHERE thread = ? LIMIT 1").bind(thread).first();
    if (has) thread += 1;
    if (typeof body.text !== "string" || !body.text.trim()) return json({ ok: true, thread, messages: [] });
  }
  if (!env.ANTHROPIC_API_KEY) return json({ ok: false, message: "Der KI-Coach ist noch nicht eingerichtet: GitHub-Secret ANTHROPIC_API_KEY fehlt." }, 503);
  const text = typeof body.text === "string" ? body.text.trim().slice(0, 4000) : "";
  if (!text) return json({ ok: false, message: "Bitte eine Frage eingeben." }, 400);

  const history: CoachMessage[] = (await loadThread(env, thread)).map((r) => ({ role: r.role as "user" | "assistant", content: JSON.parse(r.content_json) }));
  const question: CoachMessage = { role: "user", content: text };
  try {
    const { added } = await coachTurn(env, [...history, question]);
    // Erst nach erfolgreicher Antwort speichern, damit kein halbes Gespräch zurückbleibt
    const insert = env.DB.prepare("INSERT INTO coach_messages (thread, role, content_json) VALUES (?, ?, ?)");
    await env.DB.batch([question, ...added].map((m) => insert.bind(thread, m.role, JSON.stringify(m.content))));
  } catch (e) {
    const message = e instanceof Anthropic.RateLimitError ? "Der KI-Dienst ist gerade ausgelastet. Bitte gleich nochmal."
      : e instanceof Anthropic.AuthenticationError ? "Der API-Schlüssel wird abgelehnt. Prüfe ANTHROPIC_API_KEY."
      : e instanceof Anthropic.APIError ? `KI-Dienst meldet Fehler ${e.status}.`
      : "Keine Antwort vom Coach. Bitte nochmal versuchen.";
    return json({ ok: false, message }, 502);
  }
  return json({ ok: true, thread, messages: forDisplay(await loadThread(env, thread)) });
};
