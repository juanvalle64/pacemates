import { addDays, localDateKey, localDaySpan, parseDateKey } from './dates.ts';
import type { DailyPoint, LoadedActivity } from './types.ts';

export function buildSeries(activities: LoadedActivity[], now = new Date()): DailyPoint[] {
  const dated = activities.filter((activity) => Number.isFinite(Date.parse(activity.startTime)));
  if (dated.length === 0) return [];
  let earliest = new Date(dated[0]!.startTime);
  const byDay = new Map<string, { load: number; durationSec: number; distanceM: number; elevationM: number; elevationKnown: boolean; activities: number }>();
  for (const activity of dated) {
    const date = new Date(activity.startTime);
    if (date < earliest) earliest = date;
    const key = localDateKey(date);
    const bucket = byDay.get(key) ?? { load: 0, durationSec: 0, distanceM: 0, elevationM: 0, elevationKnown: false, activities: 0 };
    bucket.load += activity.load;
    bucket.durationSec += activity.durationSec;
    bucket.distanceM += activity.distanceM;
    bucket.activities += 1;
    if (activity.elevationGainM !== undefined) {
      bucket.elevationKnown = true;
      bucket.elevationM += activity.elevationGainM;
    }
    byDay.set(key, bucket);
  }
  const start = parseDateKey(localDateKey(earliest));
  const end = parseDateKey(localDateKey(now));
  const last = end < start ? start : end;
  const totalDays = localDaySpan(start, last);
  const points: DailyPoint[] = [];
  let ctl = 0;
  let atl = 0;
  for (let index = 0; index <= totalDays; index += 1) {
    const date = localDateKey(addDays(start, index));
    const bucket = byDay.get(date);
    const load = bucket?.load ?? 0;
    const tsb = ctl - atl;
    ctl += (load - ctl) / 42;
    atl += (load - atl) / 7;
    points.push({
      date,
      load,
      durationSec: bucket?.durationSec ?? 0,
      distanceM: bucket?.distanceM ?? 0,
      elevationM: bucket?.elevationM ?? 0,
      elevationKnown: bucket?.elevationKnown ?? false,
      activities: bucket?.activities ?? 0,
      ctl,
      atl,
      tsb,
    });
  }
  return points;
}

export function historyDays(series: DailyPoint[]): number {
  if (series.length === 0) return 0;
  return series.length;
}
