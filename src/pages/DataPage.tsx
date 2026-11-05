import { useMemo, useState } from 'react';
import { applySportOverride, isSameActivity, withStartTime } from '../lib/activity.ts';
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../lib/dates.ts';
import { formatDateTime, formatDistance, formatDuration, methodLabel } from '../lib/format.ts';
import { stravaRedirectUri } from '../lib/paths.ts';
import { parseFiles } from '../lib/parse/files.ts';
import { SPORT_ORDER, sportLabel } from '../lib/sport.ts';
import { beginStravaLogin, fetchStravaActivities, mapStravaActivities, refreshStravaTokens, StravaError } from '../lib/strava.ts';
import { useDocumentTitle } from '../lib/theme.ts';
import type { Activity, ParsedDraft, Sport } from '../lib/types.ts';
import { SportMark } from '../components/Ui.tsx';
import { useAthlete } from '../context/athlete-state.ts';

interface ReviewRow {
  key: string;
  activity: Activity;
  include: boolean;
  warnings: string[];
}

export function DataPage() {
  useDocumentTitle('Daten');
  const {
    ready,
    storageError,
    activities,
    allLoaded,
    profile,
    updateProfile,
    stravaSettings,
    updateStravaSettings,
    stravaTokens,
    setStravaTokens,
    notice,
    setNotice,
    commitImport,
    updateActivity,
    removeActivity,
    clearActivities,
    disconnectStrava,
    clearAllLocal,
  } = useAthlete();
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState('');
  const [problems, setProblems] = useState<{ file: string; message: string }[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [review, setReview] = useState<ReviewRow[] | null>(null);
  const [message, setMessage] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [visible, setVisible] = useState(40);
  const redirectUri = stravaRedirectUri();
  const loadedById = useMemo(() => new Map(allLoaded.map((activity) => [activity.id, activity])), [allLoaded]);

  async function ingest(files: File[]) {
    if (files.length === 0) return;
    setParsing(true);
    setProgress('Dateien werden gelesen …');
    setProblems([]);
    setNotes([]);
    try {
      const batch = await parseFiles(files, (done, total) => setProgress(`${done} von ${total} Dateien gelesen …`));
      setProblems(batch.problems);
      setNotes(batch.notes);
      setReview(batch.drafts.map((draft: ParsedDraft) => ({
        key: draft.activity.id,
        activity: draft.activity,
        include: Boolean(draft.activity.startTime),
        warnings: draft.warnings,
      })));
      setMessage(batch.drafts.length === 0 ? 'Keine Aktivität erkannt.' : `${batch.drafts.length} Aktivitäten zur Prüfung.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Import fehlgeschlagen.');
    } finally {
      setParsing(false);
      setProgress('');
    }
  }

  function updateRow(key: string, activity: Activity, include = true) {
    setReview((rows) => rows?.map((row) => (row.key === key ? { ...row, activity, include: include && Boolean(activity.startTime) } : row)) ?? null);
  }

  function confirmReview() {
    if (!review) return;
    const result = commitImport(review.map((row) => ({ activity: row.activity, include: row.include && Boolean(row.activity.startTime) })));
    setMessage(`${result.added} neu übernommen, ${result.merged} mit vorhandenen zusammengeführt.`);
    setReview(null);
  }

  async function connectStrava() {
    if (!/^\d{1,12}$/.test(stravaSettings.clientId)) {
      setMessage('Trag zuerst die Client-ID ein. Ohne sie startet kein Strava-Login.');
      return;
    }
    try {
      await beginStravaLogin(stravaSettings.clientId);
    } catch (error) {
      setMessage(error instanceof StravaError ? error.message : 'Der Strava-Login konnte nicht gestartet werden.');
    }
  }

  async function syncStrava() {
    if (!stravaTokens) return;
    setSyncing(true);
    setMessage('Strava wird abgefragt …');
    try {
      const fresh = await refreshStravaTokens(stravaSettings, stravaTokens);
      setStravaTokens(fresh);
      const raw = await fetchStravaActivities(fresh.accessToken, (count) => setMessage(`${count} Aktivitäten von Strava gelesen …`));
      const mapped = mapStravaActivities(raw);
      const result = commitImport(mapped.map((draft) => ({ activity: draft.activity, include: true })));
      const cap = raw.length >= 4000 ? ' Es wurden höchstens 4000 Aktivitäten geholt.' : '';
      setMessage(raw.length === 0
        ? 'Strava hat keine Aktivitäten zurückgegeben.'
        : `${result.added} neu, ${result.merged} zusammengeführt.${cap}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Der Abruf ist fehlgeschlagen.');
    } finally {
      setSyncing(false);
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(activities, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pacemates-aktivitaeten.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">Lokal im Browser</p>
          <h1>Datenquellen</h1>
          <p>Dateien sind der verlässliche Weg. Strava funktioniert erst mit deiner eigenen API-Anwendung. Garmin läuft über den Export, nicht über einen Login.</p>
        </div>
      </header>
      {storageError ? <p className="note note-warn">{storageError}</p> : null}
      {notice ? <p className="note" role="status">{notice} <button type="button" className="btn btn-small" onClick={() => setNotice(null)}>Schließen</button></p> : null}
      {message ? <p className="status" role="status">{message}</p> : null}

      <section className="card" id="dateien">
        <h2>Dateien importieren</h2>
        <p>GPX, TCX, FIT, CSV oder ein ZIP daraus. Mehrere Dateien auf einmal sind möglich. Vor dem Speichern siehst du, was erkannt wurde.</p>
        <label
          className={dragOver ? 'drop dragover' : 'drop'}
          onDragOver={(event) => {
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragOver(false);
            void ingest([...event.dataTransfer.files]);
          }}
        >
          <input
            type="file"
            multiple
            accept=".gpx,.tcx,.fit,.csv,.zip,.gz,application/gpx+xml"
            onChange={(event) => {
              const files = [...(event.target.files ?? [])];
              event.target.value = '';
              void ingest(files);
            }}
          />
          <span>{parsing ? progress || 'Lesen …' : 'Dateien auswählen oder hier ablegen'}</span>
          <em>Die Dateien verlassen diesen Browser nicht.</em>
        </label>
        {problems.map((problem) => <p key={`${problem.file}-${problem.message}`} className="note note-warn">{problem.file}: {problem.message}</p>)}
        {notes.map((note) => <p key={note} className="meta">{note}</p>)}
        {review ? (
          <div className="review">
            <div className="row-actions">
              <button type="button" className="btn btn-primary" onClick={confirmReview}>
                {review.filter((row) => row.include).length} übernehmen
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setReview(null)}>Verwerfen</button>
              <button type="button" className="btn btn-small" onClick={() => setReview(review.map((row) => ({ ...row, include: Boolean(row.activity.startTime) })))}>Alle auswählen</button>
              <button type="button" className="btn btn-small" onClick={() => setReview(review.map((row) => ({ ...row, include: false })))}>Keine auswählen</button>
            </div>
            <div className="table-wrap review-table">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Übernehmen</th>
                    <th scope="col">Start</th>
                    <th scope="col">Name</th>
                    <th scope="col">Sport</th>
                    <th scope="col">Distanz</th>
                    <th scope="col">Dauer</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {review.map((row) => {
                    const match = activities.find((activity) => isSameActivity(activity, row.activity));
                    return (
                      <tr key={row.key}>
                        <td><input type="checkbox" checked={row.include} aria-label={`Übernehmen: ${row.activity.name}`} onChange={(event) => updateRow(row.key, row.activity, event.target.checked)} /></td>
                        <td>
                          <input
                            type="datetime-local"
                            value={toDatetimeLocalValue(row.activity.startTime)}
                            aria-label={`Startzeit für ${row.activity.name}`}
                            onChange={(event) => updateRow(row.key, withStartTime(row.activity, fromDatetimeLocalValue(event.target.value)))}
                          />
                        </td>
                        <td><input value={row.activity.name} aria-label={`Name für ${row.activity.name}`} onChange={(event) => updateRow(row.key, { ...row.activity, name: event.target.value })} /></td>
                        <td>
                          <select
                            value={row.activity.sport}
                            aria-label={`Sportart für ${row.activity.name}`}
                            onChange={(event) => updateRow(row.key, applySportOverride(row.activity, event.target.value as Sport))}
                          >
                            {SPORT_ORDER.map((sport) => <option key={sport} value={sport}>{sportLabel(sport)}</option>)}
                          </select>
                        </td>
                        <td className="num">{formatDistance(row.activity.distanceM)}</td>
                        <td className="num">{formatDuration(row.activity.durationSec)}</td>
                        <td>
                          {match ? `Führt mit „${match.name}“ zusammen` : 'Neu'}
                          {row.warnings.map((warning) => <span key={warning} className="meta">{warning}</span>)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      <section className="card" id="strava">
        <h2>Strava</h2>
        <p>Lege unter <a href="https://www.strava.com/settings/api" target="_blank" rel="noreferrer">strava.com/settings/api</a> eine API-Anwendung an. Als Authorization Callback Domain trägst du die Domain dieser PaceMates-Seite ein. Die genaue Rückleitungs-URL steht unten und muss in der Anwendung erlaubt sein.</p>
        <label className="field">
          <span>Rückleitungs-URL</span>
          <input readOnly value={redirectUri} onFocus={(event) => event.target.select()} />
        </label>
        <button
          type="button"
          className="btn btn-small"
          onClick={() => {
            void navigator.clipboard?.writeText(redirectUri).then(() => setCopied(true)).catch(() => setCopied(false));
          }}
        >
          {copied ? 'Kopiert' : 'URL kopieren'}
        </button>
        <div className="form-grid">
          <label className="field">
            <span>Client-ID</span>
            <input inputMode="numeric" autoComplete="off" value={stravaSettings.clientId} onChange={(event) => updateStravaSettings({ clientId: event.target.value.replace(/\D/g, '').slice(0, 12) })} />
          </label>
          <label className="field">
            <span>Client Secret, nur lokal</span>
            <input type={showSecret ? 'text' : 'password'} autoComplete="off" value={stravaSettings.clientSecret} onChange={(event) => updateStravaSettings({ clientSecret: event.target.value })} />
            <button type="button" className="btn btn-small" onClick={() => setShowSecret((value) => !value)}>{showSecret ? 'Verbergen' : 'Anzeigen'}</button>
          </label>
        </div>
        <p className="note">Strava tauscht den Code nur mit Client Secret. PaceMates schickt zusätzlich PKCE mit, der Token-Endpunkt akzeptiert den Tausch derzeit aber nicht ohne Secret. Das Secret bleibt im lokalen Speicher dieses Browsers und gehört nicht ins Repository. Auf einem geteilten Rechner solltest du es nicht eintragen.</p>
        {!stravaSettings.clientId ? <p className="note">Ohne Client-ID bleibt der Button untätig. Eine Verbindung wird nicht vorgetäuscht.</p> : null}
        {stravaSettings.clientId && !stravaSettings.clientSecret ? <p className="note note-warn">Ohne lokal gespeichertes Secret wird Strava den Token-Tausch ablehnen. Der Login bei Strava kann trotzdem starten.</p> : null}
        <div className="row-actions">
          <button type="button" className="btn btn-primary" onClick={() => void connectStrava()} disabled={!stravaSettings.clientId}>Mit Strava verbinden</button>
          {stravaTokens ? <button type="button" className="btn btn-ghost" onClick={() => void syncStrava()} disabled={syncing}>{syncing ? 'Holt …' : 'Aktivitäten holen'}</button> : null}
          {stravaTokens ? <button type="button" className="btn btn-ghost" onClick={disconnectStrava}>Verbindung trennen</button> : null}
        </div>
        {stravaTokens ? (
          <p className="meta">
            {stravaTokens.athleteLabel ? `Verbunden als ${stravaTokens.athleteLabel}. ` : 'Token gespeichert. '}
            Zugang gültig bis {formatDateTime(new Date(stravaTokens.expiresAt * 1000).toISOString())}.
            {stravaTokens.scope ? ` Freigabe: ${stravaTokens.scope}.` : ''}
          </p>
        ) : <p className="meta">Nicht verbunden.</p>}
        <p className="meta">Ohne API geht der Export aus Strava: In den Profileinstellungen kannst du deine Daten anfordern. Die ZIP enthält activities.csv und GPX-Dateien. Beides kannst du oben ablegen. Doppelte Einheiten werden zusammengeführt.</p>
      </section>

      <section className="card" id="garmin">
        <h2>Garmin</h2>
        <h3>Was jetzt funktioniert</h3>
        <p>Exportiere Aktivitäten aus Garmin Connect als FIT, GPX oder TCX und importiere sie oben. Ein ZIP mit mehreren Dateien geht auch. FIT ist oft die vollständigste Datei, weil Puls, Leistung und manchmal ein TSS mitkommen.</p>
        <h3>So kommst du an die Datei</h3>
        <p>Öffne die Aktivität in Garmin Connect und suche den Export, oft über das Zahnrad, als Original-FIT, GPX oder TCX. Für viele Einheiten auf einmal gibt es in den Kontoeinstellungen einen Datenexport. Die Menüs ändert Garmin gelegentlich. Entscheidend ist die Datei.</p>
        <h3>Was nicht geht</h3>
        <p>Die Garmin Connect Developer API und die Consumer Data API sind nicht offen. Zugang läuft über Garmins Entwicklerprogramm und ist hier nicht eingebaut. Es gibt keinen Garmin-Login, und eine Anmeldung wird nicht vorgetäuscht.</p>
      </section>

      <section className="card" id="bibliothek">
        <h2>Bibliothek</h2>
        {!ready ? <p className="status">Aktivitäten werden gelesen …</p> : null}
        <label className="check">
          <input type="checkbox" checked={profile.includeCommutes} onChange={(event) => updateProfile({ includeCommutes: event.target.checked })} />
          Pendelfahrten in den Auswertungen mitzählen
        </label>
        <p className="meta">{activities.length} gespeicherte Aktivitäten. Die Auswertungen nutzen {profile.includeCommutes ? 'alle' : 'alle außer Pendeln'}.</p>
        <div className="row-actions">
          <button type="button" className="btn btn-ghost" onClick={exportJson} disabled={activities.length === 0}>JSON exportieren</button>
          {confirmClear ? (
            <>
              <span>Alle Aktivitäten löschen?</span>
              <button type="button" className="btn btn-danger" onClick={() => { clearActivities(); setConfirmClear(false); setMessage('Alle Aktivitäten sind gelöscht.'); }}>Ja, löschen</button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmClear(false)}>Abbrechen</button>
            </>
          ) : (
            <button type="button" className="btn btn-danger" onClick={() => setConfirmClear(true)} disabled={activities.length === 0}>Alle Aktivitäten löschen</button>
          )}
          <button type="button" className="btn btn-ghost" onClick={clearAllLocal}>Name, Strava und Aktivitäten löschen</button>
        </div>
        <ul className="activity-list">
          {allLoaded.slice(0, visible).map((activity) => {
            const loaded = loadedById.get(activity.id) ?? activity;
            return (
              <li key={activity.id} className="activity">
                <SportMark sport={activity.sport} />
                <div className="activity-main">
                  <strong>{activity.name}</strong>
                  <p className="meta">
                    {formatDateTime(activity.startTime)}
                    {' · '}{formatDuration(activity.durationSec)}
                    {activity.distanceM > 0 ? ` · ${formatDistance(activity.distanceM)}` : ''}
                    {activity.avgHr ? ` · HF ${Math.round(activity.avgHr)}` : ''}
                    {' · '}{methodLabel(loaded.loadMethod)}
                    {activity.commute ? ' · Pendeln' : ''}
                    {' · '}{activity.sources.map((source) => source.kind === 'strava' ? 'Strava' : source.label).join(', ')}
                  </p>
                  <p className="meta">{loaded.loadNote}</p>
                </div>
                <div className="row-actions">
                  <label>
                    <span className="sr-only">Sportart für {activity.name}</span>
                    <select value={activity.sport} onChange={(event) => updateActivity(activity.id, { sport: event.target.value as Sport })}>
                      {SPORT_ORDER.map((sport) => <option key={sport} value={sport}>{sportLabel(sport)}</option>)}
                    </select>
                  </label>
                  <button type="button" className="btn btn-small" onClick={() => removeActivity(activity.id)}>Löschen</button>
                </div>
              </li>
            );
          })}
        </ul>
        {visible < allLoaded.length ? <button type="button" className="btn btn-ghost" onClick={() => setVisible((count) => count + 40)}>Weitere zeigen</button> : null}
      </section>
    </>
  );
}
