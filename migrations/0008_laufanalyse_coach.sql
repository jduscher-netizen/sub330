-- Laufanalyse: Zusatzwerte, Runden und Verlauf je Aktivität, dazu der KI-Kommentar
ALTER TABLE activities ADD COLUMN details_json TEXT;   -- Pace, Kadenz, Höhenmeter, Trainingseffekt usw.
ALTER TABLE activities ADD COLUMN laps_json TEXT;      -- Runden aus Garmin (Autolap oder Workout-Schritte)
ALTER TABLE activities ADD COLUMN stream_json TEXT;    -- Verlauf, auf etwa 400 Punkte verdichtet: t, hr, v, alt, cad
ALTER TABLE activities ADD COLUMN ai_comment TEXT;
ALTER TABLE activities ADD COLUMN ai_comment_at TEXT;

-- KI-Coach: Verlauf der Gespräche, unverändert gespeichert (inkl. Werkzeug-Aufrufe)
CREATE TABLE coach_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread INTEGER NOT NULL,
  role TEXT NOT NULL,                  -- user, assistant
  content_json TEXT NOT NULL,          -- Inhaltsblöcke genau wie von der API
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_coach_thread ON coach_messages(thread, id);
