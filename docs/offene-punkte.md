# Offene Punkte und Entscheidungen für Juan

## Muss Juan selbst tun (nicht erledigt)

1. **Strava-API-Anwendung anlegen** unter https://www.strava.com/settings/api und Client-ID bereitstellen. Das Client Secret nur per `wrangler secret put` in den Proxy, nie ins Repository, nie in einen Chat, nie in Screenshots.
2. **Token-Proxy deployen** (Cloudflare-Konto oder eigener Server), siehe `server/strava-token-proxy/README.md`.
3. **Strava-Freigabe für mehr Athleten prüfen.** Nach unserem Kenntnisstand startet eine neue Strava-API-Anwendung mit einer kleinen Athletenkapazität (anfangs nur der eigene Account) und braucht für mehr Nutzer eine Prüfung durch Strava. Bitte in den API-Einstellungen nachsehen und ggf. den Antrag stellen. Bis dahin bleiben Dateien und „eigene API-Anwendung“ der Weg für alle anderen.
4. **Strava-Markenrichtlinien:** Für den Launch die offiziellen Knöpfe „Connect with Strava“ und den Hinweis „Powered by Strava“ aus Stravas Brand-Guidelines einbauen. Die Assets haben wir bewusst nicht nachgebaut. Derzeit steht ein Text-Knopf „Mit Strava verbinden“.
5. **Garmin:** Nur wenn Garmin einen Partnerzugang genehmigt, wird ein echter Login gebaut. Ohne Genehmigung bleibt der Export.
6. **Domain pacemates.de verbinden** (DNS, GitHub Pages, Variable `PACEMATES_DOMAIN`), siehe `docs/launch.md`.
7. **Impressum und Datenschutz:** echte Betreiberdaten in `src/content/operator.ts`, Texte rechtlich prüfen lassen, dann `reviewed: true`. Die Entwürfe sind keine Rechtsberatung.

## Entscheidungen, die nur Juan treffen kann

| Frage | Empfehlung der Agentur |
| --- | --- |
| Ist PaceMates kostenlos, und bleibt das so? | Für den Launch nichts zu Preisen sagen, solange das nicht entschieden ist. Die Texte erwähnen deshalb keinen Preis. |
| Konto und Sync zwischen Geräten? | Jetzt nicht. Sicherung als Datei reicht für den Start. Falls später: nur Opt-in und Ende-zu-Ende-verschlüsselt. |
| Hosting: GitHub Pages (USA) oder EU-Hoster? | Start mit GitHub Pages. Wechsel zu einem EU-Hoster, falls „Daten und Hosting in der EU“ werblich wichtig wird. Datenschutztext dann anpassen. |
| Token-Proxy: Cloudflare oder eigener Server? | Cloudflare für den Start (kostenlos, wenig Pflege). `node-server.js` liegt bereit für einen EU-Server. |
| Repo öffentlich lassen? | Ja, Offenheit ist Teil der Glaubwürdigkeit („keine Blackbox“). Lizenz fehlt noch: bitte entscheiden (z. B. MIT oder AGPL). |
| Name im Absender der Launch-Texte („Juan“)? | Ja, persönlich wirkt glaubwürdiger. Keine weiteren privaten Angaben. |
| Echte Fotos oder Screenshots für Werbung? | Nur eigene, freigegebene Aufnahmen mit eigenen Daten. |
| Name auf Mobilgeräten | Das optionale Namensfeld ist auf schmalen Bildschirmen ausgeblendet, um Platz zu sparen. Falls wichtig, kommt es in die Datenseite. |

## Bekannte Grenzen der Software

- Strava liefert höchstens 4000 Aktivitäten pro Abruf in dieser Version. Ältere Einheiten über den Strava-Datenexport importieren.
- Ein Strava-Triathlon aus drei Einzelaktivitäten wird nicht mit einer Multisport-FIT zusammengeführt. Beide Wege einzeln funktionieren.
- Das Widerrufen bei Strava aus dem Browser ist „best effort“. Klappt es nicht, sagt die App, wo man es bei Strava selbst tut.
- Die CSP steht als Meta-Tag im HTML, weil GitHub Pages keine eigenen Header erlaubt. `frame-ancestors` (Schutz vor Einbettung) geht so nicht. Bei einem Hoster mit Headern nachziehen.
