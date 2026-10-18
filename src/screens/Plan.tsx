import { useEffect, useState } from "react";
import { api, isDemo, type Activity, type Result, type Session, type WeekData } from "../api";
import { Loading, Problem } from "../components/ui";
import { addDays, dayOfMonth, mondayOf, shortWeekday, todayIso, weekRange } from "../format";
import { sessionColor } from "../zones";

// Phasen bis zum Halbmarathon, Woche 1 beginnt am 26.10.2026
const PLAN_START = "2026-10-26";
const PHASES = [
  { name: "Grundlage", weeks: 10, color: "var(--z2)" },
  { name: "Aufbau", weeks: 9, color: "var(--z3)" },
  { name: "Spezifisch", weeks: 8, color: "var(--z4)" },
  { name: "Tapering", weeks: 3, color: "var(--z1)" },
];
const TOTAL = PHASES.reduce((a, p) => a + p.weeks, 0);

function weekNumber(monday: string): number {
  const diff = (Date.parse(monday + "T12:00:00Z") - Date.parse(PLAN_START + "T12:00:00Z")) / (7 * 86_400_000);
  return Math.round(diff) + 1;
}

export function Plan() {
  const [start, setStart] = useState(mondayOf(todayIso()));
  const [res, setRes] = useState<Result<WeekData> | null>(null);
  useEffect(() => { setRes(null); api.week(start).then(setRes); }, [start]);

  const wk = weekNumber(start);
  const phase = (() => { let n = 0; for (const p of PHASES) { n += p.weeks; if (wk <= n) return p.name; } return null; })();

  return (
    <div className="screen">
      <header style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="head" style={{ alignItems: "center" }}>
          <h1 className="title-display">Plan</h1>
          <div className="week-nav">
            <button type="button" className="icon-btn" aria-label="Vorherige Woche" onClick={() => setStart(addDays(start, -7))}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
            <span style={{ fontSize: 14, fontWeight: 600, minWidth: 110, textAlign: "center" }}>{weekRange(start, addDays(start, 6))}</span>
            <button type="button" className="icon-btn" aria-label="Nächste Woche" onClick={() => setStart(addDays(start, 7))}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </div>
        </div>

        {wk >= 1 && wk <= TOTAL ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>{phase}, Woche {wk} von {TOTAL}</span>
              <span className="muted">bis WVV Halbmarathon{isDemo && <span className="demo-flag">, Beispieldaten</span>}</span>
            </div>
            <div role="img" aria-label={`Phasen bis zum Halbmarathon, aktuell Woche ${wk}`} style={{ display: "flex", gap: 3, height: 10, position: "relative" }}>
              {PHASES.map((p) => <div key={p.name} style={{ flex: `${p.weeks} 1 0`, background: p.color, borderRadius: 2, opacity: p.name === phase ? 1 : 0.5 }} />)}
              <div style={{ position: "absolute", left: `calc(${((wk - 0.5) / TOTAL) * 100}% - 1.5px)`, top: -4, width: 3, height: 18, background: "var(--bib)", borderRadius: 2 }} />
            </div>
          </div>
        ) : (
          <p className="sub" style={{ margin: 0 }}>{wk < 1 ? `Der Plan startet am 26. Oktober.` : "Nach dem Halbmarathon, Planung für den Herbst folgt."}</p>
        )}
      </header>

      {!res ? <Loading /> : !res.ok ? <Problem status={res.status} message={res.message} /> : <Week data={res.data} />}
    </div>
  );
}

function Week({ data }: { data: WeekData }) {
  const today = todayIso();
  const days = Array.from({ length: 7 }, (_, i) => addDays(data.start, i));
  const byId = new Map<string, Activity>(data.activities.map((a) => [a.id, a]));

  if (data.sessions.length === 0) {
    return <p className="empty">Für diese Woche ist noch nichts geplant. Der Plan wird im nächsten Schritt importiert.</p>;
  }

  return (
    <ol className="days" aria-label="Tage der Woche">
      {days.map((d) => {
        const items = data.sessions.filter((s) => s.date === d);
        const hard = items.some((s) => s.hard === 1);
        return (
          <li key={d} className={`day${d === today ? " today" : ""}`}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span className="day-name">{d === today ? "Heute" : shortWeekday(d)}</span>
              <span className="day-num">{dayOfMonth(d)}</span>
              {hard && <span className="hard-tag">harter Tag</span>}
            </div>
            <div className="day-items">
              {items.length === 0 ? <span className="muted" style={{ fontSize: 15 }}>Ruhetag</span> : items.map((s) => <Item key={s.id} s={s} act={s.activity_id ? byId.get(s.activity_id) : undefined} />)}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Item({ s, act }: { s: Session; act?: Activity }) {
  const done = s.status === "erledigt";
  return (
    <div className="item">
      {done ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--z2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Erledigt" style={{ flex: "0 0 auto", marginTop: 1 }}><path d="M5 12l5 5 9-10" /></svg>
      ) : (
        <span className="swatch" style={{ background: sessionColor(s) }} />
      )}
      <div style={{ minWidth: 0 }}>
        <span style={{ fontWeight: s.hard ? 600 : 400 }}>{s.title}</span>
        {act && (
          <small>
            Garmin: {act.distance_m ? `${(act.distance_m / 1000).toFixed(1).replace(".", ",")} km` : ""}
            {act.duration_s ? ` in ${Math.floor(act.duration_s / 60)}:${String(act.duration_s % 60).padStart(2, "0")}` : ""}
            {act.avg_hr ? `, Ø ${act.avg_hr} bpm` : ""}
          </small>
        )}
      </div>
    </div>
  );
}
