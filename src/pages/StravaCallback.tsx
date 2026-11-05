import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAthlete } from '../context/athlete-state.ts';
import { exchangeAuthorizationCode, fetchStravaActivities, mapStravaActivities, readStravaCallback, scopeAllowsActivities, StravaError, takeExpectedState } from '../lib/strava.ts';
import { useDocumentTitle } from '../lib/theme.ts';

export function StravaCallback() {
  useDocumentTitle('Strava');
  const navigate = useNavigate();
  const { ready, stravaSettings, setStravaTokens, commitImport, setNotice } = useAthlete();
  const [message, setMessage] = useState('Strava-Antwort wird geprüft …');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!ready) return;
    const { code, state, error, scope } = readStravaCallback();
    window.history.replaceState(null, '', window.location.pathname);
    if (error) {
      setFailed(true);
      setMessage(error === 'access_denied'
        ? 'Der Zugriff wurde bei Strava abgelehnt. Es wurde nichts importiert.'
        : `Strava hat die Anmeldung abgebrochen (${error}).`);
      return;
    }
    if (!code) {
      setFailed(true);
      setMessage('In der Rückleitung fehlt der Autorisierungscode. Starte die Verbindung erneut.');
      return;
    }
    const expected = takeExpectedState();
    if (!state || !expected || state !== expected) {
      setFailed(true);
      setMessage('Die Anmeldung passt nicht zur gestarteten Sitzung. Starte den Strava-Login erneut.');
      return;
    }
    if (!scopeAllowsActivities(scope)) {
      setFailed(true);
      setMessage('Strava hat activity:read_all nicht freigegeben. Ohne diese Freigabe kann PaceMates die Aktivitäten nicht lesen.');
      return;
    }
    let cancel = false;
    void (async () => {
      try {
        setMessage('Code wird bei Strava eingelöst …');
        const tokens = await exchangeAuthorizationCode(code, stravaSettings, scope);
        if (cancel) return;
        const withScope = { ...tokens, scope: scope ?? tokens.scope };
        setStravaTokens(withScope);
        setMessage(withScope.athleteLabel ? `Verbunden als ${withScope.athleteLabel}. Aktivitäten werden geholt …` : 'Verbunden. Aktivitäten werden geholt …');
        const raw = await fetchStravaActivities(withScope.accessToken, (count) => {
          if (!cancel) setMessage(`${count} Aktivitäten von Strava gelesen …`);
        });
        const mapped = mapStravaActivities(raw);
        const result = commitImport(mapped.map((draft) => ({ activity: draft.activity, include: true })));
        const cap = raw.length >= 4000 ? ' Es wurden höchstens 4000 Aktivitäten geholt.' : '';
        const summary = `${result.added} neue Aktivitäten, ${result.merged} mit vorhandenen zusammengeführt.${cap}`;
        setNotice(summary);
        navigate('/app/daten', { replace: true });
      } catch (reason) {
        if (cancel) return;
        setFailed(true);
        setMessage(reason instanceof StravaError || reason instanceof Error ? reason.message : 'Die Strava-Verbindung ist fehlgeschlagen.');
      }
    })();
    return () => {
      cancel = true;
    };
  }, [ready, stravaSettings, setStravaTokens, commitImport, setNotice, navigate]);

  return (
    <main id="inhalt" className="page narrow">
      <p className="kicker">Strava</p>
      <h1>{failed ? 'Verbindung nicht fertig' : 'Strava'}</h1>
      <p className="status" role="status">{message}</p>
      <Link className="btn btn-ghost" to="/app/daten">Zu den Datenquellen</Link>
    </main>
  );
}
