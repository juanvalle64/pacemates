import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ActivityIndex, applySportOverride, withStartTime } from '../lib/activity.ts';
import { backupFileName, buildBackup } from '../lib/backup.ts';
import { fromDatetimeLocalValue, toDatetimeLocalValue } from '../lib/dates.ts';
import { formatDateTime, formatDistance, formatDuration, methodLabel } from '../lib/format.ts';
import { parseFiles } from '../lib/parse/files.ts';
import { SPORT_ORDER, sportLabel } from '../lib/sport.ts';
import { useDocumentTitle } from '../lib/theme.ts';
import type { Activity, AthleteProfile, ParsedDraft, Sport } from '../lib/types.ts';
import { StravaPanel } from '../components/StravaPanel.tsx';
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
    notice,
    setNotice,
    commitImport,
    updateActivity,
    removeActivity,
    clearActivities,
    clearAllLocal,
  } = useAthlete();
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState('');
  const [problems, setProblems] = useState<{ file: string; message: string }[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [review, setReview] = useState<ReviewRow[] | null>(null);
  const [message, setMessage] = useState('');
  const [confirmClear, setConfirmClear] = useState<'activities' | 'all' | null>(null);
  const [visible, setVisible] = useState(40);
  const [backupProfile, setBackupProfile] = useState<AthleteProfile | null>(null);
  const [applyBackupProfile, setApplyBackupProfile] = useState(true);
  const [justImported, setJustImported] = useState(false);
  const libraryIndex = useMemo(() => new ActivityIndex(activities), [activities]);
  const loadedById = useMemo(() => new Map(allLoaded.map((activity) => [activity.id, activity])), [allLoaded]);

  async function ingest(files: File[]) {
    if (files.length === 0) return;
    setParsing(true);
    setProgress('Dateien werden gelesen …');
    setProblems([]);
    setNotes([]);
    setJustImported(false);
    try {
      const batch = await parseFiles(files, (done, total) => setProgress(`${done} von ${total} Dateien gelesen …`));
      setProblems(batch.problems);
      setNotes(batch.notes);
      setBackupProfile(batch.profile ?? null);
      setApplyBackupProfile(true);
      setReview(batch.drafts.map((draft: ParsedDraft) => ({
        key: draft.activity.id,
        activity: draft.activity,
        include: Boolean(draft.activity.startTime),
        warnings: draft.warnings,
      })));
      const missing = batch.drafts.filter((draft) => !draft.activity.startTime).length;
      setMessage(batch.drafts.length === 0
        ? 'Keine Aktivität erkannt. Die Gründe stehen unter dem Ablagefeld.'
        : `${batch.drafts.length} Aktivitäten erkannt. Prüf sie unten und übernimm sie.${missing > 0 ? ` ${missing} haben keine Startzeit und sind abgewählt, bis du eine einträgst.` : ''}`);
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
    if (backupProfile && applyBackupProfile) updateProfile(backupProfile);
    setMessage(`${result.added} neu übernommen, ${result.merged} mit vorhandenen zusammengeführt.${backupProfile && applyBackupProfile ? ' Modell-Eingaben aus der Sicherung übernommen.' : ''}`);
    setReview(null);
    setBackupProfile(null);
    setJustImported(result.added + result.merged > 0);
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(buildBackup(activities, profile), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = backupFileName();
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('Sicherung heruntergeladen. Sie enthält Aktivitäten und Modell-Eingaben, aber keinen Strava-Zugang.');
  }

  const selectedCount = review?.filter((row) => row.include).length ?? 0;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">Bleibt in diesem Browser</p>
          <h1 tabIndex={-1}>Datenquellen</h1>
          <p className="lead-sm">Dateien funktionieren sofort und ohne Konto. Strava geht über den Login. Garmin geht über den Export.</p>
        </div>
      </header>
      {storageError ? <p className="note note-warn" role="alert">{storageError}</p> : null}
      {notice ? (
        <div className="note note-ok" role="status">
          <p>{notice}</p>
          <div className="row-actions">
            {activities.length > 0 ? <Link className="btn btn-primary btn-small" to="/app">Zur Übersicht</Link> : null}
            <button type="button" className="btn btn-small" onClick={() => setNotice(null)}>Schließen</button>
          </div>
        </div>
      ) : null}
      <div aria-live="polite">
        {message ? <p className="status">{message}</p> : null}
        {justImported ? (
          <div className="note note-ok">
            <p>Deine Einheiten sind gespeichert. Die Auswertung steht.</p>
            <div className="row-actions">
              <Link className="btn btn-primary btn-small" to="/app">Übersicht ansehen</Link>
              <Link className="btn btn-small" to="/app/form#modell">Puls und Schwellen eintragen</Link>
            </div>
          </div>
        ) : null}
      </div>

      <nav className="jump" aria-label="Auf dieser Seite">
        <a href="#dateien">Dateien</a>
        <a href="#strava">Strava</a>
        <a href="#garmin">Garmin</a>
        <a href="#sicherung">Sicherung</a>
        <a href="#bibliothek">Bibliothek{activities.length > 0 ? ` (${activities.length})` : ''}</a>
      </nav>

      <section className="card card-primary" id="dateien" aria-labelledby="dateien-titel">
        <div className="card-head">
          <h2 id="dateien-titel">Dateien importieren</h2>
          <span className="badge badge-ok">Sofort</span>
        </div>
        <p>GPX, TCX, FIT oder CSV, einzeln, mehrere auf einmal oder als ZIP. Auch eine PaceMates-Sicherung (JSON). Vor dem Speichern siehst du, was erkannt wurde.</p>
        <label
          className={dragOver ? 'drop dragover' : parsing ? 'drop busy' : 'drop'}
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
            accept=".gpx,.tcx,.fit,.csv,.zip,.gz,.json,application/gpx+xml"
            onChange={(event) => {
              const files = [...(event.target.files ?? [])];
              event.target.value = '';
              void ingest(files);
            }}
          />
          <svg viewBox="0 0 24 24" aria-hidden="true" className="drop-icon"><path d="M12 15V4m0 0L7.5 8.5M12 4l4.5 4.5M5 15v4h14v-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <strong>{parsing ? progress || 'Lesen …' : 'Dateien auswählen'}</strong>
          <span>{parsing ? 'Große Archive brauchen ein paar Sekunden.' : 'oder hier ablegen'}</span>
          <em>Die Dateien werden in deinem Browser gelesen und nicht hochgeladen.</em>
        </label>
        {problems.length > 0 ? (
          <div className="note note-warn" role="alert">
            <p><strong>{problems.length === 1 ? 'Eine Datei' : `${problems.length} Dateien`} nicht übernommen:</strong></p>
            <ul className="plain">
              {problems.map((problem) => <li key={`${problem.file}-${problem.message}`}><strong>{problem.file}</strong>: {problem.message}</li>)}
            </ul>
          </div>
        ) : null}
        {notes.length > 0 ? (
          <details className="sub">
            <summary>{notes.length} Hinweise zum Import</summary>
            <ul className="plain meta">{notes.map((note) => <li key={note}>{note}</li>)}</ul>
          </details>
        ) : null}
        {review ? (
          <div className="review" aria-label="Vorschau vor dem Speichern">
            <h3>Vorschau: {review.length} erkannt</h3>
            <p className="meta">Korrigiere Sportart, Name oder Startzeit, falls nötig. Zeilen ohne Startzeit lassen sich erst nach dem Eintragen übernehmen, weil sie sonst keinem Tag zugeordnet werden können.</p>
            {backupProfile ? (
              <label className="check">
                <input type="checkbox" checked={applyBackupProfile} onChange={(event) => setApplyBackupProfile(event.target.checked)} />
                Modell-Eingaben aus der Sicherung übernehmen (Puls, FTP, Schwellenpace)
              </label>
            ) : null}
            <div className="row-actions">
              <button type="button" className="btn btn-primary" onClick={confirmReview} disabled={selectedCount === 0}>
                {selectedCount === 1 ? '1 Aktivität übernehmen' : `${selectedCount} Aktivitäten übernehmen`}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => { setReview(null); setBackupProfile(null); setMessage('Vorschau verworfen. Es wurde nichts gespeichert.'); }}>Verwerfen</button>
              <button type="button" className="btn btn-small" onClick={() => setReview(review.map((row) => ({ ...row, include: Boolean(row.activity.startTime) })))}>Alle auswählen</button>
              <button type="button" className="btn btn-small" onClick={() => setReview(review.map((row) => ({ ...row, include: false })))}>Keine auswählen</button>
            </div>
            <div className="table-wrap review-table">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col"><span className="sr-only">Übernehmen</span></th>
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
                    const index = libraryIndex.find(row.activity);
                    const match = index === -1 ? undefined : libraryIndex.items[index];
                    return (
                      <tr key={row.key} className={row.activity.startTime ? undefined : 'row-warn'}>
                        <td><input type="checkbox" checked={row.include} disabled={!row.activity.startTime} aria-label={`Übernehmen: ${row.activity.name}`} onChange={(event) => updateRow(row.key, row.activity, event.target.checked)} /></td>
                        <td>
                          <input
                            type="datetime-local"
                            value={toDatetimeLocalValue(row.activity.startTime)}
                            aria-label={`Startzeit für ${row.activity.name}`}
                            aria-invalid={!row.activity.startTime}
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
                          {!row.activity.startTime ? <strong className="warn-text">Startzeit fehlt</strong> : match ? `Schon da: „${match.name}“, wird ergänzt` : 'Neu'}
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
        <details className="sub">
          <summary>Woher bekomme ich die Dateien?</summary>
          <dl className="howto">
            <div>
              <dt>Garmin Connect, eine Aktivität</dt>
              <dd>Aktivität öffnen, über das Zahnrad „Original exportieren“ (FIT in einer ZIP) oder „In GPX/TCX exportieren“ wählen.</dd>
            </div>
            <div>
              <dt>Garmin Connect, alles</dt>
              <dd>Im Garmin-Konto den Datenexport anfordern. Garmin schickt einen Link zu einer großen ZIP. Darin liegen die FIT-Dateien. Lade die ZIP oder die enthaltenen Aktivitäts-ZIPs hier hoch.</dd>
            </div>
            <div>
              <dt>Strava, alles</dt>
              <dd>Einstellungen → Mein Konto → „Konto herunterladen oder löschen“ → Archiv anfordern. Die ZIP enthält <code>activities.csv</code> und die Originaldateien.</dd>
            </div>
            <div>
              <dt>Andere Uhren und Apps</dt>
              <dd>Fast jede Plattform exportiert GPX, TCX oder FIT. Je mehr die Datei enthält (Puls, Leistung), desto genauer die Belastung.</dd>
            </div>
          </dl>
          <p className="meta">Die Menüs ändern die Anbieter gelegentlich. Entscheidend ist die Datei.</p>
        </details>
      </section>

      <StravaPanel onMessage={setMessage} />

      <section className="card" id="garmin" aria-labelledby="garmin-titel">
        <div className="card-head">
          <h2 id="garmin-titel">Garmin</h2>
          <span className="badge">Über Export</span>
        </div>
        <p>Exportiere Aktivitäten aus Garmin Connect als FIT, GPX oder TCX und leg sie oben ab. FIT ist meist die vollständigste Datei, weil Puls, Leistung und manchmal ein Trainingswert mitkommen.</p>
        <p className="meta">Einen Garmin-Login gibt es nicht. Die Garmin Connect Developer API ist nur für freigegebene Partner zugänglich. PaceMates ist kein solcher Partner, und eine Anmeldung wird nicht vorgetäuscht.</p>
      </section>

      <section className="card" id="sicherung" aria-labelledby="sicherung-titel">
        <h2 id="sicherung-titel">Sicherung und Gerätewechsel</h2>
        <p>PaceMates hat kein Konto und keine Cloud. Deine Bibliothek liegt nur in diesem Browser auf diesem Gerät. Ein anderes Gerät oder ein anderer Browser sieht sie nicht. Wenn du Browserdaten löschst, ist sie weg.</p>
        <ol className="steps-inline">
          <li>Hier eine Sicherung herunterladen.</li>
          <li>Die Datei auf das andere Gerät bringen.</li>
          <li>Dort in PaceMates bei den Dateien ablegen.</li>
        </ol>
        <div className="row-actions">
          <button type="button" className="btn btn-primary" onClick={exportBackup} disabled={activities.length === 0}>Sicherung herunterladen</button>
        </div>
        <p className="meta">Die Sicherung enthält Aktivitäten, deinen Namen und die Modell-Eingaben. Strava-Zugang und Client Secret sind nicht enthalten. Bewahre die Datei auf wie andere persönliche Daten.</p>
      </section>

      <section className="card" id="bibliothek" aria-labelledby="bibliothek-titel">
        <h2 id="bibliothek-titel">Bibliothek</h2>
        {!ready ? <p className="status">Aktivitäten werden gelesen …</p> : null}
        <label className="check">
          <input type="checkbox" checked={profile.includeCommutes} onChange={(event) => updateProfile({ includeCommutes: event.target.checked })} />
          Pendelfahrten in den Auswertungen mitzählen
        </label>
        <p className="meta">{activities.length === 0 ? 'Noch keine Aktivität gespeichert.' : `${activities.length} gespeicherte Aktivitäten. Die Auswertungen nutzen ${profile.includeCommutes ? 'alle' : 'alle außer Pendeln'}.`}</p>
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
                  <button type="button" className="btn btn-small" onClick={() => removeActivity(activity.id)} aria-label={`${activity.name} löschen`}>Löschen</button>
                </div>
              </li>
            );
          })}
        </ul>
        {visible < allLoaded.length ? <button type="button" className="btn btn-ghost" onClick={() => setVisible((count) => count + 40)}>Weitere zeigen ({allLoaded.length - visible})</button> : null}
      </section>

      <section className="card card-danger" aria-labelledby="loeschen-titel">
        <h2 id="loeschen-titel">Löschen</h2>
        <p className="meta">Löschen wirkt nur in diesem Browser. Bei Strava ändert sich dadurch nichts.</p>
        {confirmClear ? (
          <div className="row-actions" role="alertdialog" aria-label="Löschen bestätigen">
            <span>{confirmClear === 'all' ? 'Name, Modell-Eingaben, Strava-Zugang und alle Aktivitäten löschen?' : 'Alle Aktivitäten löschen?'}</span>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                if (confirmClear === 'all') clearAllLocal();
                else clearActivities();
                setConfirmClear(null);
                setMessage(confirmClear === 'all' ? 'Alles in diesem Browser ist gelöscht.' : 'Alle Aktivitäten sind gelöscht.');
              }}
            >
              Ja, löschen
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmClear(null)}>Abbrechen</button>
          </div>
        ) : (
          <div className="row-actions">
            <button type="button" className="btn btn-danger" onClick={() => setConfirmClear('activities')} disabled={activities.length === 0}>Alle Aktivitäten löschen</button>
            <button type="button" className="btn btn-danger" onClick={() => setConfirmClear('all')}>Alles löschen</button>
          </div>
        )}
      </section>
    </>
  );
}
