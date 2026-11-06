# Strava-Token-Proxy

Strava verlangt beim Token-Tausch das **Client Secret**, auch wenn PKCE mitgeschickt wird. Ein Secret im Frontend wäre öffentlich. Dieser kleine Dienst hält das Secret serverseitig und reicht nur zwei Anfragen an `https://www.strava.com/oauth/token` weiter:

- `authorization_code` (Code gegen Tokens tauschen, mit PKCE-Verifier)
- `refresh_token` (abgelaufenes Token erneuern)

Er speichert nichts, loggt keine Tokens, prüft die Herkunft (CORS-Allowlist) und die Rückleitungs-URL, und gibt vom Athleten nur Vor- und Nachnamen zurück. Die Aktivitäten selbst holt der Browser danach direkt bei Strava. Sie laufen nicht durch den Proxy.

## Einrichten mit Cloudflare Workers (Empfehlung für den Start)

1. Strava-API-Anwendung unter https://www.strava.com/settings/api anlegen.
   - Website: `https://pacemates.de`
   - Authorization Callback Domain: `pacemates.de` (solange GitHub Pages läuft: `juanvalle64.github.io`; lokal geht `localhost` immer)
2. In diesem Ordner:
   ```bash
   cp wrangler.toml.example wrangler.toml   # Client-ID und erlaubte Origins eintragen
   npx wrangler login
   npx wrangler secret put STRAVA_CLIENT_SECRET   # Secret eingeben, landet nur bei Cloudflare
   npx wrangler deploy
   ```
3. Die angezeigte Adresse plus `/token` ist die `STRAVA_TOKEN_URL`, zum Beispiel `https://pacemates-strava.<konto>.workers.dev/token`.
4. Im GitHub-Repository unter Settings → Secrets and variables → Actions → **Variables** setzen:
   - `STRAVA_CLIENT_ID` = Client-ID
   - `STRAVA_TOKEN_URL` = Adresse aus Schritt 3
   Beides ist öffentlich und gehört nicht zu den Secrets. Das Client Secret steht nirgends im Repository.
5. Workflow neu laufen lassen. Unter Daten erscheint dann „Mit Strava verbinden“ ohne weitere Eingaben.

## Rückleitungs-URLs

| Umgebung | Origin in `ALLOWED_ORIGINS` | Rückleitung |
| --- | --- | --- |
| Lokal | `http://127.0.0.1:43123`, `http://localhost:43123` | `http://127.0.0.1:43123/strava/callback` |
| GitHub Pages | `https://juanvalle64.github.io` | `https://juanvalle64.github.io/pacemates/strava/callback` |
| Eigene Domain | `https://pacemates.de` | `https://pacemates.de/strava/callback` |

Strava erlaubt pro Anwendung **eine** Callback-Domain (plus `localhost`). Für den Wechsel von github.io auf pacemates.de die Domain in den Strava-Einstellungen umstellen.

## Alternative: eigener Server in der EU

`node-server.js` startet denselben Handler mit Node.js 22, zum Beispiel auf einem kleinen VPS. HTTPS übernimmt ein Reverse-Proxy (Caddy, nginx).

```bash
STRAVA_CLIENT_ID=12345 STRAVA_CLIENT_SECRET=… ALLOWED_ORIGINS=https://pacemates.de PORT=8787 node node-server.js
```

## Tests

`handler.test.js` läuft mit `npm test` im Hauptprojekt.
