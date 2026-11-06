import { useState } from 'react';
import { useAthlete } from '../context/athlete-state.ts';
import { stravaHosted } from '../lib/config.ts';
import { formatDateTime } from '../lib/format.ts';
import { stravaRedirectUri } from '../lib/paths.ts';
import { beginStravaLogin, describeSync, incrementalAfter, resolveStravaRoute, revokeStrava, StravaError, syncStrava } from '../lib/strava.ts';

/** Strava-Anbindung. Zeigt nur Wege, die wirklich eingerichtet sind. */
export function StravaPanel({ onMessage }: { onMessage: (message: string) => void }) {
  const { activities, stravaSettings, updateStravaSettings, stravaTokens, setStravaTokens, commitImport, disconnectStrava } = useAthlete();
  const [syncing, setSyncing] = useState(false);
  const [now] = useState(() => Date.now());
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ownOpen, setOwnOpen] = useState(() => Boolean(stravaSettings.clientId) || !stravaHosted);
  const redirectUri = stravaRedirectUri();
  const route = resolveStravaRoute(stravaSettings);
  const usingOwn = route.kind === 'own';

  async function connect() {
    if (route.kind === 'none') {
      onMessage('Trag zuerst die Client-ID deiner Strava-API-Anwendung ein. Ohne sie startet kein Login.');
      return;
    }
    try {
      await beginStravaLogin(route);
    } catch (error) {
      onMessage(error instanceof StravaError ? error.message : 'Der Strava-Login konnte nicht gestartet werden.');
    }
  }

  async function sync(full: boolean) {
    if (!stravaTokens) return;
    setSyncing(true);
    onMessage('Strava wird abgefragt …');
    try {
      const result = await syncStrava(stravaSettings, stravaTokens, {
        after: full ? undefined : incrementalAfter(activities),
        onPage: (count) => onMessage(`${count} Aktivitäten von Strava gelesen …`),
        onTokens: setStravaTokens,
      });
      const applied = commitImport(result.drafts.map((draft) => ({ activity: draft.activity, include: true })));
      onMessage(describeSync(applied, result));
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'Der Abruf ist fehlgeschlagen.');
    } finally {
      setSyncing(false);
    }
  }

  async function disconnect() {
    if (!stravaTokens) return;
    const revoked = await revokeStrava(stravaTokens);
    disconnectStrava();
    onMessage(revoked
      ? 'Verbindung getrennt und der Zugriff bei Strava widerrufen. Bereits importierte Aktivitäten bleiben in deiner Bibliothek.'
      : 'Verbindung in PaceMates getrennt. Den Zugriff bei Strava selbst widerrufst du unter strava.com/settings/apps. Importierte Aktivitäten bleiben in deiner Bibliothek.');
  }

  const expired = stravaTokens ? stravaTokens.expiresAt * 1000 < now : false;

  return (
    <section className="card" id="strava" aria-labelledby="strava-titel">
      <div className="card-head">
        <h2 id="strava-titel">Strava</h2>
        <span className={stravaTokens ? 'badge badge-ok' : 'badge'}>{stravaTokens ? 'Verbunden' : 'Nicht verbunden'}</span>
      </div>

      {stravaTokens ? (
        <>
          <p>
            {stravaTokens.athleteLabel ? <>Verbunden als <strong>{stravaTokens.athleteLabel}</strong>. </> : 'Verbunden. '}
            {expired ? 'Der Zugang ist abgelaufen und wird beim nächsten Abruf erneuert.' : `Zugang gültig bis ${formatDateTime(new Date(stravaTokens.expiresAt * 1000).toISOString())}.`}
          </p>
          <div className="row-actions">
            <button type="button" className="btn btn-primary" onClick={() => void sync(false)} disabled={syncing}>{syncing ? 'Holt …' : 'Neue Aktivitäten holen'}</button>
            <button type="button" className="btn btn-ghost" onClick={() => void sync(true)} disabled={syncing}>Alles neu abgleichen</button>
            <button type="button" className="btn btn-ghost" onClick={() => void disconnect()} disabled={syncing}>Verbindung trennen</button>
          </div>
          <p className="meta">„Neue Aktivitäten holen“ fragt ab einer Woche vor deiner neuesten Strava-Einheit. Doppelte Einheiten aus Datei und Strava werden zusammengeführt.</p>
        </>
      ) : stravaHosted && !usingOwn ? (
        <>
          <p>Melde dich bei Strava an und erlaube PaceMates, deine Aktivitäten zu lesen. Danach holt PaceMates sie direkt in diesen Browser.</p>
          <div className="row-actions">
            <button type="button" className="btn btn-strava" onClick={() => void connect()}>Mit Strava verbinden</button>
          </div>
          <ul className="facts-list">
            <li>Freigabe: <code>activity:read_all</code>, also auch private Aktivitäten. Schreiben kann PaceMates nichts.</li>
            <li>Der Anmeldecode läuft einmal über den PaceMates-Token-Dienst, der das Client Secret ergänzt. Er speichert nichts.</li>
            <li>Zugangsschlüssel und Aktivitäten liegen danach nur in diesem Browser.</li>
          </ul>
        </>
      ) : (
        <p>Strava ist hier nur mit einer eigenen Strava-API-Anwendung möglich. Das dauert etwa fünf Minuten. Ohne sie geht der Weg über den Strava-Datenexport, siehe unten.</p>
      )}

      {stravaHosted ? (
        <details className="sub" open={ownOpen} onToggle={(event) => setOwnOpen((event.target as HTMLDetailsElement).open)}>
          <summary>Eigene Strava-API-Anwendung verwenden</summary>
          {ownApp()}
        </details>
      ) : ownApp()}

      <h3>Ohne Verbindung</h3>
      <p className="meta">In Strava unter Einstellungen → Mein Konto → „Konto herunterladen oder löschen“ den Datenexport anfordern. Die ZIP enthält <code>activities.csv</code> und die Aktivitätsdateien. Leg die ZIP oben bei den Dateien ab.</p>
    </section>
  );

  function ownApp() {
    return (
      <div className="own-app">
        <ol className="steps-inline">
          <li>Unter <a href="https://www.strava.com/settings/api" target="_blank" rel="noreferrer">strava.com/settings/api</a> eine Anwendung anlegen.</li>
          <li>Als „Authorization Callback Domain“ <code>{new URL(redirectUri).hostname}</code> eintragen.</li>
          <li>Client-ID und Client Secret hier eintragen und verbinden.</li>
        </ol>
        <label className="field">
          <span>Rückleitungs-URL</span>
          <span className="input-row">
            <input readOnly value={redirectUri} onFocus={(event) => event.target.select()} />
            <button
              type="button"
              className="btn btn-small"
              onClick={() => {
                void navigator.clipboard?.writeText(redirectUri).then(() => setCopied(true)).catch(() => setCopied(false));
              }}
            >
              {copied ? 'Kopiert' : 'Kopieren'}
            </button>
          </span>
        </label>
        <div className="form-grid">
          <label className="field">
            <span>Client-ID</span>
            <input inputMode="numeric" autoComplete="off" value={stravaSettings.clientId} onChange={(event) => updateStravaSettings({ clientId: event.target.value.replace(/\D/g, '').slice(0, 12) })} />
          </label>
          <label className="field">
            <span>Client Secret, bleibt in diesem Browser</span>
            <span className="input-row">
              <input type={showSecret ? 'text' : 'password'} autoComplete="off" spellCheck={false} value={stravaSettings.clientSecret} onChange={(event) => updateStravaSettings({ clientSecret: event.target.value })} />
              <button type="button" className="btn btn-small" aria-pressed={showSecret} onClick={() => setShowSecret((value) => !value)}>{showSecret ? 'Verbergen' : 'Anzeigen'}</button>
            </span>
          </label>
        </div>
        {stravaSettings.clientId && !stravaSettings.clientSecret ? <p className="note note-warn">Ohne Client Secret lehnt Strava den Token-Tausch ab. Der Login kann trotzdem starten.</p> : null}
        <p className="meta">Strava verlangt beim Token-Tausch das Secret, auch mit PKCE. Es wird nur im lokalen Speicher dieses Browsers abgelegt und nie an PaceMates geschickt. Auf einem geteilten Rechner trägst du es besser nicht ein.</p>
        {!stravaTokens && usingOwn ? (
          <div className="row-actions">
            <button type="button" className="btn btn-strava" onClick={() => void connect()}>Mit eigener Anwendung verbinden</button>
            {stravaHosted ? <button type="button" className="btn btn-ghost" onClick={() => updateStravaSettings({ clientId: '', clientSecret: '' })}>Eigene Anwendung entfernen</button> : null}
          </div>
        ) : null}
        {!stravaTokens && !usingOwn && !stravaHosted ? <p className="meta">Ohne Client-ID startet kein Login. Eine Verbindung wird nicht vorgetäuscht.</p> : null}
      </div>
    );
  }
}
