-- Tageswerte aus Garmin (eine Zeile pro Tag)
CREATE TABLE daily_metrics (
  date TEXT PRIMARY KEY,               -- YYYY-MM-DD, Ortszeit
  readiness_score INTEGER,             -- 0 bis 100
  readiness_level TEXT,                -- z. B. HIGH, MODERATE, LOW
  readiness_feedback TEXT,             -- Garmin-Kurztext
  sleep_score INTEGER,
  sleep_seconds INTEGER,
  recovery_hours REAL,
  hrv_last_night INTEGER,
  hrv_status TEXT,
  acute_load INTEGER,
  acute_load_status TEXT,
  stress_avg INTEGER,
  body_battery_high INTEGER,
  body_battery_low INTEGER,
  resting_hr INTEGER,
  vo2max REAL,
  weight_kg REAL,
  factors_json TEXT,                   -- Faktoren der Trainingsbereitschaft als JSON
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Absolvierte Aktivitäten (Garmin, optional Strava)
CREATE TABLE activities (
  id TEXT PRIMARY KEY,                 -- "<quelle>:<externe id>"
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  sport TEXT NOT NULL,                 -- run, bike, swim, strength, padel, other
  name TEXT,
  start_time TEXT NOT NULL,            -- ISO, Ortszeit
  duration_s INTEGER,
  distance_m REAL,
  avg_hr INTEGER,
  max_hr INTEGER,
  zone_seconds_json TEXT,              -- [z1, z2, z3, z4, z5] in Sekunden
  training_load REAL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_activities_start ON activities(start_time);

-- Geplante Einheiten
CREATE TABLE planned_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0,
  type TEXT NOT NULL,                  -- intervals, threshold, long, easy, bike, swim, gym_legs, gym_upper, gym_full, padel, rest
  title TEXT NOT NULL,
  zone TEXT,                           -- Z1 bis Z5
  duration_min INTEGER,
  distance_km REAL,
  hard INTEGER NOT NULL DEFAULT 0,
  priority INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'geplant', -- geplant, erledigt, verpasst, verschoben
  activity_id TEXT REFERENCES activities(id),
  structure_json TEXT,                 -- Ablauf als Blöcke [{min, zone}]
  notes TEXT
);
CREATE INDEX idx_planned_date ON planned_sessions(date);

-- Rennen und Ziele
CREATE TABLE races (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  date TEXT,
  date_label TEXT,
  distance_km REAL NOT NULL,
  target_seconds INTEGER,
  pb_seconds INTEGER
);

-- Protokoll jeder Synchronisation
CREATE TABLE sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,                -- garmin, strava
  started_at TEXT NOT NULL,
  finished_at TEXT,
  ok INTEGER NOT NULL DEFAULT 0,
  message TEXT
);
CREATE INDEX idx_sync_source ON sync_log(source, started_at);

-- Garmin-Anmeldung (Tokens) und kurzlebige Zwei-Faktor-Codes
CREATE TABLE garmin_auth (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  tokens_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE garmin_mfa (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  used INTEGER NOT NULL DEFAULT 0
);

INSERT INTO races (name, date, date_label, distance_km, target_seconds, pb_seconds) VALUES
  ('WVV Halbmarathon', '2027-05-23', '23. Mai 2027', 21.0975, 5879, 6282),
  ('Herbstmarathon', NULL, 'Oktober 2027', 42.195, 12599, 14349);
