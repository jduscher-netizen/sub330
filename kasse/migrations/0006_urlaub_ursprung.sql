-- Urlaub und Spanien: ursprünglich 2.216 € und 819 €, davon schon 500 € und 400 € zurückgezahlt.
-- Die bisher eingetragenen 1.716 € und 419 € waren nur der noch offene Rest. Offen bleibt gleich.
UPDATE debt_entries SET amount_cents = 221600, updated_at = datetime('now')
 WHERE label = 'Urlaub' AND date = '2026-07-31' AND amount_cents = 171600;
UPDATE debt_entries SET amount_cents = 81900, updated_at = datetime('now')
 WHERE label = 'Spanien' AND date = '2026-07-31' AND amount_cents = 41900;

INSERT INTO debt_entries (date, amount_cents, kind, category, label, created_by)
SELECT '2026-07-31', 50000, 'repayment', 'rueckzahlung', 'Rückzahlung Urlaub', 'J'
 WHERE EXISTS (SELECT 1 FROM debt_entries WHERE label = 'Urlaub' AND amount_cents = 221600)
   AND NOT EXISTS (SELECT 1 FROM debt_entries WHERE label = 'Rückzahlung Urlaub');
INSERT INTO debt_entries (date, amount_cents, kind, category, label, created_by)
SELECT '2026-07-31', 40000, 'repayment', 'rueckzahlung', 'Rückzahlung Spanien', 'J'
 WHERE EXISTS (SELECT 1 FROM debt_entries WHERE label = 'Spanien' AND amount_cents = 81900)
   AND NOT EXISTS (SELECT 1 FROM debt_entries WHERE label = 'Rückzahlung Spanien');
