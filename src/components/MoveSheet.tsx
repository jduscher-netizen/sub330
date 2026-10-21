import { useEffect, useState } from "react";
import { api, type Session } from "../api";
import { addDays, dayOfMonth, mondayOf, shortWeekday, todayIso } from "../format";
import { isRun } from "../training";

const DAYS = 14;
const KEY = ["intervals", "long", "race"];

interface Option { date: string; runs: Session[]; warnings: string[]; ok: string | null }

/**
 * Lauf auf einen anderen Tag legen. Zeigt die nächsten 14 Tage mit den Läufen, die dort schon liegen,
 * und warnt nach den Planregeln (nie zwei harte Tage hintereinander, ein Lauf pro Tag).
 */
export function MoveSheet({ session, onClose, onMoved }: { session: Session; onClose: () => void; onMoved: () => void }) {
  const [options, setOptions] = useState<Option[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = todayIso();

  useEffect(() => {
    const first = mondayOf(today);
    Promise.all([0, 7, 14].map((d) => api.week(addDays(first, d)))).then((weeks) => {
      const all = weeks.flatMap((w) => (w.ok ? w.data.sessions : [])).filter((s) => isRun(s.type) && s.id !== session.id);
      const on = (d: string) => all.filter((s) => s.date === d);
      const opts: Option[] = [];
      for (let i = 0; i < DAYS; i++) {
        const date = addDays(today, i);
        const runs = on(date);
        const warnings: string[] = [];
        if (runs.length) warnings.push(`schon geplant: ${runs.map((r) => r.title.split(",")[0]).join(", ")}`);
        if (session.hard) {
          const before = on(addDays(date, -1)).find((r) => r.hard);
          const after = on(addDays(date, 1)).find((r) => r.hard);
          if (before) warnings.push(`Tag davor hart (${before.title.split(",")[0]})`);
          if (after) warnings.push(`Tag danach hart (${after.title.split(",")[0]})`);
        }
        const ok = !runs.length && !(session.hard && warnings.some((w) => w.startsWith("Tag ")))
          ? (session.hard ? "passt, kein harter Tag daneben" : "frei") : null;
        opts.push({ date, runs, warnings, ok });
      }
      setOptions(opts);
    });
  }, [session.id]);

  async function move(date: string) {
    setBusy(date); setError(null);
    const r = await api.moveSession(session.id, date);
    setBusy(null);
    if (r.ok) onMoved(); else setError(r.message ?? "Nicht verschoben.");
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`${session.title} verschieben`} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" aria-hidden="true" />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <h2 className="sheet-title">Verschieben</h2>
            <p className="sheet-sub">{session.title}, geplant {shortWeekday(session.date)} {dayOfMonth(session.date)}.{session.moved_from ? `, ursprünglich ${shortWeekday(session.moved_from)} ${dayOfMonth(session.moved_from)}.` : ""}</p>
          </div>
          <button type="button" className="icon-btn sheet-close" aria-label="Schließen" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        {KEY.includes(session.type) && <p className="sheet-sub" style={{ marginTop: -4 }}>Denk dran: am Vortag kein Bein-Gym und kein Padel.</p>}
        {error && <p role="alert" style={{ color: "var(--z5)", fontSize: 14, margin: 0 }}>{error}</p>}
        {!options ? <p className="sheet-sub">Lädt</p> : (
          <div className="sheet-list">
            {options.map((o) => {
              const current = o.date === session.date;
              return (
                <button type="button" key={o.date} className={`sheet-day${current ? " current" : ""}`} disabled={current || busy !== null} onClick={() => move(o.date)}>
                  <span className="sheet-day-name">{o.date === today ? "Heute" : shortWeekday(o.date)}<b>{dayOfMonth(o.date)}</b></span>
                  <span className="grow" style={{ minWidth: 0 }}>
                    {current ? <span className="muted">aktuell geplant</span>
                      : busy === o.date ? <span>Verschiebt</span>
                      : o.ok ? <span style={{ color: "var(--z2)" }}>{o.ok}</span> : null}
                    {!current && o.warnings.map((w) => <small key={w} style={{ color: "var(--z3)" }}>{w}</small>)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
