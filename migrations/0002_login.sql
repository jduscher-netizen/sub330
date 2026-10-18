-- Fehlgeschlagene Login-Versuche zur Begrenzung von Passwort-Raten
CREATE TABLE login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_login_attempts_ip ON login_attempts(ip, created_at);
