-- Vorwoche 19. bis 25.10.2026: drei lockere Läufe, erzeugt mit plan/generate_plan.py --week0

DELETE FROM planned_sessions WHERE date BETWEEN '2026-10-19' AND '2026-10-25';

INSERT INTO planned_sessions (date, sort, type, title, zone, duration_min, distance_km, hard, priority, status, structure_json, notes) VALUES
  ('2026-10-20', 0, 'easy', 'Lockerer Lauf, 30 min Z2', 'Z2', 30, 5.0, 0, 1, 'geplant', '[{"min": 30, "zone": "Z2"}]', 'Erster Lauf nach dem Marathon: ganz locker, gerne kürzer, wenn die Beine schwer sind.'),
  ('2026-10-22', 0, 'easy', 'Lockerer Lauf, 35 min Z2', 'Z2', 35, 5.8, 0, 1, 'geplant', '[{"min": 35, "zone": "Z2"}]', NULL),
  ('2026-10-25', 0, 'easy', 'Lockerer Lauf, 45 min Z2', 'Z2', 45, 7.5, 0, 1, 'geplant', '[{"min": 45, "zone": "Z2"}]', NULL);

UPDATE week_targets SET note = 'Vorwoche mit drei lockeren Läufen: Gym und Schwimmen dürfen den Ton angeben.' WHERE week_start = '2026-10-19' AND category = 'gym';
