import { useEffect, useState, type FormEvent } from "react";
import { api, isDemo, type GarminStatus, type OverviewData, type Result, type SyncLogEntry, type SyncState, type Zone } from "../api";
import { Loading, Problem } from "../components/ui";
import { ago, dateTime } from "../format";
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
      </section>

      {res?.ok && <Garmin />}

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

      {res?.ok && !isDemo && (
        <div style={{ paddingTop: 30 }}>
          <button type="button" className="btn btn-ghost btn-block" onClick={() => api.logout().then(() => location.reload())}>Abmelden</button>
        </div>
      )}
    </div>
  );
}

function Source({ name, s }: { name: string; s?: SyncState }) {
  const color = !s ? "var(--text-faint)" : s.last_ok_flag === 1 ? "var(--z2)" : "var(--z5)";
  const text = !s ? "nicht verbunden"
    : s.last_ok_flag === 1 ? `synchronisiert ${ago(s.last_ok)}`
    : s.last_message?.startsWith("Garmin neu verbinden") ? "neu verbinden"
    : "Fehler, siehe Protokoll";
  return (
    <div className="row">
      <span className="dot" style={{ background: color }} />
      <span className="grow">{name}</span>
      <span className="muted" style={{ fontSize: 13 }}>{text}</span>
    </div>
  );
}

const LOGIN_WORKFLOW = "https://github.com/jduscher-netizen/sub330/actions/workflows/garmin-login.yml";
const POLL_MS = 4000;
const POLL_MAX = 40; // gut zweieinhalb Minuten

/** Garmin verbinden (Zwei-Faktor-Code) und Sync-Protokoll */
function Garmin() {
  const [status, setStatus] = useState<GarminStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => api.garmin().then((r) => { if (r.ok) setStatus(r.data); return r; });
  useEffect(() => { load(); }, []);

  // Nach dem Absenden des Codes auf das Ergebnis des Workflows warten.
  useEffect(() => {
    if (!sent) return;
    let n = 0;
    const timer = setInterval(async () => {
      n += 1;
      const r = await load();
      if ((r.ok && r.data.login?.finished_at) || n >= POLL_MAX) {
        clearInterval(timer);
        setSent(false);
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [sent]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await api.sendMfaCode(code);
    setBusy(false);
    if (!r.ok) return setError(r.message ?? "Code nicht gespeichert.");
    setCode("");
    setSent(true);
  }

  if (!status) return null;
  const login = status.login;
  const running = !!login && !login.finished_at && Date.now() - parseUtc(login.started_at) < 10 * 60_000;
  const lastSync = status.log[0];
  const needsLogin = !status.connected || (lastSync?.ok === 0 && lastSync.message?.startsWith("Garmin neu verbinden"));
  const showForm = needsLogin || running || open || sent;

  return (
    <>
      <section className="section" aria-label="Garmin verbinden">
        <h2>Garmin verbinden</h2>
        {status.connected && !needsLogin && (
          <p className="sub" style={{ margin: 0 }}>Verbunden. Der Sync läuft stündlich von 6 bis 22 Uhr, Anmeldung zuletzt erneuert {ago(status.tokens_updated_at)}</p>
        )}
        {needsLogin && (
          <div className="notice">
            <strong>{status.connected ? "Garmin neu verbinden" : "Noch nicht verbunden"}</strong>
            {status.connected ? "Die gespeicherte Anmeldung gilt nicht mehr. Einmal neu anmelden, dann läuft der Sync wieder." : "Einmal anmelden, danach läuft der Sync stündlich ohne Passwort und Code."}
          </div>
        )}
        {showForm ? (
          <>
            <ol className="steps">
              <li>In GitHub den Workflow Garmin-Login starten (Run workflow).</li>
              <li>Garmin schickt dir einen Code. Tipp ihn innerhalb von 5 Minuten hier ein.</li>
            </ol>
            <a className="btn btn-ghost" href={LOGIN_WORKFLOW} target="_blank" rel="noreferrer">Workflow in GitHub öffnen</a>
            <form onSubmit={submit} style={{ display: "flex", gap: 10 }}>
              <label htmlFor="mfa" className="sr-only">Code von Garmin</label>
              <input
                id="mfa" className="input code-input" inputMode="numeric" autoComplete="one-time-code" placeholder="Code"
                maxLength={8} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
              <button type="submit" className="btn btn-primary" style={{ flex: "0 0 auto" }} disabled={busy || code.length < 4}>
                {busy ? "Sende" : "Code senden"}
              </button>
            </form>
            {error && <span role="alert" style={{ color: "var(--z5)", fontSize: 14 }}>{error}</span>}
            <LoginState login={login} running={running} waiting={sent} />
          </>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)}>Neu verbinden</button>
        )}
      </section>

      <section className="section" aria-label="Sync-Protokoll">
        <h2>Sync-Protokoll</h2>
        {status.log.length === 0 ? (
          <p className="empty" style={{ padding: 0 }}>Noch kein Sync gelaufen.</p>
        ) : (
          <div>{status.log.map((l, i) => <LogRow key={l.id ?? i} l={l} />)}</div>
        )}
      </section>
    </>
  );
}

function LoginState({ login, running, waiting }: { login: SyncLogEntry | null; running: boolean; waiting: boolean }) {
  if (waiting && !login?.finished_at) {
    return <p className="sub" style={{ margin: 0 }} aria-live="polite">Code gespeichert. Die Anmeldung läuft, das dauert bis zu einer Minute.</p>;
  }
  if (!login) return null;
  if (running) return <p className="sub" style={{ margin: 0 }} aria-live="polite">Anmeldung läuft: {login.message ?? "startet"}</p>;
  const color = login.ok === 1 ? "var(--z2)" : "var(--z5)";
  return (
    <p className="sub" style={{ margin: 0, display: "flex", gap: 8, alignItems: "baseline" }} aria-live="polite">
      <span className="dot" style={{ background: color }} />
      Letzte Anmeldung {dateTime(login.finished_at ?? login.started_at)}: {login.message ?? (login.ok ? "erfolgreich" : "abgebrochen")}
    </p>
  );
}

function LogRow({ l }: { l: SyncLogEntry }) {
  const color = !l.finished_at ? "var(--text-faint)" : l.ok === 1 ? "var(--z2)" : "var(--z5)";
  return (
    <div className="row log-row">
      <span className="dot" style={{ background: color }} />
      <span className="log-time">{dateTime(l.started_at)}</span>
      <span className="grow" style={{ overflowWrap: "anywhere" }}>{l.finished_at ? l.message ?? "" : "läuft"}</span>
    </div>
  );
}

function parseUtc(s: string): number {
  return Date.parse(s.includes("T") || s.endsWith("Z") ? s : s.replace(" ", "T") + "Z");
}
