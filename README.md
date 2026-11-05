# PaceMates

PaceMates ist eine statische Web-App für Ausdauersport. Sie zeigt Umfang, Intensität, Verlauf, Vergleiche, Form und Erholung aus echten Aktivitäten. Entwickelt von Juan.

Es gibt keine Beispieldaten. Ohne Import oder Strava-Abruf bleiben Diagramme und Kennzahlen leer.

Die Domain pacemates.de gehört Juan, ist aber noch nicht mit dieser App verbunden. Das Repository ist https://github.com/juanvalle64/pacemates. Die Seite für GitHub Pages ist https://juanvalle64.github.io/pacemates/.

## Was Version 1 kann

- Import von GPX, TCX, FIT und CSV, auch mehrere Dateien und ZIP. Die Aktivitäten bleiben in IndexedDB in diesem Browser.
- Strava über OAuth mit PKCE, sobald eine Client-ID hinterlegt ist. Der Token-Tausch braucht zusätzlich das Client Secret, weil Strava es weiterhin verlangt. Das Secret wird nur lokal gespeichert und steht nicht im Quellcode.
- Garmin über Dateiexport. Es gibt keinen Garmin-Login. Die offizielle API ist partnerbeschränkt.
- Übersicht, Trends und Vergleiche für Zeit, Distanz, Belastung und die Sportarten Laufen, Radfahren, Schwimmen und Kombi.
- Fitness (CTL), Ermüdung (ATL) und Form (TSB) aus der Tagesbelastung.
- Hinweise aus festen Regeln. Jeder Hinweis nennt die Kennzahl, aus der er kommt. Bei zu wenig Daten bleibt die Liste leer.
- Kein Vergleich mit anderen Athletinnen oder Athleten.

Gleiche Aktivitäten aus Datei und Strava werden über Startzeit, Dauer und Distanz zusammengeführt. Dieselbe Strava-ID zählt ebenfalls als dieselbe Einheit. Lauf und Rad mit unterschiedlichem Typ werden nicht vermischt.

## Lokal starten

Voraussetzung ist Node.js 22 oder neuer.

```bash
npm install
npm run dev
```

Die App läuft dann unter http://127.0.0.1:43123.

```bash
npm test
npm run build
npm run preview
```

`npm run build` schreibt die statische Seite nach `dist/`.

## Datei-Import

In der App unter Datenquellen Dateien auswählen oder ablegen. Erlaubt sind `.gpx`, `.tcx`, `.fit`, `.csv`, `.gz` und `.zip`.

Vor dem Speichern gibt es eine Vorschau. Dort lassen sich Sportart, Name und Startzeit korrigieren. Zeilen ohne Startzeit sind nicht vorausgewählt.

CSV darf Komma oder Semikolon als Trenner haben. Deutsche Dezimalkommas werden gelesen. Ein Strava-Export mit den Spalten `Activity Date` und `Activity ID` wird als Meter-Distanz gelesen und bekommt die Strava-ID für die Dublettenprüfung. Eine deutsche Liste mit `Distanz` in Kilometern wird als Kilometer gelesen, solange die Werte nicht wie Meter aussehen.

GPX und TCX brauchen Zeitstempel, damit die Einheit im Kalender landet. FIT liest die Session, bei mehreren Ausdauersportarten in einer Datei eine Kombi mit Abschnitten.

Die Daten bleiben im Browser. Ein JSON-Export und das Löschen stehen in der Bibliothek.

## Strava

1. Unter https://www.strava.com/settings/api eine API-Anwendung anlegen.
2. Als Callback Domain die Domain eintragen, auf der PaceMates läuft. Lokal ist das `127.0.0.1` oder `localhost`. Die genaue Rückleitungs-URL zeigt die App unter Datenquellen, zum Beispiel `http://127.0.0.1:43123/strava/callback`.
3. Die Client-ID in PaceMates eintragen.
4. Das Client Secret nur lokal in das Feld eintragen. Strava lehnt den Token-Tausch ohne Secret ab, auch wenn PaceMates PKCE mitschickt. Das Secret nicht ins Repository schreiben und nicht auf einem geteilten Rechner speichern.
5. Mit Strava verbinden und die Freigabe `activity:read_all` erlauben.

Ohne Client-ID startet der Button keinen Login. Eine Verbindung wird nicht vorgetäuscht. Ein abgelaufenes Token kann erneuert werden, solange Client-ID, Secret und Refresh-Token lokal vorhanden sind.

Wer keine API-Anwendung anlegen will, importiert den Strava-Datenexport. Darin liegen `activities.csv` und GPX-Dateien.

## Garmin

Was funktioniert: FIT, GPX und TCX aus Garmin Connect, einzeln oder als ZIP.

Eine einzelne Aktivität lässt sich in Garmin Connect exportieren, oft über das Zahnrad der Aktivität. Für viele Einheiten gibt es in den Kontoeinstellungen einen Datenexport. Die Menüführung ändert Garmin gelegentlich.

Was nicht funktioniert: die Garmin Connect Developer API und die Consumer Data API. Zugang gibt es nur über Garmins Entwicklerprogramm. Diese Version enthält keinen Garmin-Login.

## GitHub Pages

`npm run dev` bleibt unter `/` erreichbar. `npm run build` setzt den Basispfad auf `/pacemates/`, passend zur Projektseite https://juanvalle64.github.io/pacemates/. Ein gesetztes `VITE_BASE` überschreibt das, zum Beispiel `/` für eine spätere eigene Domain.

```bash
VITE_BASE=/ npm run build
```

Der Wert ist kein Geheimnis. Eine Vorlage liegt in `.env.example`.

Der Build schreibt `dist/404.html` passend zum Basispfad, damit direkte Adressen auf GitHub Pages wieder bei der App landen. Der Workflow `.github/workflows/pages.yml` baut `dist` und veröffentlicht es über GitHub Actions. `node_modules` wird nicht eingecheckt.

Die Strava-Rückleitungs-URL auf dieser Installation ist `https://juanvalle64.github.io/pacemates/strava/callback`. Dieselbe Adresse zeigt die App unter Datenquellen.

## Modell

Die Tagesbelastung ist die Summe der Einheiten des Tages.

- TRIMP nach Bannister, wenn eine Aktivität eine mittlere Herzfrequenz hat und maximale sowie Ruheherzfrequenz eingetragen sind. Der Faktor ist 1,92 oder wahlweise 1,67. PaceMates fragt kein Geschlecht ab.
- TSS aus Normalized Power oder mittlerer Leistung gegen die eingetragene FTP, oder ein TSS, der schon in der FIT-Datei steht.
- Pace-Belastung, wenn eine Schwellenpace für Laufen oder Schwimmen eingetragen ist.
- Sonst ein Dauer-Proxy nur aus den Minuten. Die Oberfläche sagt das dazu.

Fitness (CTL) ist der exponentiell geglättete 42-Tage-Schnitt, Ermüdung (ATL) der 7-Tage-Schnitt:

`wert = wert + (tagesbelastung - wert) / zeitkonstante`

Die Form (TSB) ist CTL minus ATL vom Vortag, also der Wert vor der Belastung des Tages. Die Reihe startet bei null. In den ersten sechs Wochen ist sie noch nicht stabil. Tage ohne importierte Einheit gehen mit Belastung 0 ein. Wenn die letzte Einheit länger zurückliegt, sagen die Hinweise das, statt eine erholte Form zu behaupten.

## Datenschutz

Es gibt keinen PaceMates-Server. Aktivitäten, Name, Modell-Eingaben und ein eventuell eingetragenes Strava-Secret liegen nur im Browser dieser Installation.
