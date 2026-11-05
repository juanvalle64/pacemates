# PaceMates – Umsetzungskonzept

Stand: 5. November 2026. Eine Richtung, keine Varianten.

## 1. Produkt

**Was PaceMates ist:** Ein Dashboard für Ausdauersportler (Laufen, Rad, Schwimmen, Triathlon), die ihre eigenen Garmin- und Strava-Daten verstehen wollen: Umfang, Intensität, Verlauf, Form, Erholung und daraus abgeleitete, nachvollziehbare Hinweise.

**Was es bewusst nicht ist:** kein soziales Netzwerk, kein Ranking, kein KI-Coach, keine Gesundheits-App, keine Cloud.

**Versprechen, das die Software hält:** Du importierst oder verbindest echte Einheiten und siehst Übersicht, Trends, Vergleiche, Form/Erholung und Tipps mit Begründung. Ohne Daten bleibt alles leer.

### Nutzerweg (Ziel: eigene Daten in wenigen Minuten)

1. Landing → „Aktivitäten importieren“ führt direkt zum Ablagefeld.
2. Erster Start in der App zeigt ein Onboarding statt leerer Diagramme: drei Quellen (Dateien, Strava, Garmin), optional Puls/Schwellen, dann lesen.
3. Import mit Vorschau: Sportart, Name, Startzeit korrigierbar. Fehlende Startzeit ist markiert und blockiert nur diese Zeile.
4. Nach dem Speichern: direkter Sprung zur Übersicht und zu den Modell-Eingaben.
5. Solange über 50 % der Belastung aus dem Dauer-Proxy kommen, zeigt die Übersicht einen Hinweis mit Link zu den Eingaben und nennt den höchsten Puls aus den Daten als Anhaltspunkt.

### Was in diesem Auftrag umgesetzt wurde

- **Strava produktionsreif:** Token-Proxy (`server/strava-token-proxy`), der das Client Secret serverseitig hält. Die App bietet „Mit Strava verbinden“ ohne Eingaben, sobald Client-ID und Proxy-Adresse beim Build gesetzt sind. Der bisherige Weg mit eigener API-Anwendung bleibt als Option. Tokens merken sich ihren Weg, damit die Erneuerung immer über denselben läuft. Abgelaufenes Token wird automatisch erneuert, auch wenn Strava es vorzeitig ablehnt. Rate-Limit (429) bricht sauber ab und behält, was schon geholt wurde. Folgeabrufe holen nur ab einer Woche vor der neuesten Strava-Einheit. „Verbindung trennen“ widerruft den Zugriff bei Strava, so weit der Browser das zulässt.
- **Garmin ehrlich:** nur Export. Anleitung für Einzel- und Komplettexport direkt am Ablagefeld.
- **Dateien erstklassig:** klare deutsche Fehlermeldungen für kaputte FIT-, ZIP-, GZ- und XML-Dateien, leere Dateien, Archive ohne Trainingsdateien und fehlende Zeitstempel.
- **Dubletten gehärtet:** Index nach externer ID und Startzeit-Fenster. 4000 gegen 4000 Einheiten in deutlich unter zwei Sekunden. Gleiche Strava-ID trifft auch bei verschobener Zeit, zwei verschiedene Strava-IDs werden nie zusammengeführt, Bewegungs- und Gesamtzeit werden beide geprüft.
- **Gerätewechsel ehrlich gelöst:** Sicherung als JSON (Aktivitäten + Modell-Eingaben, ohne Strava-Zugang), auf dem neuen Gerät einfach ins Ablagefeld legen. Keine stille Cloud.
- **Form ehrlich:** Liegt die letzte Einheit mehr als 10 Tage zurück, gibt es keine Aussage über Erholung, weder in der Übersicht noch auf der Form-Seite noch in den Tipps. In den ersten 42 Tagen steht „Das Modell läuft sich ein“.
- **Modell erklärt:** Was CTL, ATL, TSB bedeuten, Formel, Grenzen, Reihenfolge der Belastungsverfahren, Anteil des Dauer-Proxys. Jedes Eingabefeld erklärt, wofür es gut ist und wie man den Wert findet.
- **Barrierearm:** Kontraste ≥ 4,5:1 (Text) und ≥ 3:1 (Bedienelemente) in hell und dunkel, Fokus auf der Überschrift nach jedem Seitenwechsel, Anker-Sprünge mit Fokus, sichtbarer Fokusrahmen, `role="alert"` für Fehler, Zieltasten mindestens 40–44 px, kein horizontales Scrollen auf 390 px.
- **Rechtliches:** Impressum und Datenschutzerklärung als Entwurf im Produkt, gespeist aus `src/content/operator.ts`. Solange Angaben fehlen, zeigen beide Seiten sichtbar „Entwurf“.
- **Sicherheit:** Content-Security-Policy im Build (nur eigene Skripte, Inline-Skripte per Hash, `connect-src` nur Strava und Proxy). Keine Drittanbieter-Schriften oder -Skripte.
- **Qualität:** 42 automatische Tests (vorher 17), Lint im Deploy-Workflow.

## 2. Technik

| Baustein | Entscheidung |
| --- | --- |
| App | Vite, React, TypeScript, statisch. Unverändert. |
| Speicher | IndexedDB und localStorage im Browser. Kein PaceMates-Backend für Trainingsdaten. |
| Strava | OAuth mit PKCE. Token-Tausch über Proxy (Cloudflare Worker oder Node 22). Alternativ eigene API-App des Sportlers. |
| Garmin | Nur Dateiexport. Partner-API nur bei echter Freigabe durch Garmin. |
| Hosting | Phase 1: GitHub Pages mit eigener Domain (kostenlos, HTTPS automatisch). Optional später: Cloudflare Pages oder ein EU-Hoster, wenn eigene HTTP-Header gewünscht sind. |
| Domain-Umschaltung | Repository-Variable `PACEMATES_DOMAIN=pacemates.de` → Build mit Basispfad `/`, `CNAME` wird geschrieben. |

**Warum kein Account/Sync jetzt:** Ein Sync-Backend hieße Gesundheitsnahe Daten (Puls) auf einem Server, Auftragsverarbeitung, Löschkonzept, Betriebskosten und Sicherheitsverantwortung. Das widerspricht dem stärksten Argument des Produkts („bleibt auf deinem Gerät“). Die Sicherung als Datei löst den Gerätewechsel ohne diese Last. Wenn später Sync gewünscht ist, dann Ende-zu-Ende-verschlüsselt (Schlüssel nur beim Nutzer) und ausdrücklich als Opt-in. Das ist eine Entscheidung für Juan, siehe offene Punkte.

## 3. Marke

### Markenkern

**Klarheit über das eigene Training.** PaceMates nimmt die Zahlen ernst, die du schon hast, und sagt dir in ruhigen, konkreten Sätzen, was sie bedeuten und wo ihre Grenzen sind.

Persönlichkeit: präzise, ruhig, ehrlich, sportlich-trocken. Wie ein gutes Trainingstagebuch, nicht wie eine Fitness-App mit Konfetti.

### Tonalität

| Do | Don’t |
| --- | --- |
| Du-Form, kurze Sätze, Verben aus dem Training: laufen, fahren, aufbauen, ruhiger Tag | „Revolutionär“, „KI-gestützt“, „Next Level“, „Gamechanger“ |
| Zahlen nennen und ihre Herkunft sagen | Prozentversprechen, „garantiert schneller“ |
| Grenzen offen sagen („in den ersten sechs Wochen nicht stabil“) | Dringlichkeit, Countdown, „nur heute“ |
| „Du entscheidest“ | Medizinische oder Doping-nahe Aussagen |
| Vergleich mit dir selbst | Vergleich mit anderen, Ranglisten |

### Visuelle Richtung: „Bahn und Kreide“

- **Farben**
  - Kreide `#f3f0e8` (Hintergrund hell), Fläche `#fbfaf6`
  - Asphalt `#15171a` (Schrift, Primärknopf, dunkle Bänder)
  - Tartan `#b0361a` hell / `#ff7a4d` dunkel (Akzent: Kicker, Bildmarke, Fokus, Laufbahn)
  - Sportfarben: Laufen Tartan, Rad Waldgrün `#1f5c40`, Schwimmen Tiefsee `#0e5466`, Kombi Violett `#5c3d78`
  - Modellfarben: Fitness Ocker `#8a5a12`, Ermüdung Rot `#a12f2f`, Form Grün `#1d6b43`
  - Kein Lila-Verlauf, keine Neonfarben.
- **Typografie:** Barlow Condensed 700 für Überschriften und große Zahlen (Anzeigetafel, Tempo), Versalien für Seitentitel. Outfit für Text. Zahlen immer tabellarisch. Beide Schriften lokal eingebunden, nicht von Google geladen.
- **Wortmarke:** „PaceMates“ in Barlow Condensed Kursiv, davor die Bildmarke: eine Laufbahn von oben mit Startlinie.
- **Motiv:** Bahnlinien. Konzentrische Bahnen, Bahnnummern, Startlinie. Drei Bahnen tragen die Begriffe „Umfang, Intensität, Erholung“. Das Motiv ist Grafik, nie ein Diagramm mit erfundenen Werten.
- **Bildsprache:** Keine Stockfotos lachender „Kunden“. Wenn Fotos, dann echte, freigegebene Aufnahmen von Strecke, Bahn, Wasser, Rad, ohne erkennbare Personen ohne Einwilligung. Bis dahin reicht Typografie plus Bahnmotiv.
- **Screenshots in Werbung:** nur mit echten eigenen Daten nach Freigabe, nie mit sichtbarem Client Secret, Token oder Name eines Dritten.

### Designsystem im Code

Alle Tokens stehen am Anfang von `src/styles.css` (hell und dunkel). Bausteine: `btn` (primary, ghost, strava, small, large, danger), `card` (primary, accent, danger), `badge`, `note` (ok, warn, action), `stat`, `chip`, `field` mit `field-help`, `drop`, `steps`, `pick`. Bildmarke und Bahnmotiv: `src/components/Brand.tsx`.
