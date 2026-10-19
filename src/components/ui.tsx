import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { api, isDemo, type SyncState } from "../api";
import { ago } from "../format";

export type Tab = "heute" | "plan" | "gym" | "verlauf" | "profil";

const ICONS: Record<Tab, ReactNode> = {
  heute: (<><rect x="5" y="3" width="14" height="18" rx="2" /><circle cx="8" cy="6.5" r="0.8" /><circle cx="16" cy="6.5" r="0.8" /><path d="M9 14h6" /></>),
  plan: (<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>),
  gym: (<><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" /></>),
  verlauf: (<><path d="M3 17l5-6 4 4 8-9" /><path d="M3 21h18" /></>),
  profil: (<><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>),
};
const LABELS: Record<Tab, string> = { heute: "Heute", plan: "Plan", gym: "Gym", verlauf: "Verlauf", profil: "Profil" };

export function TabBar({ current }: { current: Tab | null }) {
  const keep = location.search;
  return (
    <nav className="tabbar" aria-label="Hauptnavigation">
      {(Object.keys(LABELS) as Tab[]).map((t) => (
        <a key={t} className="tab" href={`${keep}#/${t}`} aria-current={t === current ? "page" : undefined}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {ICONS[t]}
          </svg>
          {LABELS[t]}
        </a>
      ))}
    </nav>
  );
}

const SYNC_POLL_MS = 5000;
const SYNC_MAX_MS = 4 * 60_000;

export type SyncRun = { state: "idle" | "running" | "done" | "error"; message: string | null };

/** "Jetzt synchronisieren": startet den Workflow und wartet auf den neuen Eintrag im Sync-Protokoll. */
export function useGarminSync(onDone?: () => void) {
  const [run, setRun] = useState<SyncRun>({ state: "idle", message: null });
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);
  useEffect(() => () => clearInterval(timer.current), []);

  async function start() {
    if (run.state === "running") return;
    setRun({ state: "running", message: "Sync gestartet" });
    const before = await api.garmin();
    const lastId = before.ok ? Math.max(0, ...before.data.log.map((l) => l.id ?? 0)) : 0;
    const res = await api.syncNow();
    if (!res.ok) return setRun({ state: "error", message: res.message ?? "Sync konnte nicht starten." });
    if (isDemo) {
      setTimeout(() => setRun({ state: "done", message: "Synchronisiert" }), 2500);
      return;
    }
    const t0 = Date.now();
    clearInterval(timer.current);
    timer.current = setInterval(async () => {
      const r = await api.garmin();
      const fresh = r.ok ? r.data.log.find((l) => (l.id ?? 0) > lastId && l.finished_at) : undefined;
      if (fresh) {
        clearInterval(timer.current);
        setRun(fresh.ok === 1 ? { state: "done", message: "Synchronisiert" } : { state: "error", message: fresh.message ?? "Sync fehlgeschlagen." });
        onDone?.();
      } else if (Date.now() - t0 > SYNC_MAX_MS) {
        clearInterval(timer.current);
        setRun({ state: "error", message: "Kein Ergebnis nach 4 Minuten. Sieh im Sync-Protokoll nach." });
        onDone?.();
      }
    }, SYNC_POLL_MS);
  }

  return { run, start };
}

const SYNC_PATHS = (<><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" /><path d="M4 3v5h5" /><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" /><path d="M20 21v-5h-5" /></>);
const SYNC_ICON_SMALL = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{SYNC_PATHS}</svg>
);
const SYNC_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {SYNC_PATHS}
  </svg>
);

/** Sync-Status im Kopf des Heute-Screens; ein Tipp startet den Sync. */
export function SyncPill({ sync, onDone }: { sync: SyncState[]; onDone?: () => void }) {
  const { run, start } = useGarminSync(onDone);
  const g = sync.find((s) => s.source === "garmin");
  const ok = g?.last_ok_flag === 1;
  const busy = run.state === "running";
  const failed = run.state === "error" || (g != null && !ok);
  const color = !g ? "var(--text-faint)" : failed ? "var(--z5)" : "var(--z2)";
  const text = busy ? "Sync läuft"
    : run.state === "error" ? "Sync fehlgeschlagen"
    : !g ? "Garmin nicht verbunden"
    : ok ? `Garmin ${ago(g.last_ok)}` : "Garmin-Sync gestört";
  return (
    <div className="sync-wrap">
      <button
        type="button" className={`sync-pill${busy ? " busy" : ""}`} onClick={start} disabled={busy}
        aria-label={`${text}. Jetzt synchronisieren`}
      >
        <span className="dot" style={{ background: color }} />
        {text}
        {SYNC_ICON_SMALL}
      </button>
      {run.state === "error" && run.message && <span className="sync-error" role="alert">{run.message}</span>}
    </div>
  );
}

/** Breiter Knopf mit Statuszeile, z. B. im Profil */
export function SyncNowButton({ onDone }: { onDone?: () => void }) {
  const { run, start } = useGarminSync(onDone);
  const busy = run.state === "running";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <button type="button" className={`btn btn-accent-ghost btn-block${busy ? " busy" : ""}`} onClick={start} disabled={busy}>
        {SYNC_ICON}{busy ? "Sync läuft, dauert etwa eine Minute" : "Jetzt synchronisieren"}
      </button>
      {run.state === "done" && <span className="sub" style={{ margin: 0 }} aria-live="polite">{run.message}</span>}
      {run.state === "error" && <span role="alert" style={{ color: "var(--z5)", fontSize: 14 }}>{run.message}</span>}
    </div>
  );
}

/** Fehler und leere Zustände: sagt, was los ist und was zu tun ist. */
export function Problem({ status, message }: { status: number; message: string }) {
  if (status === 401) return <Login reason={message} />;
  return (
    <div className="notice" style={{ marginTop: 20 }}>
      <strong>Daten nicht geladen</strong>
      {message}
    </div>
  );
}

function Login({ reason }: { reason: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const notReady = reason.includes("nicht eingerichtet");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await api.login(password);
    setBusy(false);
    if (res.ok) location.reload();
    else setError(res.message ?? "Anmelden fehlgeschlagen.");
  }

  return (
    <form className="notice" style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }} onSubmit={submit}>
      <strong style={{ margin: 0 }}>Anmelden</strong>
      {notReady ? (
        <span>{reason} Das Passwort wird als GitHub-Secret APP_PASSWORD hinterlegt.</span>
      ) : (
        <>
          <label htmlFor="pw" style={{ fontSize: 13, color: "var(--text-muted)" }}>Passwort</label>
          <input
            id="pw" type="password" autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} required
            style={{ height: 48, borderRadius: 10, border: "1px solid var(--ghost-line)", background: "var(--asphalt-deep)", color: "var(--text)", padding: "0 14px", fontSize: 16, fontFamily: "inherit" }}
          />
          {error && <span role="alert" style={{ color: "var(--z5)", fontSize: 14 }}>{error}</span>}
          <button type="submit" className="btn btn-primary" disabled={busy || !password}>{busy ? "Prüfe" : "Anmelden"}</button>
        </>
      )}
      <a href="?demo#/heute" style={{ fontSize: 14, color: "var(--text-muted)" }}>Beispieldaten ansehen</a>
    </form>
  );
}

export function Loading() {
  return <p className="empty" aria-live="polite">Lädt</p>;
}
