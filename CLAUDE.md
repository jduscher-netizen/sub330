# Trainings-App 2027 (Arbeitstitel: SUB330)

Nachfolger der SUB4-App. Persönliche Trainings-App für Jan, ersetzt im Alltag die Garmin-Connect-App. Die Garmin-App bleibt nur im Hintergrund als Brücke zwischen Uhr und Garmin-Server.

## Athletenprofil

| Wert | Stand |
|---|---|
| Laktatschwelle (LTHR) | 170 bpm |
| HFmax | 195 bpm |
| Gewicht | 85 kg, Ziel: 3 bis 4 kg Fett weniger |
| Uhr | Garmin Forerunner 970 |
| HM-Bestzeit | 1:44:42 (Marbella, 27.09.2026) |
| Marathon-Bestzeit | 3:59:09 (München, 11.10.2026) |

HF-Zonen (identisch in Garmin, Strava und App):

| Zone | bpm | Bedeutung |
|---|---|---|
| Z1 | bis 139 | Recovery |
| Z2 | 140 bis 149 | GA1 |
| Z3 | 150 bis 159 | GA2 / Grauzone |
| Z4 | 160 bis 171 | Schwelle |
| Z5 | ab 172 | VO2max |

Trainingsphilosophie: polarisiert 80/20.

## Ziele 2027

- WVV Halbmarathon Würzburg (voraussichtlich 23.05.2027): Sub 1:38 (Pace 4:38/km)
- Marathon im Oktober 2027: Sub 3:30 (Rennen noch festzulegen)
- VO2max steigern
- Kraulschwimmen lernen, Entscheidung über Triathlon 2028 im Laufe von 2027

## Wochenstruktur

- 3 bis 4 Läufe: Intervalle (VO2max), Schwelle/Tempo, Long Run, locker
- Gym mindestens 3x (Doppeleinheiten an einem Tag erlaubt)
- Padel 1x als freie Einheit, zählt als intensiv
- Rad auf dem Rollentrainer: optional, nur Z2
- Schwimmen 1 bis 2x, Technik

## Features (MVP)

### 1. Heute-Screen
- Trainingsbereitschaft wie in Garmin: Score 0 bis 100 plus Faktoren (Schlaf, Erholungszeit, HRV-Status, akute Last, Stress)
- Dazu HRV, Body Battery, Ruhepuls, VO2max
- Geplante Einheit des Tages mit Zielzone, Dauer/Distanz und Schuhempfehlung
- Bei niedriger Bereitschaft: Hinweis mit Vorschlag (lockerer laufen oder tauschen)

### 2. Trainingsplan
- Wochenansicht als Hauptansicht, dazu Phasenübersicht bis zum Rennen
- Jede Einheit mit Typ, Zone, Umfang und Status (geplant, erledigt, verpasst, verschoben)

### 3. Einfaches Umplanen
- Einheiten per Drag and Drop auf andere Tage ziehen
- Button "Tag fällt aus": App schlägt eine neue Woche vor, Jan bestätigt mit einem Tipp
- Regeln:
  - nie zwei harte Tage hintereinander (Intervalle, Schwelle, Long Run, Padel, Bein-Gym)
  - kein Bein-Gym am Tag vor Intervallen oder Long Run
  - Long Run hat Priorität vor Tempo, Tempo vor lockerem Lauf
  - verpasste lockere Einheit verfällt, harte wird verschoben oder gestrichen
  - Wochenumfang nie mehr als 10 % über Plan

### 4. Ist-Daten und Abgleich
- Garmin ist Primärquelle für Aktivitäten und Gesundheitswerte, Strava optional
- Automatisches Matching geplant zu absolviert über Datum, Sportart und Dauer (Toleranz einstellbar)
- Jede Zuordnung manuell korrigierbar (Aktivität einer anderen Einheit zuweisen oder lösen)
- Duplikate erkennen (gleiche Aktivität aus Garmin und Strava)
- Sync-Status sichtbar: letzte erfolgreiche Synchronisation je Quelle, Fehlermeldung bei Problemen

### 5. Auswertung
- Zonenverteilung pro Woche (80/20-Check)
- Wochenumfang Laufen, Rad, Schwimmen, Gym
- Verlauf: VO2max, Ruhepuls, HRV, Gewicht
- Prognose HM und Marathon (Garmin Race Predictor)

## Lehren aus SUB4

- Strava-Aktivitäten wurden falsch den geplanten Einheiten zugeordnet: Matching jetzt regelbasiert und manuell korrigierbar
- Garmin-Sync war nicht nachvollziehbar: Sync-Status und Log jetzt Pflicht

## Technik

### Garmin
- Für Privatpersonen gibt es keinen offiziellen API-Zugang.
- Nutzung der inoffiziellen Python-Bibliothek `garminconnect` (python-garminconnect). Liefert Training Readiness inkl. Faktoren, HRV, Schlaf, Body Battery, Trainingsstatus, VO2max, Aktivitäten.
- Läuft nur serverseitig. Login-Tokens nie im Frontend.
- Risiko: Garmin kann Endpunkte ändern. Fehler müssen im Sync-Status sichtbar werden, die App darf dann nicht abstürzen.

### Strava
- OAuth plus Webhook für neue Aktivitäten.

### Vorschlag Stack
- Frontend: PWA (React + Vite), mobil zuerst, gehostet auf Cloudflare Pages
- Datenbank und Auth: Supabase (Postgres)
- Garmin-Sync: Python-Job per GitHub Actions Cron (z. B. stündlich 6 bis 22 Uhr), schreibt in Supabase
- Secrets ausschließlich in GitHub Secrets bzw. Supabase

### Datenmodell (Entwurf)
- `planned_sessions`: Datum, Typ, Zone, Umfang, Priorität, Status, verknüpfte Aktivität
- `activities`: Quelle, externe ID, Sportart, Start, Dauer, Distanz, HF-Daten, Zonenzeiten
- `daily_metrics`: Datum, Readiness-Score und Faktoren, HRV, Schlaf, Body Battery, Ruhepuls, VO2max, Gewicht
- `sync_log`: Quelle, Zeitpunkt, Ergebnis, Fehlermeldung
- `races`: Name, Datum, Distanz, Zielzeit

## Design

Konzept "Startnummer": Die Trainingsbereitschaft erscheint auf dem Heute-Screen als Startnummer (helles Papier, Sicherheitsnadeln, gestrichelte Abrisskante) auf dunklem Asphalt. Der Streifen oben hat die Farbe der Zone der heutigen Einheit. Das ist das eine auffällige Element; alles andere bleibt ruhig.

Referenz-Screens (Design-Canvas, Quelle in `design/`): https://claude.ai/artifact/9Sjd2fHqaiqrRy366v2uKt
- `design/Main.dc.html`: Heute
- `design/Plan.dc.html`: Wochenplan
- `design/Umplanen.dc.html`: Tag fällt aus
- `design/Verlauf.dc.html`: Verlauf und Datenquellen

Farben:

| Token | Wert | Einsatz |
|---|---|---|
| asphalt | #23272B | Hintergrund |
| asphalt-raised | #2E3338 | hervorgehobene Zeilen, Infoboxen |
| line | #3C4248 | Trennlinien, Balken-Hintergrund |
| text | #E9ECEE | Text auf Asphalt |
| text-muted | #A3ABB3 | Nebentext auf Asphalt |
| bib | #F3F5F6 | Startnummer, Bottom Sheets, Primärbutton |
| ink | #15181B | Text auf bib |
| z1 | #8DB3D6 | Recovery |
| z2 | #4FB394 | GA1 |
| z3 | #E2C24A | GA2 |
| z4 | #EE8A3C | Schwelle |
| z5 | #E2533F | VO2max |
| gym | #9AA1A8 | Kraft |

Schrift: Big Shoulders Display (Zahlen, Titel, Startnummer), Archivo (alle UI-Texte). Beide von Google Fonts.

Regeln:
- Zonenfarben nur für Zonen und Einheiten-Typen, nie als Deko
- Inhalte als Zeilen mit Trennlinien, keine Karten-Raster
- Touch-Ziele mindestens 44 px, mobil zuerst (390 px Breite)
- Navigation unten: Heute, Plan, Verlauf, Profil

## Umsetzungsreihenfolge

1. Projekt-Setup, Supabase, Datenmodell
2. Garmin-Sync (Readiness, Metriken, Aktivitäten) inkl. Sync-Log
3. Heute-Screen
4. Trainingsplan-Ansicht und Plan-Import
5. Matching und manuelle Korrektur
6. Umplanen mit Regeln
7. Strava-Anbindung
8. Auswertungen

## Arbeitsweise

- Sprache in UI und Kommentaren: Deutsch
- Keine Gedankenstriche in UI-Texten
- Kleine, testbare Schritte; nach jedem Schritt kurz zeigen, was funktioniert
