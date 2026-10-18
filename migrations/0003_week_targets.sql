-- Wochenziele für alles außer Laufen: Jan entscheidet täglich, die App zählt mit.
CREATE TABLE week_targets (
  week_start TEXT NOT NULL,            -- Montag, YYYY-MM-DD
  category TEXT NOT NULL,              -- gym, swim, padel, bike
  target_min INTEGER NOT NULL,
  target_max INTEGER NOT NULL,
  note TEXT,
  PRIMARY KEY (week_start, category)
);
