import { localDaySpan } from './dates.ts';
import { formatDate, formatNumber } from './format.ts';
import type { DailyPoint, LoadedActivity, LoadMethod } from './types.ts';

export const MODEL_WARMUP_DAYS = 42;
export const STALE_AFTER_DAYS = 10;

export interface FormReading {
  tone: 'stale' | 'building' | 'fresh' | 'balanced' | 'tired' | 'very-tired';
  title: string;
  body: string;
}

function latestStart(activities: LoadedActivity[]): Date | undefined {
  let latest = Number.NEGATIVE_INFINITY;
  for (const activity of activities) {
    const time = Date.parse(activity.startTime);
    if (Number.isFinite(time) && time > latest) latest = time;
  }
  return Number.isFinite(latest) ? new Date(latest) : undefined;
}

/**
 * Ordnet die Form ein, ohne mehr zu behaupten, als die Daten tragen.
 * Liegt die letzte Einheit zu lange zurück, gibt es keine Aussage über Erholung.
 */
export function readForm(series: DailyPoint[], activities: LoadedActivity[], now = new Date()): FormReading | null {
  const point = series[series.length - 1];
  const last = latestStart(activities);
  if (!point || !last) return null;
  const daysSince = Math.max(0, localDaySpan(last, now));
  if (daysSince > STALE_AFTER_DAYS) {
    return {
      tone: 'stale',
      title: 'Keine aktuelle Aussage',
      body: `Die letzte importierte Einheit ist vom ${formatDate(last)}, vor ${formatNumber(daysSince)} Tagen. Fehlende Tage zählen mit Belastung 0. Ob du erholt bist, lässt sich daraus nicht ablesen. Hol erst die fehlenden Einheiten.`,
    };
  }
  if (series.length < MODEL_WARMUP_DAYS) {
    return {
      tone: 'building',
      title: 'Das Modell läuft sich ein',
      body: `Die Historie umfasst ${formatNumber(series.length)} von ${MODEL_WARMUP_DAYS} Tagen. Fitness und Ermüdung starten bei null und steigen anfangs auch bei gleichem Training. Ältere Einheiten zu importieren macht die Werte sofort belastbarer.`,
    };
  }
  if (point.tsb >= 15) {
    return { tone: 'fresh', title: 'Frisch', body: 'Die Ermüdung liegt deutlich unter deiner Fitness. Das passt zu einer ruhigeren Phase oder einem Tapering.' };
  }
  if (point.tsb >= -10) {
    return { tone: 'balanced', title: 'Im Gleichgewicht', body: 'Ermüdung und Fitness liegen nah beieinander. Das ist der übliche Zustand in normalen Trainingswochen.' };
  }
  if (point.tsb >= -30) {
    return { tone: 'tired', title: 'Ermüdet', body: 'Die Ermüdung liegt über deiner Fitness. Das ist in Aufbauphasen normal, solange danach leichtere Tage kommen.' };
  }
  return { tone: 'very-tired', title: 'Stark ermüdet', body: 'Die Ermüdung liegt deutlich über der Fitness. Plane bewusst leichtere Tage ein, bevor die Belastung weiter steigt.' };
}

export interface LoadMix {
  method: LoadMethod;
  count: number;
  load: number;
  share: number;
}

export function loadMix(activities: LoadedActivity[]): { items: LoadMix[]; proxyShare: number; total: number } {
  const methods: LoadMethod[] = ['trimp', 'tss', 'pace', 'duration'];
  const total = activities.reduce((sum, activity) => sum + activity.load, 0);
  const items = methods
    .map((method) => {
      const matching = activities.filter((activity) => activity.loadMethod === method);
      const load = matching.reduce((sum, activity) => sum + activity.load, 0);
      return { method, count: matching.length, load, share: total > 0 ? load / total : 0 };
    })
    .filter((item) => item.count > 0);
  return { items, proxyShare: items.find((item) => item.method === 'duration')?.share ?? 0, total };
}

/** Höchster Puls in den importierten Daten. Ein Anhaltspunkt nach unten, keine Messung der echten maximalen Herzfrequenz. */
export function highestRecordedHr(activities: LoadedActivity[]): number | undefined {
  let max = 0;
  for (const activity of activities) if (activity.maxHr && activity.maxHr > max && activity.maxHr < 240) max = activity.maxHr;
  return max > 0 ? Math.round(max) : undefined;
}
