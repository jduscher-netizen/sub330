-- Trainingstagebuch fürs Studio: eine Zeile pro Übung und Tag
CREATE TABLE gym_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,                  -- YYYY-MM-DD
  exercise TEXT NOT NULL,
  sets INTEGER NOT NULL,
  reps INTEGER NOT NULL,
  weight_kg REAL,                      -- leer bei Übungen mit Körpergewicht
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_gym_date ON gym_entries(date);
CREATE INDEX idx_gym_exercise ON gym_entries(exercise COLLATE NOCASE, date);
