import { useEffect, useState } from "react";
import { api, isDemo, type ActivityDetail, type Analysis, type Result, type Stream, type Tone } from "../api";
import { Loading, Problem } from "../components/ui";
import { hms, longDate } from "../format";
import { activityFacts, sportInfo } from "../training";
import { ZONES } from "../zones";

const ZONE_KEYS = ["Z1", "Z2", "Z3", "Z4", "Z5"] as const;
const ZONE_LIMITS = [139, 149, 159, 171, 195]; // Obergrenzen in bpm

const paceTxt = (sec: number | null | undefined) => {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return "-";
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const num = (v: number, d = 1) => v.toLocaleString("de-DE", { maximumFractionDigits: d });

const VERDICT: Record<Analysis["verdict"], { color: string; label: string }> = {
  "erfüllt": { color: "var(--z2)", label: "Vorgabe erfüllt" },
  "teilweise": { color: "var(--z3)", label: "Teilweise erfüllt" },
  "verfehlt": { color: "var(--z5)", label: "Vorgabe verfehlt" },
  "ohne Plan": { color: "var(--text-muted)", label: "Ohne Vorgabe" },
};
const TONE: Record<Tone, { color: string; mark: string }> = {
  good: { color: "var(--z2)", mark: "✓" },
  warn: { color: "var(--z3)", mark: "!" },
  bad: { color: "var(--z5)", mark: "×" },
  info: { color: "var(--z1)", mark: "i" },
};

/** Auswertung einer Aktivität: Kennzahlen, Plan-Abgleich, Verlauf, Zonen, Splits, KI-Einschätzung */
export function ActivityScreen({ id }: { id: string }) {
  const [res, setRes] = useState<Result<ActivityDetail> | null>(null);
  useEffect(() => { setRes(null); api.activity(id).then(setRes); }, [id]);

  return (
    <div className="screen">
      <header className="head" style={{ alignItems: "center" }}>
        <button type="button" className="icon-btn" aria-label="Zurück" onClick={() => (history.length > 1 ? history.back() : (location.hash = "#/plan"))} style={{ marginLeft: -12 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        {isDemo && <span className="demo-flag">Beispieldaten</span>}
      </header>
      {!res ? <Loading /> : !res.ok ? <Problem status={res.status} message={res.message} /> : <Detail d={res.data} />}
    </div>
  );
}

function Detail({ d }: { d: ActivityDetail }) {
  const a = d.activity, an = d.analysis, det = d.details ?? {};
  const info = sportInfo(a.sport);
  const isRun = a.sport === "run";
  const dist = (a.distance_m ?? 0) / 1000;
  const v = VERDICT[an.verdict];
  const n = (k: string) => (typeof det[k] === "number" ? (det[k] as number) : null);

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span className="sub" style={{ margin: 0 }}>{info.label}, {longDate(a.start_time.slice(0, 10))}, {a.start_time.slice(11, 16)} Uhr</span>
        <h1 className="title-display" style={{ fontSize: 32 }}>{a.name ?? info.label}</h1>
      </div>

      <section className="stat-grid" aria-label="Kennzahlen">
        {dist > 0.1 && <div><b>{num(dist, 2)}</b><span>km</span></div>}
        <div><b>{a.duration_s ? hms(a.duration_s) : "-"}</b><span>Zeit</span></div>
        {isRun && <div><b>{paceTxt(an.pace_s_per_km)}</b><span>min/km</span></div>}
        <div><b>{a.avg_hr ?? "-"}</b><span>Ø bpm{a.max_hr ? `, max ${a.max_hr}` : ""}</span></div>
      </section>
      <div className="stat-small">
        {n("elev_gain") != null && <span>{Math.round(n("elev_gain")!)} hm</span>}
        {n("cadence") != null && <span>Kadenz {Math.round(n("cadence")!)}</span>}
        {n("te_aerobic") != null && <span>Trainingseffekt {num(n("te_aerobic")!)} aerob{n("te_anaerobic") != null ? `, ${num(n("te_anaerobic")!)} anaerob` : ""}</span>}
        {a.training_load != null && <span>Last {Math.round(a.training_load)}</span>}
        {n("calories") != null && <span>{Math.round(n("calories")!)} kcal</span>}
      </div>

      <section className="section ruled" aria-label="Abgleich mit dem Plan">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h2>Abgleich mit dem Plan</h2>
          <span className="verdict" style={{ color: v.color, borderColor: v.color }}>{v.label}</span>
        </div>
        {an.planned ? (
          <p className="sub" style={{ margin: 0 }}>Geplant: {an.planned.title}{an.planned.duration_min ? `, ${an.planned.duration_min} min` : ""}{an.planned.distance_km ? `, ca. ${num(an.planned.distance_km)} km` : ""}</p>
        ) : (
          <p className="sub" style={{ margin: 0 }}>{isRun ? "Für diesen Tag war kein Lauf geplant." : "Freie Einheit, zählt für das Wochenziel."}</p>
        )}
        {an.findings.length > 0 && (
          <ul className="findings">
            {an.findings.map((f, i) => (
              <li key={i}><span className="fmark" style={{ color: TONE[f.tone].color, borderColor: TONE[f.tone].color }} aria-hidden="true">{TONE[f.tone].mark}</span>{f.text}</li>
            ))}
          </ul>
        )}
      </section>

      <AiComment id={a.id} initial={d.ai_comment} enabled={d.ai_enabled} />

      {d.stream && d.stream.hr.some((x) => x != null) && (
        <section className="section" aria-label="Pulsverlauf">
          <h2>Puls</h2>
          <HrChart st={d.stream} />
        </section>
      )}
      {isRun && d.stream && d.stream.v.some((x) => x != null) && (
        <section className="section" aria-label="Pace-Verlauf">
          <h2>Pace</h2>
          <PaceChart st={d.stream} />
        </section>
      )}

      {an.zones && (
        <section className="section" aria-label="Zeit in Zonen">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <h2>Zeit in Zonen</h2>
            {an.easy_pct != null && <span className="muted" style={{ fontSize: 13 }}>{an.easy_pct} % locker</span>}
          </div>
          <div className="split" style={{ height: 12 }}>
            {an.zones.pct.map((p, i) => p > 0 && <div key={i} style={{ width: `${p}%`, background: ZONES[ZONE_KEYS[i]].color }} />)}
          </div>
          <div>
            {ZONE_KEYS.map((z, i) => (
              <div className="row zone-row" key={z}>
                <span className="swatch" style={{ background: ZONES[z].color }} />
                <span className="grow">{z} {ZONES[z].label}</span>
                <span className="muted">{Math.round(an.zones!.sec[i] / 60)} min</span>
                <span style={{ width: 44, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{an.zones!.pct[i]} %</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {an.reps.length > 0 && (
        <section className="section" aria-label="Belastungen">
          <h2>Belastungen</h2>
          <div>
            {an.reps.map((r) => (
              <div className="row split-row" key={r.n}>
                <span className="log-time" style={{ width: 28 }}>{r.n}.</span>
                <span className="grow">{paceTxt(r.pace)} /km</span>
                <span className="muted">{hms(r.dur)}, {r.dist} m</span>
                <span style={{ width: 70, textAlign: "right" }}>{r.hr ?? "-"} bpm</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {an.splits.length > 0 && <Splits splits={an.splits} />}

      {!isRun && <p className="sub">{activityFacts(a)}</p>}

      <div className="actions" style={{ marginTop: 26 }}>
        <a className="btn btn-ghost btn-block" href={`#/coach`} onClick={() => sessionStorage.setItem("coach-draft", `Was sagst du zu meiner Einheit „${a.name ?? info.label}“ vom ${a.start_time.slice(8, 10)}.${a.start_time.slice(5, 7)}.?`)}>
          Mit dem Coach besprechen
        </a>
      </div>
    </>
  );
}

function AiComment({ id, initial, enabled }: { id: string; initial: string | null; enabled: boolean }) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function make() {
    setBusy(true); setError(null);
    const r = await api.activityComment(id);
    setBusy(false);
    if (r.ok && r.text) setText(r.text); else setError(r.message ?? "Kein Kommentar erstellt.");
  }
  return (
    <section className="section" aria-label="Einschätzung vom Coach">
      <h2>Einschätzung vom Coach</h2>
      {text ? <p className="coach-text">{text}</p> : enabled ? (
        <button type="button" className="btn btn-accent-ghost" onClick={make} disabled={busy}>{busy ? "Coach schaut sich den Lauf an" : "Einschätzung erstellen"}</button>
      ) : (
        <p className="sub" style={{ margin: 0 }}>Der KI-Coach ist noch nicht eingerichtet (GitHub-Secret ANTHROPIC_API_KEY).</p>
      )}
      {text && enabled && <button type="button" className="link-btn" onClick={make} disabled={busy}>{busy ? "Wird neu erstellt" : "Neu erstellen"}</button>}
      {error && <span role="alert" style={{ color: "var(--z5)", fontSize: 14 }}>{error}</span>}
    </section>
  );
}

function Splits({ splits }: { splits: Analysis["splits"] }) {
  const min = Math.min(...splits.map((s) => s.sec)), max = Math.max(...splits.map((s) => s.sec));
  return (
    <section className="section" aria-label="Kilometer-Splits">
      <h2>Splits</h2>
      <div>
        {splits.map((s) => (
          <div className="row split-row" key={s.km}>
            <span className="log-time" style={{ width: 28 }}>{s.km}</span>
            <span style={{ width: 48, fontVariantNumeric: "tabular-nums" }}>{paceTxt(s.sec)}</span>
            <span className="grow"><span className="split-bar" style={{ width: `${max > min ? 30 + ((max - s.sec) / (max - min)) * 70 : 70}%` }} /></span>
            <span className="muted" style={{ width: 64, textAlign: "right" }}>{s.hr ?? "-"} bpm</span>
          </div>
        ))}
      </div>
    </section>
  );
}

const W = 350, H = 130, PAD_L = 30, PAD_B = 18;

function axisMinutes(tMax: number) {
  const step = tMax > 5400 ? 1800 : tMax > 2400 ? 900 : 600;
  return Array.from({ length: Math.floor(tMax / step) }, (_, i) => (i + 1) * step);
}

/** Puls über die Zeit, im Hintergrund die Zonenbänder */
function HrChart({ st }: { st: Stream }) {
  const tMax = st.t[st.t.length - 1] || 1;
  const vals = st.hr.filter((x): x is number => x != null);
  const lo = Math.max(90, Math.min(...vals) - 5), hi = Math.min(200, Math.max(...vals) + 5);
  const x = (t: number) => PAD_L + (t / tMax) * (W - PAD_L);
  const y = (h: number) => (1 - (h - lo) / (hi - lo)) * (H - PAD_B);
  const pts = st.t.map((t, i) => (st.hr[i] == null ? null : `${x(t).toFixed(1)},${y(st.hr[i]!).toFixed(1)}`)).filter(Boolean).join(" ");
  let prev = lo;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Pulsverlauf von ${Math.min(...vals)} bis ${Math.max(...vals)} bpm`} style={{ display: "block" }}>
      {ZONE_LIMITS.map((top, i) => {
        const from = Math.max(prev, lo), to = Math.min(top, hi);
        prev = top;
        if (to <= from) return null;
        return <rect key={i} x={PAD_L} width={W - PAD_L} y={y(to)} height={y(from) - y(to)} fill={ZONES[ZONE_KEYS[i]].color} opacity="0.13" />;
      })}
      {[lo + 5, (lo + hi) / 2, hi - 5].map((h) => <text key={h} x={PAD_L - 4} y={y(h) + 4} textAnchor="end" className="chart-ax">{Math.round(h)}</text>)}
      {axisMinutes(tMax).map((t) => <text key={t} x={x(t)} y={H - 4} textAnchor="middle" className="chart-ax">{Math.round(t / 60)}′</text>)}
      <polyline points={pts} fill="none" stroke="var(--z5)" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

/** Pace über die Zeit (schneller ist oben), geglättet */
function PaceChart({ st }: { st: Stream }) {
  const tMax = st.t[st.t.length - 1] || 1;
  const sm = st.v.map((_, i) => {
    const win = st.v.slice(Math.max(0, i - 2), i + 3).filter((x): x is number => x != null && x > 0.8);
    return win.length ? win.reduce((a, b) => a + b, 0) / win.length : null;
  });
  const paces = sm.filter((x): x is number => x != null).map((v) => 1000 / v);
  if (paces.length < 2) return null;
  const sorted = [...paces].sort((a, b) => a - b);
  const fast = sorted[Math.floor(sorted.length * 0.02)] - 10, slow = Math.min(sorted[Math.floor(sorted.length * 0.98)] + 15, 600);
  const x = (t: number) => PAD_L + (t / tMax) * (W - PAD_L);
  const y = (p: number) => Math.max(0, Math.min(H - PAD_B, ((p - fast) / (slow - fast)) * (H - PAD_B)));
  const pts = st.t.map((t, i) => (sm[i] == null ? null : `${x(t).toFixed(1)},${y(1000 / sm[i]!).toFixed(1)}`)).filter(Boolean);
  const area = `${x(st.t[0])},${H - PAD_B} ${pts.join(" ")} ${x(tMax)},${H - PAD_B}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Pace-Verlauf" style={{ display: "block" }}>
      {[fast + 10, (fast + slow) / 2, slow - 15].map((p) => (
        <g key={p}>
          <line x1={PAD_L} x2={W} y1={y(p)} y2={y(p)} stroke="var(--line)" />
          <text x={PAD_L - 4} y={y(p) + 4} textAnchor="end" className="chart-ax">{paceTxt(p)}</text>
        </g>
      ))}
      {axisMinutes(tMax).map((t) => <text key={t} x={x(t)} y={H - 4} textAnchor="middle" className="chart-ax">{Math.round(t / 60)}′</text>)}
      <polygon points={area} fill="var(--accent)" opacity="0.15" />
      <polyline points={pts.join(" ")} fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}
