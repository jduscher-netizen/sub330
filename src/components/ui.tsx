import { useState, type FormEvent, type ReactNode } from "react";
import { api, type SyncState } from "../api";
import { ago } from "../format";

export type Tab = "heute" | "plan" | "verlauf" | "profil";

const ICONS: Record<Tab, ReactNode> = {
  heute: (<><rect x="5" y="3" width="14" height="18" rx="2" /><circle cx="8" cy="6.5" r="0.8" /><circle cx="16" cy="6.5" r="0.8" /><path d="M9 14h6" /></>),
  plan: (<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>),
  verlauf: (<><path d="M3 17l5-6 4 4 8-9" /><path d="M3 21h18" /></>),
  profil: (<><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>),
};
const LABELS: Record<Tab, string> = { heute: "Heute", plan: "Plan", verlauf: "Verlauf", profil: "Profil" };

export function TabBar({ current }: { current: Tab }) {
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

export function SyncPill({ sync }: { sync: SyncState[] }) {
  const g = sync.find((s) => s.source === "garmin");
  const ok = g?.last_ok_flag === 1;
  const color = !g ? "var(--text-faint)" : ok ? "var(--z2)" : "var(--z5)";
  const text = !g ? "Garmin nicht verbunden" : ok ? `Garmin ${ago(g.last_ok)}` : "Garmin-Sync gestört";
  return (
    <a className="sync-pill" href={`${location.search}#/profil`} style={{ textDecoration: "none" }}>
      <span className="dot" style={{ background: color }} />
      {text}
    </a>
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
            style={{ height: 48, borderRadius: 10, border: "1px solid #5a6168", background: "var(--asphalt-deep)", color: "var(--text)", padding: "0 14px", fontSize: 16, fontFamily: "inherit" }}
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
