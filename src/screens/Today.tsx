import { useEffect, useState } from "react";
import { api, isDemo, type Result, type Session, type TodayData } from "../api";
import { Bib } from "../components/Bib";
import { Loading, Problem, SyncPill } from "../components/ui";
import { longDate, weeksUntil } from "../format";
import { sessionColor, shoeFor, ZONE_HEIGHT, ZONES } from "../zones";

const HM_DATE = "2027-05-23";

function verdict(score: number | null, hardToday: boolean): string {
  if (score == null) return "Noch keine Daten von Garmin.";
  if (score >= 75) return hardToday ? "Hoch. Bereit für harte Intervalle." : "Hoch. Gut erholt.";
  if (score >= 50) return hardToday ? "Mittel. Harte Einheit mit Augenmaß." : "Mittel. Plan passt.";
  if (score >= 25) return hardToday ? "Niedrig. Heute lieber locker laufen." : "Niedrig. Locker bleiben.";
  return "Sehr niedrig. Heute Ruhe einplanen.";
}

export function Today() {
  const [res, setRes] = useState<Result<TodayData> | null>(null);
  useEffect(() => { api.today().then(setRes); }, []);

  if (!res) return <div className="screen"><Loading /></div>;
  if (!res.ok) {
    return (
      <div className="screen">
        <div className="head"><div><h1>Heute</h1></div></div>
        <Problem status={res.status} message={res.message} />
      </div>
    );
  }

  const { date, metrics, sessions, sync } = res.data;
  const main = sessions.find((s) => s.type !== "rest" && !s.type.startsWith("gym")) ?? sessions[0];
  const later = sessions.filter((s) => s !== main);
  const score = metrics?.readiness_score ?? null;
  const hardToday = sessions.some((s) => s.hard === 1);
  const lowAndHard = score != null && score < 50 && main?.hard === 1;

  return (
    <div className="screen">
      <header className="head">
        <div>
          <h1>{longDate(date)}</h1>
          <p className="sub">{weeksUntil(HM_DATE)} Wochen bis Würzburg{isDemo && <span className="demo-flag">, Beispieldaten</span>}</p>
        </div>
        <SyncPill sync={sync} />
      </header>

      <Bib
        score={score}
        verdict={verdict(score, hardToday)}
        stripColor={main ? sessionColor(main) : "var(--gym)"}
        raceLabel="WVV Halbmarathon, 23.05.2027"
      />

      {metrics?.factors && metrics.factors.length > 0 && (
        <section className="section" aria-label="Faktoren">
          <h2>Was die Bereitschaft bestimmt</h2>
          {metrics.factors.map((f) => (
            <div className="factor" key={f.label}>
              <div className="factor-row"><span>{f.label}</span><span className="muted">{f.value}</span></div>
              <div className="track"><div style={{ width: `${Math.max(0, Math.min(100, f.percent))}%` }} /></div>
            </div>
          ))}
        </section>
      )}

      {lowAndHard && (
        <div className="notice" style={{ marginTop: 22 }}>
          <strong>Heute lieber tauschen?</strong>
          Deine Bereitschaft ist niedrig und für heute ist eine harte Einheit geplant. Verschieben oder locker laufen schont dich für die nächste Qualitätseinheit.
        </div>
      )}

      {main ? <MainSession s={main} /> : (
        <section className="section ruled">
          <h2>Heute nichts geplant</h2>
          <p className="empty" style={{ padding: 0 }}>Ruhetag. Wenn du trotzdem etwas machst, taucht es nach dem nächsten Garmin-Sync hier auf.</p>
        </section>
      )}

      {later.length > 0 && (
        <section className="section" aria-label="Später heute">
          <h2>Später heute</h2>
          <div>
            {later.map((s) => (
              <div className="row" key={s.id}>
                <span className="swatch" style={{ background: sessionColor(s) }} />
                <span className="grow">{s.title}</span>
                {s.duration_min && <span className="muted" style={{ fontSize: 13 }}>{s.duration_min} min</span>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MainSession({ s }: { s: Session }) {
  const total = s.structure?.reduce((a, b) => a + b.min, 0) ?? 0;
  const shoe = shoeFor(s.type);
  return (
    <section className="section ruled" aria-label="Einheit heute">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h2 className="session-title">{s.title}</h2>
        {s.distance_km != null && <span className="muted" style={{ fontSize: 14 }}>{s.distance_km} km</span>}
      </div>
      {s.notes && <p className="session-desc">{s.notes}</p>}
      {s.structure && total > 0 && (
        <div className="blocks" role="img" aria-label={`Ablauf: ${s.structure.map((b) => `${b.min} min ${b.zone}`).join(", ")}`}>
          {s.structure.map((b, i) => (
            <div key={i} style={{ flex: `${b.min} 1 0`, height: `${ZONE_HEIGHT[b.zone]}%`, background: ZONES[b.zone].color }} />
          ))}
        </div>
      )}
      <div className="facts">
        {s.zone && <div><span className="muted">Ziel in {s.zone}</span><strong>{ZONES[s.zone].bpm}</strong></div>}
        {shoe && <div><span className="muted">Schuh</span><strong>{shoe}</strong></div>}
      </div>
      <div className="actions">
        <button type="button" className="btn btn-primary" disabled title="Kommt mit dem Garmin-Sync">Auf die Uhr senden</button>
        <a className="btn btn-ghost" href={`${location.search}#/plan`}>Verschieben</a>
      </div>
    </section>
  );
}
