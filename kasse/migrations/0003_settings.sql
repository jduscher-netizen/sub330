-- Einstellungen, u. a. das in der App festgelegte Passwort (PBKDF2-Hash) und der Cookie-Schlüssel
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
