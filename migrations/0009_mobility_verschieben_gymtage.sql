-- Läufe verschieben: ursprüngliches Datum merken
ALTER TABLE planned_sessions ADD COLUMN moved_from TEXT;

-- Freie Einheiten ohne Garmin-Aufzeichnung (Mobility), von Hand abgehakt
CREATE TABLE manual_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  category TEXT NOT NULL,              -- mobility
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_manual_date ON manual_sessions(date);

-- Mobility 2x pro Woche als Wochenziel, ab der laufenden Woche bis zum Rennen
INSERT OR IGNORE INTO week_targets (week_start, category, target_min, target_max, note)
SELECT DISTINCT week_start, 'mobility', 2, 2, 'Von Hand abhaken, Garmin zeichnet das nicht auf' FROM week_targets;

-- Gym-Tage Push, Pull, Legs mit fester Übungsreihenfolge
ALTER TABLE gym_entries ADD COLUMN day_type TEXT;   -- push, pull, legs
CREATE TABLE gym_templates (
  day_type TEXT NOT NULL,
  exercise TEXT NOT NULL,
  ord INTEGER NOT NULL,
  PRIMARY KEY (day_type, exercise)
);
