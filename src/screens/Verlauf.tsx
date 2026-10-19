import { useEffect, useState, type FormEvent } from "react";
import { api, isDemo, type OverviewData, type Result } from "../api";
import { Loading, Problem } from "../components/ui";
import { hms } from "../format";

export function Verlauf() {
  const [res, setRes] = useState<Result<OverviewData> | null>(null);
  const load = () => api.overview().then(setRes);
  useEffect(() => { load(); }, []);

  return (
    <div className="screen">
      <header><h1 className="title-display">Verlauf</h1></header>
      {!res ? <Loading /> : !res.ok ? <Problem status={res.status} message={res.message} /> : <Content data={res.data} reload={load} />}
    </div>
  );
}

function Content({ data, reload }: { data: OverviewData; reload: () => void }) {
  const vo2 = data.history.filter((h) => h.vo2max != null) as { date: string; vo2max: number }[];
  const latest = [...data.history].reverse();
  const pick = <K extends "resting_hr" | "hrv_last_night" | "weight_kg">(k: K) => latest.find((h) => h[k] != null)?.[k] ?? null;

  return (
    <>
      <section className="section" aria-label="Rennziele" style={{ gap: 0, paddingTop: 18 }}>
        {data.races.map((r) => (
          <div className="goal" key={r.id}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{r.name}</span>
            <span className="goal-time">{r.target_seconds ? hms(r.target_seconds) : ""}</span>
            <span className="muted" style={{ fontSize: 13 }}>{r.date_label}{r.pb_seconds ? `, Bestzeit ${hms(r.pb_seconds)}` : ""}</span>
            <span className="gap">{r.target_seconds && r.pb_seconds ? `${hms(r.pb_seconds - r.target_seconds)} schneller` : ""}</span>
          </div>
        ))}
      </section>

      <section className="section" aria-label="VO2max">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2>VO2max</h2>
          {isDemo && <span className="demo-flag">Beispielwerte</span>}
        </div>
        {vo2.length === 0 ? <p className="empty" style={{ padding: 0 }}>Erscheint nach dem ersten Garmin-Sync.</p> : <Vo2Chart points={vo2} />}
      </section>

      <section className="section" aria-label="Körperwerte">
        <div className="trio">
          <div><span>Gewicht</span><b className="val">{fmt(pick("weight_kg"), 1)}</b><span>Ziel 81,5 kg</span></div>
          <div><span>Ruhepuls</span><b className="val">{fmt(pick("resting_hr"))}</b><span>bpm</span></div>
          <div><span>HRV</span><b className="val">{fmt(pick("hrv_last_night"))}</b><span>ms, letzte Nacht</span></div>
        </div>
        <WeightInput onSaved={reload} />
      </section>
    </>
  );
}

function fmt(v: number | null, digits = 0): string {
  return v == null ? "-" : v.toFixed(digits).replace(".", ",");
}

function Vo2Chart({ points }: { points: { date: string; vo2max: number }[] }) {
  const w = 350, h = 110, pad = 14;
  const vals = points.map((p) => p.vo2max);
  const min = Math.floor(Math.min(...vals) - 1), max = Math.ceil(Math.max(...vals) + 1);
  const x = (i: number) => (points.length === 1 ? w - 30 : (i / (points.length - 1)) * (w - 30));
  const y = (v: number) => pad + (1 - (v - min) / (max - min)) * (h - 2 * pad);
  const last = points[points.length - 1];
  const first = points[0];
  const delta = last.vo2max - first.vo2max;
  return (
    <>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span className="big-num">{Math.round(last.vo2max)}</span>
        {points.length > 1 && <span style={{ fontSize: 13, color: delta >= 0 ? "var(--z2)" : "var(--z4)" }}>{delta >= 0 ? "+" : ""}{delta.toFixed(1).replace(".", ",")} seit Beginn</span>}
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label={`VO2max von ${first.vo2max} auf ${last.vo2max}`} style={{ display: "block" }}>
        {[max, (min + max) / 2, min].map((v) => <line key={v} x1="0" x2={w} y1={y(v)} y2={y(v)} stroke="var(--line)" />)}
        <text x={w} y={y(max) - 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">{max}</text>
        <text x={w} y={y(min) - 4} textAnchor="end" fontSize="11" fill="var(--text-muted)">{min}</text>
        <polyline points={points.map((p, i) => `${x(i)},${y(p.vo2max)}`).join(" ")} fill="none" stroke="var(--bib)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(points.length - 1)} cy={y(last.vo2max)} r="4.5" fill="var(--bib)" />
      </svg>
    </>
  );
}

/** Gewicht von Hand eintragen, für Waagen ohne Garmin-Anbindung */
function WeightInput({ onSaved }: { onSaved: () => void }) {
  const [kg, setKg] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await api.saveWeight(kg);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.message ?? "Nicht gespeichert." });
    setMsg({ ok: true, text: `${kg.replace(".", ",")} kg für heute gespeichert.` });
    setKg("");
    onSaved();
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 8 }} aria-label="Gewicht eintragen">
      <div style={{ display: "flex", gap: 10 }}>
        <label htmlFor="weight-kg" className="sr-only">Gewicht heute in kg</label>
        <input id="weight-kg" className="input" style={{ flex: 1 }} inputMode="decimal" placeholder="Gewicht heute, z. B. 84,6"
          value={kg} onChange={(e) => setKg(e.target.value.replace(/[^\d,.]/g, ""))} />
        <button type="submit" className="btn btn-primary" style={{ flex: "0 0 auto" }} disabled={busy || !kg}>Speichern</button>
      </div>
      {msg && <span role={msg.ok ? "status" : "alert"} style={{ fontSize: 13, color: msg.ok ? "var(--z2)" : "var(--z5)" }}>{msg.text}</span>}
    </form>
  );
}
