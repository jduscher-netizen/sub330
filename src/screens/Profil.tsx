import { useEffect, useState } from "react";
import { api, type OverviewData, type Result, type SyncState, type Zone } from "../api";
import { Loading, Problem } from "../components/ui";
import { ago } from "../format";
import { ZONES } from "../zones";

export function Profil() {
  const [res, setRes] = useState<Result<OverviewData> | null>(null);
  useEffect(() => { api.overview().then(setRes); }, []);

  return (
    <div className="screen">
      <header><h1 className="title-display">Profil</h1></header>

      <section className="section" aria-label="Datenquellen">
        <h2>Datenquellen</h2>
        {!res ? <Loading /> : !res.ok ? <Problem status={res.status} message={res.message} /> : (
          <div>
            <Source name="Garmin" s={res.data.sync.find((x) => x.source === "garmin")} />
          </div>
        )}
        <p className="sub" style={{ margin: 0 }}>Garmin verbinden folgt im nächsten Schritt: einmal anmelden, Code eintippen, danach läuft der Sync stündlich.</p>
      </section>

      <section className="section" aria-label="Herzfrequenzzonen">
        <h2>Herzfrequenzzonen</h2>
        <p className="sub" style={{ margin: 0 }}>Laktatschwelle 170 bpm, HFmax 195 bpm</p>
        <div>
          {(Object.keys(ZONES) as Zone[]).map((z) => (
            <div className="row" key={z}>
              <span className="swatch" style={{ background: ZONES[z].color }} />
              <span className="grow">{z} {ZONES[z].label}</span>
              <span className="muted" style={{ fontSize: 13 }}>{ZONES[z].bpm.replace("172 bis 185 bpm", "ab 172 bpm")}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Source({ name, s }: { name: string; s?: SyncState }) {
  const color = !s ? "var(--text-faint)" : s.last_ok_flag === 1 ? "var(--z2)" : "var(--z5)";
  const text = !s ? "nicht verbunden" : s.last_ok_flag === 1 ? `synchronisiert ${ago(s.last_ok)}` : `Fehler: ${s.last_message ?? "unbekannt"}`;
  return (
    <div className="row">
      <span className="dot" style={{ background: color }} />
      <span className="grow">{name}</span>
      <span className="muted" style={{ fontSize: 13 }}>{text}</span>
    </div>
  );
}
