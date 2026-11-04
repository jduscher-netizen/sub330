-- Haushaltskasse Jan und Milena: gemeinsame Ausgaben, 50/50 pro Monat

-- Buchungen: Ausgaben (kind = expense) und Ausgleichszahlungen (kind = payment, payer = wer überwiesen hat)
CREATE TABLE entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,                  -- YYYY-MM-DD
  month TEXT NOT NULL,                 -- YYYY-MM, aus date
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  label TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'sonstiges',
  payer TEXT NOT NULL CHECK (payer IN ('J', 'M')),
  kind TEXT NOT NULL DEFAULT 'expense' CHECK (kind IN ('expense', 'payment')),
  recurring_id INTEGER,                -- gesetzt bei monatlich wiederkehrenden Ausgaben
  created_by TEXT,                     -- J oder M
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  deleted_at TEXT                      -- gelöscht (bleibt stehen, damit Wiederholungen nicht zurückkommen)
);
CREATE INDEX entries_month ON entries (month);
CREATE UNIQUE INDEX entries_recurring_month ON entries (recurring_id, month) WHERE recurring_id IS NOT NULL;

-- Monatlich wiederkehrende Ausgaben (z. B. Netflix). Werden beim Abruf für jeden Monat angelegt.
CREATE TABLE recurring (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  category TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  payer TEXT NOT NULL CHECK (payer IN ('J', 'M')),
  day INTEGER NOT NULL DEFAULT 1,      -- Tag im Monat (höchstens 28)
  start_month TEXT NOT NULL,
  end_month TEXT,                      -- letzter Monat, NULL = läuft weiter
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Abgeschlossene Monate
CREATE TABLE settlements (
  month TEXT PRIMARY KEY,
  balance_cents INTEGER NOT NULL,      -- > 0: Milena an Jan, < 0: Jan an Milena
  total_j INTEGER NOT NULL,
  total_m INTEGER NOT NULL,
  settled_by TEXT,
  settled_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Fehlversuche beim Login
CREATE TABLE login_attempts (
  ip TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
