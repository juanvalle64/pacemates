import { useState } from 'react';
import { EmptyState, NoDataYet } from '../components/Ui.tsx';
import { useAthlete } from '../context/athlete-state.ts';
import { comparePreset, daysInRange, rangeFromKeys, type ComparePreset, type DateRange } from '../lib/dates.ts';
import { formatDate, formatDelta, formatDistance, formatDuration, formatLoad, formatNumber, formatRange } from '../lib/format.ts';
import { sportLabel } from '../lib/sport.ts';
import { aggregate, type Totals } from '../lib/stats.ts';
import { useDocumentTitle } from '../lib/theme.ts';
import type { Sport } from '../lib/types.ts';

const presets: { id: ComparePreset; label: string }[] = [
  { id: 'week', label: 'Woche' },
  { id: 'month', label: 'Monat' },
  { id: 'd7', label: '7 gegen 7' },
  { id: 'd28', label: '28 gegen 28' },
  { id: 'custom', label: 'Eigene Bereiche' },
];

interface Side {
  label: string;
  range: DateRange;
  totals: Totals;
}

function cell(value: string) {
  return <td className="num">{value}</td>;
}

export function Compare() {
  useDocumentTitle('Vergleich');
  const { ready, storageError, evaluated } = useAthlete();
  const [preset, setPreset] = useState<ComparePreset>('week');
  const [currentStart, setCurrentStart] = useState('');
  const [currentEnd, setCurrentEnd] = useState('');
  const [previousStart, setPreviousStart] = useState('');
  const [previousEnd, setPreviousEnd] = useState('');
  const [now] = useState(() => new Date());
  if (storageError) return <EmptyState level={1} title="Speicher nicht verfügbar" body={storageError} />;
  if (!ready) return <p className="status">Aktivitäten werden gelesen …</p>;
  if (evaluated.length === 0) {
    return (
      <NoDataYet title="Noch nichts zu vergleichen" body="Hier stellst du zwei Zeiträume nebeneinander: diese Woche gegen die letzte, Monat gegen Monat oder frei gewählt. Dafür braucht es importierte Einheiten." />
    );
  }
  let current: Side | null = null;
  let previous: Side | null = null;
  let customError = '';
  if (preset === 'custom') {
    const left = rangeFromKeys(currentStart, currentEnd);
    const right = rangeFromKeys(previousStart, previousEnd);
    if (!left || !right) customError = 'Beide Bereiche brauchen ein Start- und ein Enddatum, das Start liegt vor dem Ende.';
    else {
      current = { label: 'Zeitraum A', range: left, totals: aggregate(evaluated, left) };
      previous = { label: 'Zeitraum B', range: right, totals: aggregate(evaluated, right) };
    }
  } else {
    const pair = comparePreset(preset, now);
    current = { label: pair.current.label, range: pair.current, totals: aggregate(evaluated, pair.current) };
    previous = { label: pair.previous.label, range: pair.previous, totals: aggregate(evaluated, pair.previous) };
  }
  const last = evaluated[0] ? formatDate(evaluated[0].startTime) : '';
  const bothEmpty = current && previous && current.totals.activities === 0 && previous.totals.activities === 0;
  const oneEmpty = current && previous && (current.totals.activities === 0 || previous.totals.activities === 0);

  const rows: { label: string; current: string; previous: string; delta: string }[] = [];
  if (current && previous) {
    const add = (label: string, left: number, right: number, format: (value: number) => string) => {
      rows.push({ label, current: format(left), previous: format(right), delta: formatDelta(left, right, format) });
    };
    add('Zeit', current.totals.durationSec, previous.totals.durationSec, formatDuration);
    add('Distanz', current.totals.distanceM, previous.totals.distanceM, formatDistance);
    add('Einheiten', current.totals.activities, previous.totals.activities, (value) => formatNumber(value));
    add('Aktive Tage', current.totals.activeDays, previous.totals.activeDays, (value) => formatNumber(value));
    const consistency = (totals: Totals) => (totals.days > 0 ? (totals.activeDays / totals.days) * 100 : 0);
    add('Anteil aktiver Tage', consistency(current.totals), consistency(previous.totals), (value) => `${formatNumber(value, 0)} %`);
    add('Belastung', current.totals.load, previous.totals.load, formatLoad);
    if (current.totals.loadPerHour !== undefined || previous.totals.loadPerHour !== undefined) {
      add('Belastung pro Stunde', current.totals.loadPerHour ?? 0, previous.totals.loadPerHour ?? 0, formatLoad);
    }
    if (current.totals.elevationM !== undefined || previous.totals.elevationM !== undefined) {
      rows.push({
        label: 'Höhenmeter',
        current: current.totals.elevationM === undefined ? 'keine Höhendaten' : formatNumber(current.totals.elevationM, 0),
        previous: previous.totals.elevationM === undefined ? 'keine Höhendaten' : formatNumber(previous.totals.elevationM, 0),
        delta: current.totals.elevationM === undefined || previous.totals.elevationM === undefined
          ? '–'
          : formatDelta(current.totals.elevationM, previous.totals.elevationM, (value) => formatNumber(value, 0)),
      });
    }
    const sports: Sport[] = ['run', 'bike', 'swim', 'multisport'];
    for (const sport of sports) {
      const left = current.totals.bySport[sport];
      const right = previous.totals.bySport[sport];
      if (left.activities === 0 && right.activities === 0 && left.durationSec === 0 && right.durationSec === 0) continue;
      add(`${sportLabel(sport)}, Zeit`, left.durationSec, right.durationSec, formatDuration);
      add(`${sportLabel(sport)}, Distanz`, left.distanceM, right.distanceM, formatDistance);
    }
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1 tabIndex={-1}>Vergleich</h1>
          <p>Unterschied = linker Zeitraum minus rechter Zeitraum. Mehr Umfang ist hier nicht als besser markiert.</p>
        </div>
      </header>
      <div className="chip-row" role="group" aria-label="Vergleichsart">
        {presets.map((item) => (
          <button key={item.id} type="button" className={preset === item.id ? 'chip active' : 'chip'} aria-pressed={preset === item.id} onClick={() => setPreset(item.id)}>{item.label}</button>
        ))}
      </div>
      {preset === 'week' ? <p className="note">Die laufende Woche ist noch nicht vollständig. Die Vorwoche schon.</p> : null}
      {preset === 'month' ? <p className="note">Der laufende Monat ist noch nicht vollständig. Der Vormonat schon.</p> : null}
      {preset === 'custom' ? (
        <div className="form-grid">
          <fieldset className="field">
            <legend>Zeitraum A</legend>
            <label>Start <input type="date" value={currentStart} onChange={(event) => setCurrentStart(event.target.value)} /></label>
            <label>Ende <input type="date" value={currentEnd} onChange={(event) => setCurrentEnd(event.target.value)} /></label>
          </fieldset>
          <fieldset className="field">
            <legend>Zeitraum B</legend>
            <label>Start <input type="date" value={previousStart} onChange={(event) => setPreviousStart(event.target.value)} /></label>
            <label>Ende <input type="date" value={previousEnd} onChange={(event) => setPreviousEnd(event.target.value)} /></label>
          </fieldset>
        </div>
      ) : null}
      {customError ? <p className="note note-warn">{customError}</p> : null}
      {current && previous ? (
        <>
          {bothEmpty ? <p className="note">In beiden Zeiträumen liegen keine Aktivitäten. Die letzte importierte Einheit ist vom {last}.</p> : null}
          {oneEmpty && !bothEmpty ? <p className="note">Eine Seite hat keine Aktivitäten. Das ist ein leerer Zeitraum, kein Leistungsanstieg.</p> : null}
          <div className="table-wrap">
            <table className="data-table compare">
              <thead>
                <tr>
                  <th scope="col">Kennzahl</th>
                  <th scope="col">{current.label}<span>{formatRange(current.range.start, current.range.end)} · {daysInRange(current.range)} Tage</span></th>
                  <th scope="col">Unterschied</th>
                  <th scope="col">{previous.label}<span>{formatRange(previous.range.start, previous.range.end)} · {daysInRange(previous.range)} Tage</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    {cell(row.current)}
                    {cell(row.delta)}
                    {cell(row.previous)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </>
  );
}
