import { useEffect, useState, type FormEvent } from "react";
import { api, isDemo, type GymData, type GymEntry, type GymLast, type Result } from "../api";
import { Loading, Problem } from "../components/ui";
import { addDays, dayOfMonth, longDate, shortWeekday, todayIso } from "../format";

const kg = (v: number | null) => (v == null ? "Körpergewicht" : `${v.toLocaleString("de-DE", { maximumFractionDigits: 2 })} kg`);
const scheme = (e: { sets: number; reps: number; weight_kg: number | null }) => `${e.sets} × ${e.reps} · ${kg(e.weight_kg)}`;
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const dayLabel = (d: string) => `${shortWeekday(d)} ${dayOfMonth(d)}.`;

interface Form { exercise: string; sets: string; reps: string; weight: string }
const EMPTY: Form = { exercise: "", sets: "3", reps: "10", weight: "" };

/** Trainingstagebuch fürs Studio: Übung, Sätze, Wiederholungen, Gewicht. */
export function Gym() {
  const [date, setDate] = useState(todayIso());
  const [res, setRes] = useState<Result<GymData> | null>(null);
  const load = (d = date) => api.gym(d).then(setRes);
  useEffect(() => { setRes(null); load(date); }, [date]);

  const today = todayIso();
  return (
    <div className="screen">
      <header className="head" style={{ alignItems: "center" }}>
        <h1 className="title-display">Gym</h1>
        <div className="week-nav">
          <button type="button" className="icon-btn" aria-label="Vorheriger Tag" onClick={() => setDate(addDays(date, -1))}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          <span style={{ fontSize: 14, fontWeight: 600, minWidth: 96, textAlign: "center" }}>{date === today ? "Heute" : dayLabel(date)}</span>
          <button type="button" className="icon-btn" aria-label="Nächster Tag" disabled={date >= today} onClick={() => setDate(addDays(date, 1))}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        </div>
      </header>
      <p className="sub" style={{ margin: "4px 0 0" }}>{longDate(date)}{isDemo && <span className="demo-flag">, Beispieldaten</span>}</p>
      {!res ? <Loading /> : !res.ok ? <Problem status={res.status} message={res.message} /> : <Diary data={res.data} reload={() => load()} goTo={setDate} />}
    </div>
  );
}

function Diary({ data, reload, goTo }: { data: GymData; reload: () => void; goTo: (d: string) => void }) {
  const [form, setForm] = useState<Form>(EMPTY);
  const [editing, setEditing] = useState<GymEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const last = data.exercises.find((x) => sameName(x.exercise, form.exercise));
  const doneToday = new Set(data.entries.map((e) => e.exercise.toLowerCase()));
  const suggestions = data.exercises.filter((x) => !doneToday.has(x.exercise.toLowerCase())).slice(0, 8);
  const totals = data.entries.reduce((a, e) => ({ sets: a.sets + e.sets, volume: a.volume + e.sets * e.reps * (e.weight_kg ?? 0) }), { sets: 0, volume: 0 });

  function pick(x: GymLast) {
    setEditing(null);
    setError(null);
    setForm({ exercise: x.exercise, sets: String(x.sets), reps: String(x.reps), weight: x.weight_kg == null ? "" : String(x.weight_kg).replace(".", ",") });
  }

  function onExercise(name: string) {
    const known = data.exercises.find((x) => sameName(x.exercise, name));
    // Bekannte Übung: letzte Werte übernehmen, solange noch nichts Eigenes eingetragen ist
    if (known && !editing && form.weight === "") pick({ ...known, exercise: name });
    else setForm({ ...form, exercise: name });
  }

  function edit(e: GymEntry) {
    setEditing(e);
    setError(null);
    setForm({ exercise: e.exercise, sets: String(e.sets), reps: String(e.reps), weight: e.weight_kg == null ? "" : String(e.weight_kg).replace(".", ",") });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reset() { setEditing(null); setForm(EMPTY); setError(null); }

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setError(null);
    const input = { date: data.date, exercise: form.exercise, sets: Number(form.sets), reps: Number(form.reps), weight_kg: form.weight === "" ? null : Number(form.weight.replace(",", ".")) };
    const r = editing ? await api.updateGym(editing.id, input) : await api.addGym(input);
    setBusy(false);
    if (!r.ok) return setError(r.message ?? "Nicht gespeichert.");
    reset();
    reload();
  }

  async function remove() {
    if (!editing) return;
    setBusy(true);
    const r = await api.deleteGym(editing.id);
    setBusy(false);
    if (!r.ok) return setError(r.message ?? "Nicht gelöscht.");
    reset();
    reload();
  }

  const diff = last && form.weight !== "" && last.weight_kg != null ? Number(form.weight.replace(",", ".")) - last.weight_kg : null;

  return (
    <>
      <form className="section gym-form" onSubmit={submit} aria-label={editing ? "Eintrag ändern" : "Übung eintragen"}>
        <h2>{editing ? "Eintrag ändern" : "Übung eintragen"}</h2>
        <label className="field">
          <span>Übung</span>
          <input id="gym-exercise" className="input" list="gym-exercises" autoComplete="off" placeholder="z. B. Kniebeuge"
            value={form.exercise} onChange={(e) => onExercise(e.target.value)} required maxLength={60} />
          <datalist id="gym-exercises">{data.exercises.map((x) => <option key={x.exercise} value={x.exercise} />)}</datalist>
        </label>
        <div className="gym-nums">
          <label className="field"><span>Sätze</span>
            <input id="gym-sets" className="input num" inputMode="numeric" pattern="[0-9]*" value={form.sets} onChange={(e) => setForm({ ...form, sets: e.target.value.replace(/\D/g, "") })} required />
          </label>
          <label className="field"><span>Wdh.</span>
            <input id="gym-reps" className="input num" inputMode="numeric" pattern="[0-9]*" value={form.reps} onChange={(e) => setForm({ ...form, reps: e.target.value.replace(/\D/g, "") })} required />
          </label>
          <label className="field"><span>Gewicht kg</span>
            <input id="gym-weight" className="input num" inputMode="decimal" placeholder="leer = ohne" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value.replace(/[^\d,.]/g, "") })} />
          </label>
        </div>
        {last && (
          <p className="gym-last">
            Letztes Mal {dayLabel(last.date)}: {scheme(last)}
            {diff != null && diff !== 0 && <b style={{ color: diff > 0 ? "var(--z2)" : "var(--text-muted)" }}> {diff > 0 ? "+" : ""}{diff.toLocaleString("de-DE")} kg</b>}
          </p>
        )}
        {error && <span role="alert" style={{ color: "var(--z5)", fontSize: 14 }}>{error}</span>}
        <div className="actions" style={{ marginTop: 0 }}>
          <button type="submit" className="btn btn-primary" disabled={busy || !form.exercise.trim()}>{editing ? "Speichern" : "Eintragen"}</button>
          {editing && <button type="button" className="btn btn-ghost" onClick={remove} disabled={busy}>Löschen</button>}
          {editing && <button type="button" className="btn btn-ghost" onClick={reset} disabled={busy}>Abbrechen</button>}
        </div>
        {!editing && suggestions.length > 0 && (
          <div className="chips" aria-label="Zuletzt gemacht">
            {suggestions.map((x) => <button type="button" key={x.exercise} className="chip" onClick={() => pick(x)}>{x.exercise}</button>)}
          </div>
        )}
      </form>

      <section className="section" aria-label="Übungen an diesem Tag">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2>{data.date === todayIso() ? "Heute" : dayLabel(data.date)}</h2>
          {data.entries.length > 0 && <span className="muted" style={{ fontSize: 13 }}>{totals.sets} Sätze · {Math.round(totals.volume).toLocaleString("de-DE")} kg bewegt</span>}
        </div>
        {data.entries.length === 0 ? (
          <p className="empty" style={{ padding: 0 }}>Noch keine Übung eingetragen. Tipp oben auf eine Übung vom letzten Mal, dann sind die Werte schon drin.</p>
        ) : (
          <div>
            {data.entries.map((e) => (
              <button type="button" key={e.id} className={`row gym-row${editing?.id === e.id ? " editing" : ""}`} onClick={() => edit(e)} aria-label={`${e.exercise}, ${scheme(e)}, ändern`}>
                <span className="grow" style={{ fontWeight: 600 }}>{e.exercise}</span>
                <span className="gym-scheme">{scheme(e)}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {data.days.length > 0 && (
        <section className="section" aria-label="Letzte Trainings">
          <h2>Letzte Trainings</h2>
          <div>
            {data.days.map((d) => (
              <button type="button" key={d.date} className="row gym-row" onClick={() => goTo(d.date)} aria-current={d.date === data.date ? "date" : undefined}>
                <span className="log-time" style={{ width: 52 }}>{dayLabel(d.date)}</span>
                <span className="grow">{d.exercises} {d.exercises === 1 ? "Übung" : "Übungen"}, {d.sets} Sätze</span>
                <span className="muted" style={{ fontSize: 13 }}>{Math.round(d.volume).toLocaleString("de-DE")} kg</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
