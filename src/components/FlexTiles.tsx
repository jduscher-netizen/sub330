import { useState } from "react";
import { shortWeekday, dayOfMonth } from "../format";
import { activityFacts, activityHref, flexGoal, flexReached, type FlexProgress } from "../training";

const R = 22;
const C = 2 * Math.PI * R;

/** Ring um die Zahl: Anteil am Mindestziel (bei optionalen Zielen am Höchstwert) */
function Ring({ f }: { f: FlexProgress }) {
  const goal = f.min > 0 ? f.min : Math.max(1, f.max);
  const share = Math.min(1, f.done / goal);
  const reached = flexReached(f);
  const color = reached ? "var(--z2)" : f.color;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
      <circle cx="28" cy="28" r={R} fill="none" stroke="var(--line)" strokeWidth="5" strokeDasharray={f.min === 0 ? "3 4" : undefined} />
      {share > 0 && (
        <circle cx="28" cy="28" r={R} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={`${C * share} ${C}`} transform="rotate(-90 28 28)" />
      )}
      {reached ? (
        <path d="M19 28.5l6 6 12-13" fill="none" stroke="var(--z2)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <text x="28" y="35.5" textAnchor="middle" className="ring-num">{f.done}</text>
      )}
    </svg>
  );
}

/** Wochenziele ohne festen Tag als Kacheln; Antippen zeigt, wann was erledigt wurde. */
export function FlexTiles({ items }: { items: FlexProgress[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const sel = items.find((f) => f.key === open);
  return (
    <div className="ftiles-wrap">
      <div className="ftiles" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((f) => (
          <button
            key={f.key} type="button" className={`ftile${open === f.key ? " open" : ""}${f.max === 0 ? " off" : ""}`}
            aria-expanded={open === f.key} onClick={() => setOpen(open === f.key ? null : f.key)}
            aria-label={`${f.label}: ${f.done} erledigt, ${flexGoal(f)}${flexReached(f) ? ", Ziel erreicht" : ""}`}
          >
            <Ring f={f} />
            <span className="ftile-label">{f.label}</span>
            <span className="ftile-goal">{flexGoal(f)}</span>
          </button>
        ))}
      </div>
      {sel && (
        <div className="ftile-detail" aria-live="polite">
          {sel.acts.length === 0 ? (
            <span className="muted">{sel.label}: diese Woche noch nichts.</span>
          ) : sel.acts.map((a) => (
            <a key={a.id} className="ftile-act" href={activityHref(a.id)}>
              <span className="ftile-day">{shortWeekday(a.start_time.slice(0, 10))} {dayOfMonth(a.start_time.slice(0, 10))}.</span>
              <span className="grow">{a.name ?? sel.label}</span>
              <span className="muted">{activityFacts(a)}</span>
            </a>
          ))}
          {sel.note && <span className="ftile-note">{sel.note}</span>}
        </div>
      )}
    </div>
  );
}
