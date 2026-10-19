import { useEffect, useState } from "react";
import { api, isDemo, type Activity, type Result, type Session, type WeekData } from "../api";
import { FlexTiles } from "../components/FlexTiles";
import { activityFacts, flexProgress, isRun, matchRuns, sportInfo } from "../training";
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
          <p className="sub" style={{ margin: 0 }}>{wk === 0 ? "Vorwoche: drei lockere Läufe zum Wiedereinstieg. Woche 1 startet am 26. Oktober." : wk < 0 ? "Der Plan startet am 19. Oktober." : "Nach dem Halbmarathon, Planung für den Herbst folgt."}</p>
        )}
      </header>

      {!res ? <Loading /> : !res.ok ? <Problem status={res.status} message={res.message} /> : <Week data={res.data} />}
    </div>
  );
}

function Week({ data }: { data: WeekData }) {
  const today = todayIso();
  const days = Array.from({ length: 7 }, (_, i) => addDays(data.start, i));
  const { matched, rest } = matchRuns(data.sessions, data.activities);

  if (data.sessions.length === 0 && data.activities.length === 0 && data.targets.length === 0) {
    return <p className="empty">Für diese Woche ist nichts geplant und Garmin hat noch keine Aktivitäten geliefert.</p>;
  }

  return (
    <>
      <WeekSummary data={data} matched={matched} />
      <ol className="days" aria-label="Tage der Woche">
        {days.map((d) => {
          const items = data.sessions.filter((s) => s.date === d);
          const extra = rest.filter((a) => a.start_time.slice(0, 10) === d);
          const hard = items.some((s) => s.hard === 1) || extra.some((a) => a.sport === "padel");
          return (
            <li key={d} className={`day${d === today ? " today" : ""}`}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span className="day-name">{d === today ? "Heute" : shortWeekday(d)}</span>
                <span className="day-num">{dayOfMonth(d)}</span>
                {hard && <span className="hard-tag">harter Tag</span>}
              </div>
              <div className="day-items">
                {items.length === 0 && extra.length === 0 && <span className="muted" style={{ fontSize: 15 }}>{d < today ? "Frei" : "Kein Lauf, frei einteilen"}</span>}
                {items.map((s) => <Item key={s.id} s={s} act={matched.get(s.id)} past={d < today} />)}
                {extra.map((a) => <ActivityItem key={a.id} a={a} />)}
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}

const km = (v: number) => (Math.round(v * 10) / 10).toLocaleString("de-DE", { maximumFractionDigits: 1 });

function parseZones(json?: string | null): number[] | null {
  if (!json) return null;
  try {
    const z = JSON.parse(json);
    return Array.isArray(z) && z.length === 5 ? z.map(Number) : null;
  } catch {
    return null;
  }
}

/** Bilanz der Woche: Laufumfang, Läufe, harte Tage, 80/20 und Wochenziele für alles andere. */
function WeekSummary({ data, matched }: { data: WeekData; matched: Map<number, Activity> }) {
  const runs = data.sessions.filter((s) => isRun(s.type));
  const acts = data.activities;
  const runsDone = runs.filter((s) => s.status === "erledigt" || matched.has(s.id)).length;
  const hardDays = new Set([
    ...data.sessions.filter((s) => s.hard === 1).map((s) => s.date),
    ...acts.filter((a) => a.sport === "padel").map((a) => a.start_time.slice(0, 10)),
  ]).size;

  const plannedKm = runs.reduce((a, s) => a + (s.distance_km ?? 0), 0);
  const doneKm = acts.filter((a) => a.sport === "run").reduce((a, x) => a + (x.distance_m ?? 0) / 1000, 0);

  // 80/20: absolvierte Zonenzeiten, solange es keine gibt die geplanten Laufminuten
  const zoneSum = acts.map((a) => parseZones(a.zone_seconds_json)).filter((z): z is number[] => !!z)
    .reduce((a, z) => a.map((v, i) => v + z[i]), [0, 0, 0, 0, 0]);
  let easy = zoneSum[0] + zoneSum[1];
  let hard = zoneSum[2] + zoneSum[3] + zoneSum[4];
  let source = "absolviert";
  if (easy + hard === 0) {
    source = "geplant";
    for (const s of runs) {
      for (const b of s.structure ?? (s.zone && s.duration_min ? [{ min: s.duration_min, zone: s.zone }] : [])) {
        if (b.zone === "Z1" || b.zone === "Z2") easy += b.min; else hard += b.min;
      }
    }
  }
  const easyPct = easy + hard > 0 ? Math.round((easy / (easy + hard)) * 100) : null;
  const flex = flexProgress(data.targets, acts);

  return (
    <section className="box week-sum" aria-label="Wochenbilanz">
      {runs.length === 0 && doneKm === 0 ? (
        <div className="sum-row"><span className="sum-label">Laufen</span><span className="muted">Laufpause diese Woche</span></div>
      ) : (<>
      <div className="sum-row">
        <span className="sum-label">Laufen</span>
        <span><b className="sum-num">{km(doneKm)}</b><span className="muted">{plannedKm > 0 ? ` von ${km(plannedKm)} km` : " km"}</span></span>
      </div>
      {plannedKm > 0 && (
        <div className="meter" role="img" aria-label={`${km(doneKm)} von ${km(plannedKm)} km gelaufen`}>
          <div style={{ width: `${Math.min(100, (doneKm / plannedKm) * 100)}%` }} />
        </div>
      )}

      <div className="sum-stats">
        <div><b className="sum-num">{runsDone}<span className="muted">/{runs.length}</span></b><span>Läufe erledigt</span></div>
        <div><b className="sum-num">{hardDays}</b><span>{hardDays === 1 ? "harter Tag" : "harte Tage"}</span></div>
        <div>
          <b className="sum-num">{easyPct == null ? "-" : easyPct}<span className="muted">{easyPct == null ? "" : " %"}</span></b>
          <span>locker, {source}</span>
        </div>
      </div>

      {easyPct != null && (
        <div className="split-wrap" role="img" aria-label={`${easyPct} Prozent locker, ${100 - easyPct} Prozent intensiv, Ziel 80 zu 20`}>
          <div className="split">
            <div style={{ width: `${easyPct}%`, background: "var(--z2)" }} />
            <div style={{ flex: 1, background: "var(--z4)" }} />
          </div>
          <div className="split-target" style={{ left: "80%" }} />
          <div className="split-legend"><span>Z1 bis Z2 {easyPct} %</span><span>Ziel 80/20</span><span>Z3 bis Z5 {100 - easyPct} %</span></div>
        </div>
      )}

      </>)}

      {flex.length > 0 && (
        <div className="flex-list" aria-label="Wochenziele ohne festen Tag">
          <span className="flex-head">Frei einteilen</span>
          <FlexTiles items={flex} />
        </div>
      )}
    </section>
  );
}

function Check({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Erledigt" style={{ flex: "0 0 auto", marginTop: 1 }}><path d="M5 12l5 5 9-10" /></svg>
  );
}

function Item({ s, act, past }: { s: Session; act?: Activity; past: boolean }) {
  const done = s.status === "erledigt" || !!act;
  const missed = !done && (s.status === "verpasst" || past);
  return (
    <div className="item">
      {done ? <Check color="var(--z2)" /> : <span className="swatch" style={{ background: sessionColor(s), opacity: missed ? 0.4 : 1 }} />}
      <div style={{ minWidth: 0 }}>
        <span style={{ fontWeight: s.hard ? 600 : 400, opacity: missed ? 0.6 : 1 }}>{s.title}</span>
        {act ? <small>Garmin: {activityFacts(act)}</small>
          : missed ? <small>Nicht erledigt</small>
          : s.duration_min ? <small>{s.duration_min} min{s.distance_km ? `, ca. ${km(s.distance_km)} km` : ""}{s.zone ? `, ${s.zone}` : ""}</small> : null}
      </div>
    </div>
  );
}

function ActivityItem({ a }: { a: Activity }) {
  const info = sportInfo(a.sport);
  return (
    <div className="item">
      <Check color={info.color} />
      <div style={{ minWidth: 0 }}>
        <span>{info.label}</span>
        <small>Garmin{a.name ? `: ${a.name}` : ""}{activityFacts(a) ? `, ${activityFacts(a)}` : ""}</small>
      </div>
    </div>
  );
}
