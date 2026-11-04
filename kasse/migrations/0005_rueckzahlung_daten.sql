-- Übernahme aus Jans Notizen (Stand Februar bis Juli 2026). Genaue Tage unbekannt, deshalb Monatsende.

-- Miete Bibrastraße 3: Mehrkosten Jan, Milena trägt die Hälfte
INSERT INTO rent_rules (extra_cents, share_pct, start_month, end_month) VALUES
  (38000, 50, '2024-04', '2025-07'),   -- 16 × 380 €
  (43000, 50, '2025-08', '2026-02'),   --  7 × 430 €
  (46500, 50, '2026-03', NULL);        -- ab 01.03.2026 465 €

-- Rote Liste "Gesamtschulden"
INSERT INTO debt_entries (date, amount_cents, kind, category, label, created_by) VALUES
  ('2025-10-31', 112300, 'debt', 'sonstiges', 'Ältere Schulden (Übertrag)', 'J'),
  ('2025-10-31',  20200, 'debt', 'urlaub', 'Urlaub', 'J'),
  ('2025-10-31',  30000, 'debt', 'geliehen', 'Geliehen', 'J'),
  ('2025-10-31',   2700, 'debt', 'sonstiges', 'Gemeinsames Konto Berlin', 'J'),
  ('2025-11-30',  29900, 'debt', 'monat', 'November 2025', 'J'),
  ('2025-12-31',  12000, 'debt', 'monat', 'Dezember 2025', 'J'),
  ('2026-01-31',  51400, 'debt', 'monat', 'Januar 2026', 'J'),
  ('2026-02-28',  65200, 'debt', 'monat', 'Februar 2026', 'J'),
  ('2026-03-31',  35800, 'debt', 'monat', 'März 2026', 'J'),
  ('2026-04-30',  50600, 'debt', 'monat', 'April 2026', 'J'),
  ('2026-05-31',  25900, 'debt', 'monat', 'Mai 2026', 'J'),
  ('2026-06-30',  16400, 'debt', 'monat', 'Juni 2026', 'J'),
  ('2026-06-30',  10500, 'repayment', 'rueckzahlung', 'Rückzahlung Juni', 'J'),
  ('2026-06-30',  10300, 'debt', 'sonstiges', 'Nachtrag Juni', 'J'),
  ('2026-07-31', 171600, 'debt', 'urlaub', 'Urlaub', 'J'),
  ('2026-07-31',  41900, 'debt', 'urlaub', 'Spanien', 'J');
