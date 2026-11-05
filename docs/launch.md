# Launch unter pacemates.de

## A. Technischer Plan

1. **Strava-Anwendung anlegen** (Juan): https://www.strava.com/settings/api. Name „PaceMates“, Website `https://pacemates.de`, Callback Domain zunächst `juanvalle64.github.io`, nach der Umstellung `pacemates.de`.
2. **Token-Proxy deployen** (Juan, etwa 15 Minuten): Anleitung in `server/strava-token-proxy/README.md`. Secret nur per `wrangler secret put`.
3. **Repository-Variablen setzen:** `STRAVA_CLIENT_ID`, `STRAVA_TOKEN_URL`. Workflow läuft, github.io zeigt „Mit Strava verbinden“. Selbst testen: verbinden, holen, trennen.
4. **Betreiberangaben** in `src/content/operator.ts` eintragen, Texte prüfen lassen, dann `reviewed: true`.
5. **Domain verbinden:**
   - Bei GitHub: Settings → Pages → Custom domain `pacemates.de`, danach „Enforce HTTPS“.
   - DNS beim Registrar: `A`-Einträge für `pacemates.de` auf `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`; `AAAA` auf `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`; `CNAME` für `www` auf `juanvalle64.github.io`. (Werte vor dem Eintragen in der GitHub-Pages-Dokumentation gegenprüfen.)
   - Domain bei GitHub verifizieren (Settings → Pages → Verified domains), damit sie niemand anderes übernehmen kann.
   - Repository-Variable `PACEMATES_DOMAIN=pacemates.de` setzen. Der Build nutzt dann Basispfad `/` und schreibt `CNAME`.
6. **Nach der Umstellung:** Strava-Callback-Domain auf `pacemates.de` ändern, `ALLOWED_ORIGINS` im Proxy um `https://pacemates.de` ergänzen (github.io kann danach raus).
7. **Abnahme:** Datei-Import (GPX, FIT, Strava-ZIP), Strava verbinden/holen/trennen, Sicherung exportieren und in einem anderen Browser einspielen, hell/dunkel, Handy.

**Caching:** GitHub Pages liefert mit kurzer Cache-Zeit aus. Die JS- und CSS-Dateien tragen einen Inhalts-Hash im Namen, ein neues Deployment wird also sofort wirksam. Mehr ist für den Start nicht nötig.

**Cookie-Banner:** Nicht nötig. PaceMates setzt keine Cookies und nutzt keine Analyse. Die Browserspeicherung ist für den genutzten Dienst unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG). Wird später Reichweitenmessung gewünscht, nur cookielos und mit eigener Prüfung.

## B. Launch-Story

**Problem:** Wer läuft, fährt oder schwimmt, hat in Garmin und Strava Hunderte Einheiten. Die Apps zeigen jede einzelne sehr genau. Die Fragen dazwischen beantworten sie schlecht: Trainiere ich mehr als vor einem Monat? Bin ich müde oder baue ich auf? Was fehlt gerade?

**Lösung:** PaceMates liest deine eigenen Daten, rechnet Umfang, Intensität, Belastung, Fitness, Ermüdung und Form, und sagt dir mit festen Regeln, was auffällt. Jeder Hinweis zeigt die Zahl, aus der er kommt.

**Beweis statt Behauptung:** offene Rechnung (Formeln auf der Landing), Hinweis auf die Grenzen, keine Beispieldaten, offener Quellcode.

**Haltung:** Deine Daten, dein Gerät, dein Vergleich mit dir selbst.

## C. Kanäle und fertige Texte

Alle Texte ohne Nutzerzahlen, Prozentversprechen oder Zitate. Die Grafiken liegen in `marketing/assets/`, das Teilen-Bild in `public/og.png`. Sie nennen `pacemates.de`, also erst nach der Domain-Umstellung verwenden (oder Fußzeile in `marketing/templates/card.html` ändern und neu rendern).

### 1. Landing (umgesetzt)

Hero: „Sieh, was dein Training wirklich tut.“ Danach Problem, drei Schritte, fünf Ansichten, offene Rechnung, Datenquellen, Datenschutz, Fragen.

### 2. Instagram / LinkedIn – Post 1 (Grafik `post-1-…`)

> Viele Zahlen. Wenig Antworten.
> Deine Uhr kennt jede Einheit. Aber trainierst du gerade mehr als letzten Monat? Bist du müde oder baust du auf?
> PaceMates liest deine Garmin- und Strava-Daten und zeigt Umfang, Intensität, Form und Erholung. Ohne Konto. Die Daten bleiben in deinem Browser.
> pacemates.de

### 3. Post 2 (Grafik `post-2-…`)

> Ohne deine Daten bleibt alles leer.
> Klingt selbstverständlich, ist es aber nicht: Viele Dashboards zeigen dir erst mal schöne Beispielkurven. PaceMates nicht. Was du siehst, stammt aus deinen Einheiten. Und wenn eine Zahl noch wackelig ist, steht das dabei.

### 4. Post 3 (Grafik `post-3-…`)

> Jeder Tipp zeigt seine Zahl.
> Keine Blackbox. Wenn PaceMates dir rät, einen leichteren Tag einzuplanen, siehst du darunter, warum: zum Beispiel die Belastung der letzten 7 Tage gegen die 7 davor. Du entscheidest, was du daraus machst.

### 5. Post 4 (Grafik `post-4-…`)

> Deine Einheiten bleiben auf deinem Gerät.
> Kein Konto. Dateien werden im Browser gelesen, nicht hochgeladen. Keine Cookies, kein Tracking. Willst du aufs neue Handy umziehen? Sicherung herunterladen, dort wieder ablegen. Fertig.

### 6. Story (Grafik `story-launch.png`)

Text-Sticker: „Neu: PaceMates“ – Link-Sticker auf pacemates.de.

### 7. Kurzer Erklärclip (30–45 s, Bildschirmaufnahme mit eigenen echten Daten)

| Zeit | Bild | Sprecher/Untertitel |
| --- | --- | --- |
| 0–5 s | Garmin-Export-ZIP wird ins Ablagefeld gezogen | „Das ist mein Garmin-Export. Einfach reinziehen.“ |
| 5–12 s | Vorschau, „übernehmen“ | „PaceMates zeigt, was es erkannt hat. Nichts wird hochgeladen.“ |
| 12–22 s | Übersicht, dann Form-Seite | „Wie viel ich trainiere, wie müde ich bin, was davon übrig bleibt.“ |
| 22–32 s | Tipps mit Kennzahlen | „Und Hinweise, die sagen, aus welcher Zahl sie kommen.“ |
| 32–40 s | Landing, pacemates.de | „PaceMates. Ausdauer, aus deinen Daten.“ |

Vor der Aufnahme: Name im Kopf leeren, keinen Strava-Bereich mit Secret zeigen, keine Wohnort-Strecken mit erkennbarer Adresse.

### 8. Laufverein / Triathlon-Verein (E-Mail oder Messenger)

> Hallo zusammen,
> ich habe ein kleines Werkzeug gebaut, mit dem man seine eigenen Garmin- und Strava-Daten auswerten kann: Umfang, Trends, Wochenvergleich, Form und Erholung. Es läuft komplett im Browser, ohne Konto, und es gibt keine Rangliste. Wer Lust hat, probiert es aus: pacemates.de. Über Rückmeldung, was fehlt oder unklar ist, freue ich mich.
> Juan

### 9. Reddit / Foren (z. B. r/laufen, r/triathlon)

> Ich habe PaceMates gebaut: ein Dashboard für die eigenen Garmin-/Strava-Daten, das komplett im Browser läuft (kein Konto, keine Datenbank). Es rechnet CTL/ATL/TSB, Wochenvergleiche und gibt regelbasierte Hinweise, jeweils mit der Kennzahl dahinter. Garmin geht über den Export, weil die API nur für Partner ist. Der Code ist offen: github.com/juanvalle64/pacemates. Kritik am Modell ausdrücklich willkommen.

(Vorher die Regeln des jeweiligen Forums zu Eigenwerbung lesen.)

### Nicht verwenden

Countdowns, Gewinnspiele, „limitierte Plätze“, erfundene Zitate, Nutzerzahlen, Sternebewertungen, „wissenschaftlich bewiesen“, „schneller in X Wochen“, Logos von Strava oder Garmin ohne deren offizielle Markenfreigaben.
