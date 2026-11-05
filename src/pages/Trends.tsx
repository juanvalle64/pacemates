import { useState } from 'react';
import { Link } from 'react-router';
import { StackedBars } from '../components/Charts.tsx';
import { SPORT_COLOR } from '../lib/colors.ts';
import { EmptyState } from '../components/Ui.tsx';
import { useAthlete } from '../context/athlete-state.ts';
import { presetRange, type RangePreset } from '../lib/dates.ts';
import { formatDate, formatDateKey, formatDuration, formatLoad, formatNumber, formatPercent, formatRange } from '../lib/format.ts';
import { SPORT_ORDER, sportLabel } from '../lib/sport.ts';
import { splitProgress, weeklyBuckets } from '../lib/stats.ts';
import { useDocumentTitle } from '../lib/theme.ts';
import type { Sport } from '../lib/types.ts';

const ranges: { id: RangePreset; label: string }[] = [
  { id: '90', label: '90 Tage' },
  { id: '365', label: '1 Jahr' },
  { id: 'all', label: 'Gesamt' },
];

export function Trends() {
  useDocumentTitle('Trends');
  const { ready, storageError, evaluated } = useAthlete();
  const [preset, setPreset] = useState<RangePreset>('all');
  const [sport, setSport] = useState<Sport | 'all'>('all');
  const [now] = useState(() => new Date());
  if (storageError) return <EmptyState title="Speicher nicht verfügbar" body={storageError} />;
  if (!ready) return <p className="status">Aktivitäten werden gelesen …</p>;
  if (evaluated.length === 0) {
    return (
      <EmptyState title="Noch kein Verlauf" body="Trends erscheinen, sobald mindestens eine echte Aktivität importiert ist.">
        <Link className="btn btn-primary" to="/app/daten">Daten hinzufügen</Link>
      </EmptyState>
    );
  }
  const earliest = new Date(Math.min(...evaluated.map((activity) => Date.parse(activity.startTime))));
  const range = presetRange(preset, now, earliest);
  if (!range) return null;
  const visible = weeklyBuckets(evaluated, range, sport, now);
  const progress = splitProgress(visible);
  const available = SPORT_ORDER.filter((item) => evaluated.some((activity) => activity.sport === item || activity.legs.some((leg) => leg.sport === item)));
  const hourChange = progress && progress.firstHours > 0 ? (progress.secondHours - progress.firstHours) / progress.firstHours : null;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="kicker">Verlauf</p>
          <h1>Trends</h1>
          <p>{formatRange(range.start, range.end)}</p>
        </div>
        <div className="chip-row" role="group" aria-label="Zeitraum">
          {ranges.map((item) => (
            <button key={item.id} type="button" className={preset === item.id ? 'chip active' : 'chip'} aria-pressed={preset === item.id} onClick={() => setPreset(item.id)}>{item.label}</button>
          ))}
        </div>
      </header>
      <div className="chip-row" role="group" aria-label="Sportart">
        <button type="button" className={sport === 'all' ? 'chip active' : 'chip'} aria-pressed={sport === 'all'} onClick={() => setSport('all')}>Alle</button>
        {available.map((item) => (
          <button key={item} type="button" className={sport === item ? 'chip active' : 'chip'} aria-pressed={sport === item} onClick={() => setSport(item)}>{sportLabel(item)}</button>
        ))}
      </div>
      {visible.every((week) => week.activities === 0) ? (
        <EmptyState title="In diesem Ausschnitt liegt nichts" body="Wähle einen längeren Zeitraum oder eine andere Sportart." />
      ) : (
        <>
          {progress && hourChange !== null ? (
            <p className="note">
              {Math.abs(hourChange) < 0.05
                ? `Die zweite Hälfte der Wochen liegt nah an der ersten: ${formatDuration(progress.secondHours * 3600)} gegen ${formatDuration(progress.firstHours * 3600)}.`
                : `In der zweiten Hälfte der Wochen liegt die Zeit ${formatPercent(hourChange * 100)} gegenüber der ersten (${formatDuration(progress.secondHours * 3600)} gegen ${formatDuration(progress.firstHours * 3600)}). Die Belastung liegt bei ${formatLoad(progress.secondLoad)} gegen ${formatLoad(progress.firstLoad)}.`}
            </p>
          ) : (
            <p className="note">Für einen Vergleich der beiden Hälften braucht es mindestens vier Wochen mit Einheiten im gewählten Ausschnitt.</p>
          )}
          <section className="card">
            <h2>Zeit pro Woche</h2>
            <StackedBars
              label="Wochenzeit nach Sportart"
              formatValue={formatDuration}
              rows={visible.map((week) => ({
                label: formatDateKey(week.start, false),
                segments: SPORT_ORDER.map((item) => ({ key: item, label: sportLabel(item), value: week.bySport[item], color: SPORT_COLOR[item] })),
              }))}
            />
          </section>
          <section className="card">
            <h2>Belastung pro Woche</h2>
            <StackedBars
              label="Wochenbelastung"
              formatValue={formatLoad}
              rows={visible.map((week) => ({
                label: formatDateKey(week.start, false),
                segments: [{ key: 'load', label: 'Belastung', value: week.load, color: 'var(--ctl)' }],
              }))}
            />
          </section>
          <section className="card">
            <h2>Intensität pro Woche</h2>
            <p className="meta">Belastung geteilt durch Stunden. Wochen ohne Einheit fehlen in dieser Reihe.</p>
            <StackedBars
              label="Belastung pro Stunde"
              formatValue={(value) => formatNumber(value, 0)}
              rows={visible.filter((week) => week.durationSec > 0).map((week) => ({
                label: formatDateKey(week.start, false),
                segments: [{ key: 'intensity', label: 'pro Stunde', value: week.load / (week.durationSec / 3600), color: 'var(--ember)' }],
              }))}
            />
          </section>
          <p className="meta">Letzte dargestellte Woche beginnt am {formatDate(visible[visible.length - 1]?.start)}. Tage ohne Einheit bleiben in der Wochenzeit als Lücke sichtbar.</p>
        </>
      )}
    </>
  );
}
