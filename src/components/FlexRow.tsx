import { targetText, type FlexProgress } from "../training";

/** Wochenziel als Punkte: gefüllt = erledigt, Rand = Ziel, gestrichelt = optional */
export function FlexRow({ f }: { f: FlexProgress }) {
  const slots = Math.max(f.max, f.done);
  const reached = f.max > 0 && f.done > 0 && f.done >= f.min;
  return (
    <div className="flex-row" title={f.note ?? undefined}>
      <span className="swatch" style={{ background: f.color }} />
      <span className="flex-label">{f.label}</span>
      <span className="flex-dots" role="img" aria-label={`${f.done} erledigt, Ziel ${targetText(f.min, f.max)}`}>
        {Array.from({ length: slots }, (_, i) => (
          <span key={i} className={`fdot${i < f.done ? " on" : ""}${i >= f.min ? " opt" : ""}`} style={i < f.done ? { background: f.color, borderColor: f.color } : undefined} />
        ))}
      </span>
      <span className={`flex-count${reached ? " reached" : ""}`}>{f.done} <span className="muted">· {targetText(f.min, f.max)}</span></span>
    </div>
  );
}
