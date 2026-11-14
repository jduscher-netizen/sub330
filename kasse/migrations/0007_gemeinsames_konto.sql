-- Milena zahlt jeden Monat 200 € aufs gemeinsame Konto, von dem gemeinsame Fixkosten abgehen.
-- Zählt als gemeinsame Ausgabe von Milena (halbe halbe: ihr Monatsbetrag sinkt um 100 €).
-- Ab November 2026, monatlich am 1. Ausgeglichene Monate bleiben unberührt.
INSERT INTO recurring (label, category, amount_cents, payer, day, start_month)
SELECT 'Gemeinsames Konto (Fixkosten)', 'abos', 20000, 'M', 1, '2026-11'
 WHERE NOT EXISTS (SELECT 1 FROM recurring WHERE label = 'Gemeinsames Konto (Fixkosten)');
