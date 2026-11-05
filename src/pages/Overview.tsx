import { useState } from 'react';
import { Link } from 'react-router';
import { StackedBars } from '../components/Charts.tsx';
import { SPORT_COLOR } from '../lib/colors.ts';
import { EmptyState, SportMark } from '../components/Ui.tsx';
import { useAthlete } from '../context/athlete-state.ts';
import { presetRange, type RangePreset } from '../lib/dates.ts';
import { formatDate, formatDateKey, formatDistance, formatDuration, formatLoad, formatMeters, formatRange, formatRunPace, formatSpeed, formatSwimPace } from '../lib/format.ts';
import { SPORT_ORDER, sportLabel } from '../lib/sport.ts';
import { aggregate, weeklyBuckets } from '../lib/stats.ts';
import { useDocumentTitle } from '../lib/theme.ts';
import type { LoadedActivity, Sport } from '../lib/types.ts';

const ranges: { id: RangePreset; label: string }[] = [
  { id: '7', label: '7 Tage' },
  { id: '28', label: '28 Tage' },
  { id: '90', label: '90 Tage' },
  { id: '365', label: '1 Jahr' },
  { id: 'all', label: 'Gesamt' },
];

function paceLine(activity: LoadedActivity): string | undefined {
  const moving = activity.durationSec;
  if (activity.sport === 'run') return formatRunPace(moving, activity.distanceM);
  if (activity.sport === 'bike') return formatSpeed(moving, activity.distanceM);
  if (activity.sport === 'swim') return formatSwimPace(moving, activity.distanceM);
  return undefined;
}

export function Overview() {
  useDocumentTitle('Übersicht');
  const { ready, storageError, evaluated, series, profile } = useAthlete();
  const [preset, setPreset] = useState<RangePreset>('28');
  const [sport, setSport] = useState<Sport | 'all'>('all');
  const [now] = useState(() => new Date());
  const earliest = evaluated.length > 0 ? new Date(evaluated[evaluated.length - 1]!.startTime) : undefined;
  const range = presetRange(preset, now, earliest ?? undefined);
  const available = SPORT_ORDER.filter((item) => evaluated.some((activity) => activity.sport === item || activity.legs.some((leg) => leg.sport === item)));

  if (storageError) return <EmptyState title="Speicher nicht verfügbar" body={storageError} />;
  if (!ready) return <p className="status">Aktivitäten werden gelesen …</p>;
  if (evaluated.length === 0) {
    return (
      <EmptyState
        title="Noch keine Aktivitäten"
        body="PaceMates rechnet erst, wenn echte Einheiten da sind. Importiere GPX, TCX, FIT oder CSV, oder verbinde Strava, sobald eine Client-ID hinterlegt ist. Beispieldaten gibt es hier nicht."
      >
        <Link className="btn btn-primary" to="/app/daten">Daten hinzufügen</Link>
      </EmptyState>
    );
  }
  if (!range) return null;
  const totals = aggregate(evaluated, range, sport);
  const weeks = weeklyBuckets(evaluated, range, sport, now);
  const latest = series[series.length - 1];
  const history = series.length;
  const formText = !latest
    ? ''
    : history < 28
      ? 'Die Zeitreihe ist noch kurz. Die Zahl beschreibt vor allem den Start bei null.'
      : latest.tsb >= 15
        ? 'Erholt gegenüber der letzten Belastung.'
        : latest.tsb >= -10
          ? 'Nahe am Gleichgewicht.'
          : 'Ermüdet gegenüber der Fitness.';
  const commuteHidden = !profile.includeCommutes;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">{profile.name || 'Dein Training'}</p>
          <h1>Übersicht</h1>
          <p>{formatRange(range.start, range.end)}</p>
        </div>
        <div className="chip-row" role="group" aria-label="Zeitraum">
          {ranges.map((item) => (
            <button key={item.id} type="button" className={preset === item.id ? 'chip active' : 'chip'} aria-pressed={preset === item.id} onClick={() => setPreset(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
      </header>
      {commuteHidden ? <p className="note">Pendelfahrten sind aus den Summen ausgenommen.</p> : null}
      <div className="chip-row" role="group" aria-label="Sportart">
        <button type="button" className={sport === 'all' ? 'chip active' : 'chip'} aria-pressed={sport === 'all'} onClick={() => setSport('all')}>Alle</button>
        {available.map((item) => (
          <button key={item} type="button" className={sport === item ? 'chip active' : 'chip'} aria-pressed={sport === item} onClick={() => setSport(item)}>
            {sportLabel(item)}
          </button>
        ))}
      </div>
      {totals.activities === 0 ? (
        <EmptyState title="In diesem Ausschnitt liegt nichts" body="Für die gewählte Sportart und den Zeitraum gibt es keine importierte Einheit. Der übrige Bestand bleibt erhalten.">
          <button type="button" className="btn btn-ghost" onClick={() => { setPreset('all'); setSport('all'); }}>Alles zeigen</button>
        </EmptyState>
      ) : (
        <>
          <section className="stat-grid" aria-label="Kennzahlen">
            <article className="stat"><span>Zeit</span><strong className="num">{formatDuration(totals.durationSec)}</strong></article>
            <article className="stat"><span>Distanz</span><strong className="num">{formatDistance(totals.distanceM)}</strong></article>
            <article className="stat"><span>Einheiten</span><strong className="num">{totals.activities}</strong></article>
            <article className="stat"><span>Belastung</span><strong className="num">{formatLoad(totals.load)}</strong></article>
            <article className="stat"><span>Aktive Tage</span><strong className="num">{totals.activeDays}<em> von {totals.days}</em></strong></article>
            <article className="stat"><span>Höhenmeter</span><strong className="num">{formatMeters(totals.elevationM)}</strong></article>
          </section>
          {sport === 'all' ? (
            <section className="card">
              <h2>Anteil der Sportarten</h2>
              <ul className="legend">
                {SPORT_ORDER.filter((item) => totals.bySport[item].durationSec > 0).map((item) => (
                  <li key={item}><SportMark sport={item} />{sportLabel(item)}</li>
                ))}
              </ul>
              <div className="stack-bar" aria-hidden="true">
                {SPORT_ORDER.map((item) => {
                  const share = totals.durationSec > 0 ? totals.bySport[item].durationSec / totals.durationSec : 0;
                  if (share <= 0) return null;
                  return <span key={item} style={{ width: `${share * 100}%`, background: SPORT_COLOR[item] }} />;
                })}
              </div>
              <ul className="split">
                {SPORT_ORDER.filter((item) => totals.bySport[item].durationSec > 0).map((item) => (
                  <li key={item}>
                    <SportMark sport={item} />
                    <span>{sportLabel(item)}</span>
                    <strong className="num">{formatDuration(totals.bySport[item].durationSec)}</strong>
                    <em className="num">{formatDistance(totals.bySport[item].distanceM)}</em>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {latest ? (
            <section className="card card-accent">
              <h2>Form</h2>
              <div className="stat-grid compact">
                <article className="stat"><span>Fitness, CTL</span><strong className="num">{formatLoad(latest.ctl)}</strong></article>
                <article className="stat"><span>Ermüdung, ATL</span><strong className="num">{formatLoad(latest.atl)}</strong></article>
                <article className="stat"><span>Form heute früh, TSB</span><strong className="num">{formatLoad(latest.tsb)}</strong></article>
              </div>
              <p>{formText} {history < 42 ? 'Stabiler wird das Modell nach etwa 42 Tagen.' : `Die Historie umfasst ${history} Tage.`}</p>
              <p className="meta">Fitness und Ermüdung schließen den heutigen Tag ein. Die Form ist der Wert vor der heutigen Belastung. Die gesamte importierte Historie zählt, nicht nur der gewählte Zeitraum.</p>
              <Link to="/app/form">Form im Detail</Link>
            </section>
          ) : null}
          <section className="card">
            <h2>Stunden pro Woche</h2>
            <StackedBars
              label={`Wochenstunden von ${formatDate(range.start, false)} bis ${formatDate(range.end, false)}`}
              formatValue={(value) => formatDuration(value)}
              rows={weeks.map((week) => ({
                label: formatDateKey(week.start, false),
                segments: SPORT_ORDER.map((item) => ({
                  key: item,
                  label: sportLabel(item),
                  value: week.bySport[item],
                  color: SPORT_COLOR[item],
                })),
              }))}
            />
          </section>
          <section className="card">
            <h2>Letzte Einheiten</h2>
            <ul className="activity-list">
              {evaluated.filter((activity) => {
                const time = Date.parse(activity.startTime);
                return time >= range.start.getTime() && time <= range.end.getTime() && (sport === 'all' || activity.sport === sport || activity.legs.some((leg) => leg.sport === sport));
              }).slice(0, 8).map((activity) => (
                <li key={activity.id} className="activity">
                  <SportMark sport={activity.sport} />
                  <div>
                    <strong>{activity.name}</strong>
                    <p className="meta">
                      {sportLabel(activity.sport)}
                      {activity.indoor ? ' · Indoor' : ''}
                      {activity.commute ? ' · Pendeln' : ''}
                      {' · '}{formatDate(activity.startTime)}
                      {' · '}{formatDuration(activity.durationSec)}
                      {activity.distanceM > 0 ? ` · ${formatDistance(activity.distanceM)}` : ''}
                      {paceLine(activity) ? ` · ${paceLine(activity)}` : ''}
                      {activity.avgHr ? ` · HF ${Math.round(activity.avgHr)}` : ''}
                    </p>
                  </div>
                  <em className="num">{formatLoad(activity.load)} {activity.loadMethod === 'duration' ? 'Proxy' : activity.loadMethod === 'trimp' ? 'TRIMP' : activity.loadMethod === 'tss' ? 'TSS' : 'Pace'}</em>
                </li>
              ))}
            </ul>
            <Link to="/app/daten">Alle Einheiten</Link>
          </section>
        </>
      )}
    </>
  );
}
