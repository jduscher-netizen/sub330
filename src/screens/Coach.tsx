import { Fragment, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { api, isDemo, type CoachData, type CoachMsg, type Result } from "../api";
import { Loading, Problem } from "../components/ui";

const SUGGESTIONS = [
  "Wie war meine Woche bisher?",
  "Wie lief mein letzter Lauf im Vergleich zum Plan?",
  "Was passt heute, Gym oder Schwimmen?",
  "Wie entwickeln sich Ruhepuls und HRV?",
];

const TOOL_LABEL: Record<string, string> = {
  get_week: "Woche", list_activities: "Aktivitäten", analyze_activity: "Laufanalyse",
  get_health: "Gesundheitswerte", get_plan: "Plan", get_gym_log: "Gym-Tagebuch",
};

/** Fett (**text**) innerhalb einer Zeile */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>);
}

/** Absätze und einfache Listen aus der Coach-Antwort */
function Rich({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*([-*•]|\d+\.)\s+/.test(l))) {
          return <ul key={i}>{lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*([-*•]|\d+\.)\s+/, ""))}</li>)}</ul>;
        }
        return <p key={i}>{lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l)}</Fragment>)}</p>;
      })}
    </>
  );
}

export function Coach() {
  const [res, setRes] = useState<Result<CoachData> | null>(null);
  useEffect(() => { api.coach().then(setRes); }, []);
  return (
    <div className="screen coach-screen">
      {!res ? <Loading /> : !res.ok ? (
        <><header className="head"><h1 className="title-display">Coach</h1></header><Problem status={res.status} message={res.message} /></>
      ) : <Chat initial={res.data} />}
    </div>
  );
}

function Chat({ initial }: { initial: CoachData }) {
  const [messages, setMessages] = useState<CoachMsg[]>(initial.messages);
  const [draft, setDraft] = useState(() => { const d = sessionStorage.getItem("coach-draft") ?? ""; sessionStorage.removeItem("coach-draft"); return d; });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages.length, busy]);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true); setError(null); setDraft("");
    setMessages((m) => [...m, { role: "user", text: q, at: new Date().toISOString() }]);
    const r = await api.coachAsk(q);
    setBusy(false);
    if (r.ok && r.messages) setMessages(r.messages);
    else { setError(r.message ?? "Keine Antwort."); setDraft(q); setMessages((m) => m.slice(0, -1)); }
  }

  async function fresh() {
    if (busy) return;
    const r = await api.coachAsk("", true);
    if (r.ok || isDemo) { setMessages([]); setError(null); }
  }

  function submit(e: FormEvent) { e.preventDefault(); ask(draft); }

  return (
    <>
      <header className="head" style={{ alignItems: "center" }}>
        <div>
          <h1 className="title-display">Coach</h1>
          <p className="sub">Kennt deinen Plan, deine Läufe, Gesundheitswerte und das Gym-Tagebuch{isDemo && <span className="demo-flag">, Beispieldaten</span>}</p>
        </div>
        {messages.length > 0 && <button type="button" className="btn btn-ghost" style={{ height: 44, padding: "0 14px", fontSize: 13, whiteSpace: "nowrap", flex: "0 0 auto" }} onClick={fresh}>Neues Gespräch</button>}
      </header>

      {!initial.enabled && (
        <div className="notice" style={{ marginTop: 18 }}>
          <strong>Noch nicht eingerichtet</strong>
          Für den Coach braucht die App einen API-Schlüssel von Anthropic als GitHub-Secret ANTHROPIC_API_KEY.
        </div>
      )}

      <div className="chat" aria-live="polite">
        {messages.length === 0 && (
          <div className="chips" style={{ marginTop: 8 }}>
            {SUGGESTIONS.map((s) => <button type="button" key={s} className="chip" onClick={() => ask(s)} disabled={!initial.enabled}>{s}</button>)}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            {m.role === "assistant" ? <Rich text={m.text} /> : <p>{m.text}</p>}
            {m.tools && m.tools.length > 0 && <span className="bubble-tools">Nachgesehen: {m.tools.map((t) => TOOL_LABEL[t] ?? t).join(", ")}</span>}
          </div>
        ))}
        {busy && <div className="bubble assistant thinking"><span /><span /><span /><em>Coach schaut in deine Daten</em></div>}
        {error && <p role="alert" style={{ color: "var(--z5)", fontSize: 14, margin: 0 }}>{error}</p>}
        <div ref={end} />
      </div>

      <form className="chat-input" onSubmit={submit}>
        <label htmlFor="coach-q" className="sr-only">Frage an den Coach</label>
        <textarea
          id="coach-q" className="input" rows={1} placeholder="Frag deinen Coach" value={draft} disabled={!initial.enabled}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(draft); } }}
        />
        <button type="submit" className="btn btn-primary" style={{ flex: "0 0 auto", width: 52, padding: 0 }} disabled={busy || !draft.trim()} aria-label="Senden">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </button>
      </form>
    </>
  );
}
