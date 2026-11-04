-- Rückzahlung: was Milena Jan außerhalb der Monatsabrechnung schuldet

-- Einzelne Posten: Schulden (geliehen, Urlaub, offene Monatsausgleiche ...) und Rückzahlungen
CREATE TABLE debt_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,                  -- YYYY-MM-DD
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  kind TEXT NOT NULL CHECK (kind IN ('debt', 'repayment')),
  category TEXT NOT NULL DEFAULT 'sonstiges', -- geliehen, urlaub, monat, sonstiges (bei Rückzahlung: rueckzahlung)
  label TEXT NOT NULL,
  settle_month TEXT UNIQUE,            -- gesetzt, wenn der Posten aus einem Monatsausgleich der Kasse stammt
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);
CREATE INDEX debt_entries_date ON debt_entries (date);

-- Mehrkosten Miete: was Jan pro Monat mehr zahlt. Milena schuldet davon share_pct Prozent.
-- Wird nicht als Buchung gespeichert, sondern aus den Monaten berechnet (am 1. jedes Monats fällig).
CREATE TABLE rent_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  extra_cents INTEGER NOT NULL CHECK (extra_cents > 0),
  share_pct INTEGER NOT NULL DEFAULT 50,
  start_month TEXT NOT NULL,
  end_month TEXT,                      -- letzter Monat, NULL = läuft weiter
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Monatsausgleich der Kasse kann auf die Rückzahlung gebucht werden statt überwiesen
ALTER TABLE settlements ADD COLUMN to_debt INTEGER NOT NULL DEFAULT 0;
