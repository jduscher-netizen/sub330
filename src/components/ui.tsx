import type { ReactNode } from "react";
import type { SyncState } from "../api";
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
  if (status === 401) {
    return (
      <div className="notice" style={{ marginTop: 20 }}>
        <strong>Zugang noch nicht freigeschaltet</strong>
        {message} Deine Trainingsdaten bleiben gesperrt, bis die Anmeldung über Cloudflare Access eingerichtet ist.
        <div style={{ marginTop: 12 }}>
          <a className="btn btn-ghost" href="?demo#/heute">Beispieldaten ansehen</a>
        </div>
      </div>
    );
  }
  return (
    <div className="notice" style={{ marginTop: 20 }}>
      <strong>Daten nicht geladen</strong>
      {message}
    </div>
  );
}

export function Loading() {
  return <p className="empty" aria-live="polite">Lädt</p>;
}
