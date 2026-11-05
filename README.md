# PaceMates

**Sieh, was dein Training wirklich tut.** PaceMates ist ein Dashboard für Ausdauersport: Laufen, Radfahren, Schwimmen, Triathlon. Sportler importieren oder verbinden ihre eigenen Garmin- und Strava-Daten und sehen Umfang, Intensität, Verlauf, Vergleiche, Form und Erholung, dazu regelbasierte Hinweise mit der Kennzahl, aus der sie kommen.

- Live (Projektseite): https://juanvalle64.github.io/pacemates/
- Geplante Domain: https://pacemates.de (noch nicht verbunden, siehe `docs/launch.md`)
- Keine Beispieldaten. Ohne Import oder Strava-Abruf bleibt jede Auswertung leer.
- Kein Konto, keine PaceMates-Datenbank. Aktivitäten liegen nur im Browser.
- Kein Vergleich mit anderen Athletinnen oder Athleten.

## Dokumente

| Datei | Inhalt |
| --- | --- |
| `docs/konzept.md` | Umsetzungskonzept: Produkt, Technik, Marke, Designsystem |
| `docs/launch.md` | Launch-Plan pacemates.de, Launch-Story, fertige Werbetexte |
| `docs/offene-punkte.md` | Was Juan noch tun und entscheiden muss |
| `server/strava-token-proxy/README.md` | Strava-Token-Proxy einrichten |
| `marketing/` | Vorlagen und fertige Launch-Grafiken |

## Was funktioniert

- **Dateien:** GPX, TCX, FIT, CSV, GZ, ZIP (auch der komplette Strava- oder Garmin-Export) und PaceMates-Sicherungen (JSON). Vorschau vor dem Speichern mit korrigierbarer Sportart, Name und Startzeit. Verständliche Meldungen für kaputte oder leere Dateien und fehlende Zeitstempel.
- **Strava:** OAuth mit PKCE und Freigabe `activity:read_all`.
  - Mit Token-Proxy (empfohlen): Ein Klick auf „Mit Strava verbinden“. Das Client Secret liegt nur im Proxy.
  - Ohne Proxy: Jeder Sportler kann seine eigene Strava-API-Anwendung eintragen. Das Secret bleibt dann in seinem Browser.
  - Ohne Client-ID startet kein Login und es wird keine Verbindung vorgetäuscht.
  - Abgelaufene Tokens werden erneuert, Rate-Limits sauber gemeldet, Folgeabrufe holen nur Neues, „Trennen“ widerruft den Zugriff.
- **Garmin:** nur über Dateiexport. Die Garmin Connect Developer API ist Partnern vorbehalten. Es gibt keinen Garmin-Login.
- **Dubletten:** Gleiche Einheiten aus Datei und Strava werden über Strava-ID oder Startzeit (±3 min), Dauer und Distanz zusammengeführt. Zwei verschiedene Strava-IDs werden nie vermischt, Lauf und Rad auch nicht.
- **Auswertung:** Übersicht (7 Tage bis Gesamt), Trends pro Woche, Periodenvergleiche (Woche, Monat, frei), Form & Erholung (CTL/ATL/TSB), Tipps aus festen Regeln.
- **Sicherung und Gerätewechsel:** Sicherung herunterladen, auf dem anderen Gerät ins Ablagefeld legen. Strava-Zugang ist nie enthalten.
- **Datenschutz und Impressum:** Entwürfe im Produkt unter `/datenschutz` und `/impressum`, gespeist aus `src/content/operator.ts`.
- Hell/dunkel, mobil zuerst, Tastatur- und Screenreader-tauglich, deutsche Oberfläche.

## Modell

Die Tagesbelastung ist die Summe der Einheiten des Tages. Je Einheit gilt das erste passende Verfahren:

1. **TRIMP nach Banister**, wenn mittlere Herzfrequenz sowie maximale und Ruhe-Herzfrequenz vorliegen. Faktor 1,92 oder 1,67, ohne Abfrage des Geschlechts.
2. **TSS** aus Normalized Power oder mittlerer Leistung gegen die FTP, oder ein TSS aus der FIT-Datei.
3. **Pace-Belastung** gegen die eingetragene Schwellenpace (Laufen, Schwimmen).
4. Sonst ein **Dauer-Proxy** nur aus den Minuten. Die Oberfläche weist den Anteil aus.

`wert = wert + (tagesbelastung − wert) / zeitkonstante`, mit 42 Tagen für Fitness (CTL) und 7 für Ermüdung (ATL). Form (TSB) ist CTL − ATL vom Vortag. Die Reihe startet bei null und ist in den ersten sechs Wochen nicht stabil. Tage ohne Einheit zählen mit 0. Liegt die letzte Einheit mehr als 10 Tage zurück, behauptet PaceMates keine Erholung.

## Lokal starten

Node.js 22 oder neuer.

```bash
npm install
npm run dev        # http://127.0.0.1:43123
npm test           # Vitest, inklusive Token-Proxy
npm run lint
npm run build      # schreibt dist/, Basispfad /pacemates/
npm run preview
```

## Konfiguration

Alle Werte sind öffentlich (Vorlage: `.env.example`). Das Strava Client Secret gehört nie in diese Dateien.

| Variable | Wirkung |
| --- | --- |
| `VITE_BASE` | Basispfad. Build-Standard `/pacemates/`, für pacemates.de `/`. |
| `VITE_SITE_URL` | Öffentliche Adresse für Teilen-Vorschau und kanonische URL. |
| `VITE_STRAVA_CLIENT_ID` | Client-ID der PaceMates-Strava-Anwendung. |
| `VITE_STRAVA_TOKEN_URL` | Adresse des Token-Proxys (HTTPS). |

Im Deploy-Workflow werden sie aus den Repository-Variablen `PACEMATES_DOMAIN`, `STRAVA_CLIENT_ID` und `STRAVA_TOKEN_URL` gesetzt.

## Deployment

`.github/workflows/pages.yml` prüft Lint und Tests, baut und veröffentlicht auf GitHub Pages. Ist `PACEMATES_DOMAIN` gesetzt, baut er mit Basispfad `/` und schreibt `CNAME`. Der Build erzeugt `404.html` für direkte Adressen und eine Content-Security-Policy.

## Was der Betreiber noch tun muss

Siehe `docs/offene-punkte.md`. Kurz: Strava-Anwendung anlegen, Token-Proxy deployen, Repository-Variablen setzen, Domain verbinden, Impressum und Datenschutz mit echten Angaben füllen und prüfen lassen.

## Launch-Grafiken neu erzeugen

```bash
node marketing/render.cjs   # braucht Playwright mit Chromium
```
