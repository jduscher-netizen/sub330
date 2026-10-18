interface Props {
  score: number | null;
  verdict: string;
  stripColor: string;
  raceLabel: string;
}

/** Die Startnummer: Trainingsbereitschaft des Tages. */
export function Bib({ score, verdict, stripColor, raceLabel }: Props) {
  return (
    <section className="bib" aria-label={`Trainingsbereitschaft ${score ?? "unbekannt"}`}>
      <div className="bib-strip" style={{ background: stripColor }} />
      <span className="bib-pin" style={{ top: 28, left: 16 }} aria-hidden="true" />
      <span className="bib-pin" style={{ top: 28, right: 16 }} aria-hidden="true" />
      <span className="bib-pin" style={{ bottom: 52, left: 16 }} aria-hidden="true" />
      <span className="bib-pin" style={{ bottom: 52, right: 16 }} aria-hidden="true" />
      <div className="bib-body">
        <p className="bib-label">Trainingsbereitschaft</p>
        <p className={`bib-number${score == null ? " empty" : ""}`}>{score ?? "00"}</p>
        <p className="bib-verdict">{verdict}</p>
      </div>
      <div className="bib-foot">
        <span className="bib-brand">SUB330</span>
        <span>{raceLabel}</span>
      </div>
    </section>
  );
}
