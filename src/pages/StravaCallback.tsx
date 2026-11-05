import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAthlete } from '../context/athlete-state.ts';
import { describeSync, exchangeAuthorizationCode, readStravaCallback, scopeAllowsActivities, syncStrava, takeExpectedState } from '../lib/strava.ts';
import { useDocumentTitle } from '../lib/theme.ts';

interface Check {
  code: string | null;
  scope: string | null;
  problem: string | null;
}

function checkCallback(): Check {
  const { code, state, error, scope } = readStravaCallback();
  if (typeof window !== 'undefined') window.history.replaceState(null, '', window.location.pathname);
  if (error) {
    return {
      code: null,
      scope,
      problem: error === 'access_denied'
        ? 'Du hast den Zugriff bei Strava abgelehnt. Es wurde nichts importiert.'
        : `Strava hat die Anmeldung abgebrochen (${error}).`,
    };
  }
  if (!code) return { code: null, scope, problem: 'In der Rückleitung fehlt der Anmeldecode. Starte die Verbindung erneut.' };
  const expected = takeExpectedState();
  if (!state || !expected || state !== expected) {
    return { code: null, scope, problem: 'Die Anmeldung passt nicht zur gestarteten Sitzung. Das passiert, wenn der Login in einem anderen Tab begonnen wurde. Starte ihn erneut.' };
  }
  if (!scopeAllowsActivities(scope)) {
    return { code: null, scope, problem: 'Strava hat activity:read_all nicht freigegeben. Ohne diese Freigabe kann PaceMates deine Aktivitäten nicht lesen. Verbinde dich erneut und lass das Häkchen gesetzt.' };
  }
  return { code, scope, problem: null };
}

export function StravaCallback() {
  useDocumentTitle('Strava');
  const navigate = useNavigate();
  const { ready, stravaSettings, setStravaTokens, commitImport, setNotice } = useAthlete();
  const [check] = useState(checkCallback);
  const [progress, setProgress] = useState('Strava-Antwort wird geprüft …');
  const [failure, setFailure] = useState<string | null>(null);
  const problem = check.problem ?? failure;

  useEffect(() => {
    if (!ready || !check.code) return;
    let cancel = false;
    const code = check.code;
    void (async () => {
      try {
        setProgress('Anmeldung wird bei Strava bestätigt …');
        const tokens = await exchangeAuthorizationCode(code, stravaSettings, check.scope);
        if (cancel) return;
        setStravaTokens(tokens);
        setProgress(tokens.athleteLabel ? `Verbunden als ${tokens.athleteLabel}. Aktivitäten werden geholt …` : 'Verbunden. Aktivitäten werden geholt …');
        const result = await syncStrava(stravaSettings, tokens, {
          onPage: (count) => {
            if (!cancel) setProgress(`${count} Aktivitäten von Strava gelesen …`);
          },
          onTokens: setStravaTokens,
        });
        const applied = commitImport(result.drafts.map((draft) => ({ activity: draft.activity, include: true })));
        setNotice(describeSync(applied, result));
        navigate(applied.added + applied.merged > 0 ? '/app' : '/app/daten#strava', { replace: true });
      } catch (reason) {
        if (cancel) return;
        setFailure(reason instanceof Error ? reason.message : 'Die Strava-Verbindung ist fehlgeschlagen.');
      }
    })();
    return () => {
      cancel = true;
    };
  }, [ready, check, stravaSettings, setStravaTokens, commitImport, setNotice, navigate]);

  return (
    <main id="inhalt" className="page narrow">
      <p className="kicker">Strava</p>
      <h1>{problem ? 'Verbindung nicht fertig' : 'Strava wird verbunden'}</h1>
      <p className={problem ? 'note note-warn' : 'status'} role={problem ? 'alert' : 'status'}>{problem ?? progress}</p>
      <div className="row-actions">
        <Link className="btn btn-primary" to="/app/daten#strava">Zu den Datenquellen</Link>
        {problem ? <Link className="btn btn-ghost" to="/app/daten#dateien">Stattdessen Dateien importieren</Link> : null}
      </div>
    </main>
  );
}
