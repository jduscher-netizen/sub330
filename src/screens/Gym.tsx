import { useEffect, useState } from "react";
import { api, isDemo, type DayType, type GymData, type GymEntry, type GymLast, type Result } from "../api";
import { Loading, Problem } from "../components/ui";
import { addDays, dayOfMonth, longDate, shortWeekday, todayIso } from "../format";

const TYPES: { key: DayType; label: string; hint: string }[] = [
  { key: "push", label: "Push", hint: "Brust, Schulter, Trizeps" },
  { key: "pull", label: "Pull", hint: "Rücken, Bizeps" },
  { key: "legs", label: "Legs", hint: "Beine, Gesäß" },
];
const LABEL: Record<DayType, string> = { push: "Push Day", pull: "Pull Day", legs: "Leg Day" };

const kgTxt = (v: number | null) => (v == null ? "Körpergewicht" : `${v.toLocaleString("de-DE", { maximumFractionDigits: 2 })} kg`);
const scheme = (e: { sets: number; reps: number; weight_kg: number | null }) => `${e.sets} × ${e.reps} · ${kgTxt(e.weight_kg)}`;
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const dayLabel = (d: string) => `${shortWeekday(d)} ${dayOfMonth(d)}.`;
const kgIn = (v: number | null) => (v == null ? "" : String(v).replace(".", ","));
const kgOut = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

/** Nächster Tag in der Rotation: der am längsten nicht trainierte, bei Gleichstand Push, Pull, Legs */
function nextType(last: Record<DayType, string | null>): DayType {
  return [...TYPES].sort((a, b) => (last[a.key] ?? "").localeCompare(last[b.key] ?? ""))[0].key;
}

/** Gym-Tagebuch nach Trainingstagen: Übungen in fester Reihenfolge, letzte Werte vorausgefüllt */
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
          <span style={{ fontSize: 14, fontWeight: 600, minWidth: 80, textAlign: "center" }}>{date === today ? "Heute" : dayLabel(date)}</span>
          <button type="button" className="icon-btn" aria-label="Nächster Tag" disabled={date >= today} onClick={() => setDate(addDays(date, 1))}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        </div>
      </header>
      <p className="sub" style={{ margin: "4px 0 0" }}>{longDate(date)}{isDemo && <span className="demo-flag">, Beispieldaten</span>}</p>
      {!res ? <Loading /> : !res.ok ? <Problem status={res.status} message={res.message} />
        : res.data.date !== date ? <Loading /> : <Day key={date} data={res.data} reload={() => load()} goTo={setDate} />}
    </div>
  );
}

function Day({ data, reload, goTo }: { data: GymData; reload: () => void; goTo: (d: string) => void }) {
  const logged = data.entries.find((e) => e.day_type)?.day_type ?? null;
  const [type, setType] = useState<DayType | null>(logged);
  const suggested = nextType(data.last_by_type);

  return (
    <>
      {!type ? (
        <section className="section" aria-label="Trainingstag wählen">
          <h2>Welcher Tag ist heute dran?</h2>
          <div className="daytype-list">
            {TYPES.map((t) => (
              <button type="button" key={t.key} className={`daytype${t.key === suggested ? " next" : ""}`} onClick={() => setType(t.key)}>
                <span className="daytype-name">{t.label}</span>
                <span className="grow">
                  <span className="daytype-hint">{t.hint}</span>
                  <small>{data.last_by_type[t.key] ? `zuletzt ${dayLabel(data.last_by_type[t.key]!)}` : "noch nie eingetragen"} · {data.templates[t.key].length} Übungen</small>
                </span>
                {t.key === suggested && <span className="daytype-tag">dran</span>}
              </button>
            ))}
          </div>
          {data.entries.length > 0 && <FreeEntries entries={data.entries} />}
        </section>
      ) : (
        <Workout type={type} data={data} reload={reload} onChangeType={logged ? null : () => setType(null)} />
      )}
      <History data={data} goTo={goTo} />
    </>
  );
}

/** Ältere Einträge ohne Gym-Tag (vor Push/Pull/Legs) */
function FreeEntries({ entries }: { entries: GymEntry[] }) {
  return (
    <div>
      {entries.map((e) => (
        <div className="row" key={e.id}><span className="grow">{e.exercise}</span><span className="gym-scheme">{scheme(e)}</span></div>
      ))}
    </div>
  );
}

function Workout({ type, data, reload, onChangeType }: { type: DayType; data: GymData; reload: () => void; onChangeType: (() => void) | null }) {
  const template = data.templates[type];
  const extra = data.entries.filter((e) => !template.some((t) => same(t, e.exercise))).map((e) => e.exercise);
  const list = [...template, ...extra.filter((x, i) => extra.findIndex((y) => same(x, y)) === i)];
  const doneOf = (ex: string) => data.entries.find((e) => same(e.exercise, ex));
  const lastOf = (ex: string) => data.exercises.find((x) => same(x.exercise, ex));
  const firstOpen = list.find((ex) => !doneOf(ex)) ?? null;
  const [open, setOpen] = useState<string | null>(firstOpen);
  const [editing, setEditing] = useState(false);
  const doneCount = list.filter((ex) => doneOf(ex)).length;
  const volume = data.entries.reduce((a, e) => a + e.sets * e.reps * (e.weight_kg ?? 0), 0);

  function saved(ex: string) {
    const next = list.slice(list.indexOf(ex) + 1).find((x) => !doneOf(x)) ?? null;
    setOpen(next);
    reload();
  }

  if (editing) return <TemplateEditor type={type} list={template} onDone={() => { setEditing(false); reload(); }} />;

  return (
    <section className="section" aria-label={LABEL[type]}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h2 className="workout-title">{LABEL[type]}</h2>
        <span className="muted" style={{ fontSize: 13 }}>{doneCount} von {list.length} erledigt{volume > 0 ? ` · ${Math.round(volume).toLocaleString("de-DE")} kg` : ""}</span>
      </div>
      {list.length === 0 ? (
        <p className="empty" style={{ padding: 0 }}>Noch keine Übungen für den {LABEL[type]}. Trag unten deine erste Übung ein, sie wird mit Reihenfolge gemerkt.</p>
      ) : (
        <ol className="workout">
          {list.map((ex, i) => (
            <ExerciseRow key={ex} n={i + 1} name={ex} type={type} date={data.date} last={lastOf(ex)} done={doneOf(ex)}
              open={open === ex} onToggle={() => setOpen(open === ex ? null : ex)} onSaved={() => saved(ex)} reload={reload} />
          ))}
        </ol>
      )}
      <AddExercise type={type} date={data.date} known={data.exercises} existing={list} onAdded={reload} />
      <div className="workout-tools">
        {template.length > 0 && <button type="button" className="link-btn" onClick={() => setEditing(true)}>Reihenfolge und Übungen bearbeiten</button>}
        {onChangeType && <button type="button" className="link-btn" onClick={onChangeType}>Anderen Tag wählen</button>}
      </div>
    </section>
  );
}

function ExerciseRow({ n, name, type, date, last, done, open, onToggle, onSaved, reload }: {
  n: number; name: string; type: DayType; date: string; last?: GymLast; done?: GymEntry; open: boolean;
  onToggle: () => void; onSaved: () => void; reload: () => void;
}) {
  const base = done ?? last;
  const [sets, setSets] = useState(String(base?.sets ?? 3));
  const [reps, setReps] = useState(String(base?.reps ?? 10));
  const [kg, setKg] = useState(kgIn(base?.weight_kg ?? null));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const kgNum = kgOut(kg);
  const diff = last && last.weight_kg != null && kgNum != null ? kgNum - last.weight_kg : null;

  async function save() {
    setBusy(true); setError(null);
    const input = { date, exercise: name, sets: Number(sets), reps: Number(reps), weight_kg: kgNum, day_type: type };
    const r = done ? await api.updateGym(done.id, input) : await api.addGym(input);
    setBusy(false);
    if (r.ok) onSaved(); else setError(r.message ?? "Nicht gespeichert.");
  }
  async function remove() {
    if (!done) return;
    setBusy(true);
    const r = await api.deleteGym(done.id);
    setBusy(false);
    if (r.ok) reload(); else setError(r.message ?? "Nicht gelöscht.");
  }
  const step = (d: number) => setKg(kgIn(Math.max(0, Math.round(((kgNum ?? 0) + d) * 4) / 4)));

  return (
    <li className={`exercise${done ? " done" : ""}${open ? " open" : ""}`}>
      <button type="button" className="exercise-head" onClick={onToggle} aria-expanded={open}>
        <span className={`exercise-n${done ? " ok" : ""}`} aria-hidden="true">{done ? "✓" : n}</span>
        <span className="grow" style={{ minWidth: 0 }}>
          <span className="exercise-name">{name}</span>
          <small>{done ? `heute ${scheme(done)}` : last ? `zuletzt ${scheme(last)} (${dayLabel(last.date)})` : "noch kein Eintrag"}</small>
        </span>
      </button>
      {open && (
        <div className="exercise-body">
          <div className="gym-nums">
            <label className="field"><span>Sätze</span>
              <input id={`sets-${n}`} className="input num" inputMode="numeric" pattern="[0-9]*" value={sets} onChange={(e) => setSets(e.target.value.replace(/\D/g, ""))} />
            </label>
            <label className="field"><span>Wdh.</span>
              <input id={`reps-${n}`} className="input num" inputMode="numeric" pattern="[0-9]*" value={reps} onChange={(e) => setReps(e.target.value.replace(/\D/g, ""))} />
            </label>
            <label className="field"><span>kg</span>
              <input id={`kg-${n}`} className="input num" inputMode="decimal" placeholder="ohne" value={kg} onChange={(e) => setKg(e.target.value.replace(/[^\d,.]/g, ""))} />
            </label>
          </div>
          <div className="kg-steps">
            <button type="button" className="chip" onClick={() => step(-2.5)}>−2,5 kg</button>
            <button type="button" className="chip" onClick={() => step(2.5)}>+2,5 kg</button>
            {diff != null && diff !== 0 && <span style={{ fontSize: 13, color: diff > 0 ? "var(--z2)" : "var(--text-muted)" }}>{diff > 0 ? "+" : ""}{diff.toLocaleString("de-DE")} kg zum letzten Mal</span>}
          </div>
          {error && <span role="alert" style={{ color: "var(--z5)", fontSize: 14 }}>{error}</span>}
          <div className="actions" style={{ marginTop: 0 }}>
            <button type="button" className="btn btn-primary" onClick={save} disabled={busy || !sets || !reps}>{busy ? "Speichert" : done ? "Ändern" : "Erledigt"}</button>
            {done && <button type="button" className="btn btn-ghost" onClick={remove} disabled={busy}>Löschen</button>}
          </div>
        </div>
      )}
    </li>
  );
}

function AddExercise({ type, date, known, existing, onAdded }: { type: DayType; date: string; known: GymLast[]; existing: string[]; onAdded: () => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const options = known.filter((k) => !existing.some((e) => same(e, k.exercise)));

  async function add() {
    const ex = name.trim();
    if (!ex) return;
    if (existing.some((e) => same(e, ex))) { setError("Die Übung steht schon in der Liste."); return; }
    setBusy(true); setError(null);
    const r = await api.saveTemplate(type, [...existing, ex]);
    setBusy(false);
    if (r.ok) { setName(""); onAdded(); } else setError(r.message ?? "Nicht gespeichert.");
  }

  return (
    <div className="add-exercise">
      <label htmlFor={`add-${type}-${date}`} className="sr-only">Übung hinzufügen</label>
      <input id={`add-${type}-${date}`} className="input" list={`known-${type}`} placeholder="Übung hinzufügen" value={name} maxLength={60}
        onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
      <datalist id={`known-${type}`}>{options.map((k) => <option key={k.exercise} value={k.exercise} />)}</datalist>
      <button type="button" className="btn btn-ghost" style={{ flex: "0 0 auto" }} onClick={add} disabled={busy || !name.trim()}>Hinzufügen</button>
      {error && <span role="alert" style={{ color: "var(--z5)", fontSize: 13, flexBasis: "100%" }}>{error}</span>}
    </div>
  );
}

function TemplateEditor({ type, list, onDone }: { type: DayType; list: string[]; onDone: () => void }) {
  const [items, setItems] = useState(list);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
  };
  async function save() {
    setBusy(true); setError(null);
    const r = await api.saveTemplate(type, items);
    setBusy(false);
    if (r.ok) onDone(); else setError(r.message ?? "Nicht gespeichert.");
  }
  return (
    <section className="section" aria-label={`${LABEL[type]} bearbeiten`}>
      <h2 className="workout-title">{LABEL[type]} bearbeiten</h2>
      <p className="sub" style={{ margin: 0 }}>Reihenfolge so, wie du im Studio durchgehst. Entfernte Übungen bleiben im Tagebuch erhalten.</p>
      <div>
        {items.map((ex, i) => (
          <div className="row" key={ex}>
            <span className="log-time" style={{ width: 22 }}>{i + 1}</span>
            <span className="grow">{ex}</span>
            <button type="button" className="icon-btn" aria-label={`${ex} nach oben`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
            <button type="button" className="icon-btn" aria-label={`${ex} nach unten`} disabled={i === items.length - 1} onClick={() => move(i, 1)}>↓</button>
            <button type="button" className="icon-btn" aria-label={`${ex} entfernen`} onClick={() => setItems(items.filter((x) => x !== ex))}>✕</button>
          </div>
        ))}
      </div>
      {error && <span role="alert" style={{ color: "var(--z5)", fontSize: 14 }}>{error}</span>}
      <div className="actions" style={{ marginTop: 0 }}>
        <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>Speichern</button>
        <button type="button" className="btn btn-ghost" onClick={onDone} disabled={busy}>Abbrechen</button>
      </div>
    </section>
  );
}

function History({ data, goTo }: { data: GymData; goTo: (d: string) => void }) {
  if (data.days.length === 0) return null;
  return (
    <section className="section" aria-label="Letzte Trainings">
      <h2>Letzte Trainings</h2>
      <div>
        {data.days.map((d) => (
          <button type="button" key={d.date} className="row gym-row" onClick={() => goTo(d.date)} aria-current={d.date === data.date ? "date" : undefined}>
            <span className="log-time" style={{ width: 52 }}>{dayLabel(d.date)}</span>
            <span className="grow">{d.day_type ? TYPES.find((t) => t.key === d.day_type)?.label : "Gym"}, {d.exercises} {d.exercises === 1 ? "Übung" : "Übungen"}</span>
            <span className="muted" style={{ fontSize: 13 }}>{Math.round(d.volume).toLocaleString("de-DE")} kg</span>
          </button>
        ))}
      </div>
    </section>
  );
}
