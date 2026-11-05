import { addDays, daysInRange, isInRange, localDateKey, startOfIsoWeek, type DateRange } from './dates.ts';
import { emptySportNumbers, SPORT_ORDER } from './sport.ts';
import type { LoadedActivity, Sport } from './types.ts';

export interface SportTotals {
  activities: number;
  durationSec: number;
  distanceM: number;
  load: number;
}

export interface Totals {
  activities: number;
  activeDays: number;
  days: number;
  durationSec: number;
  distanceM: number;
  elevationM?: number;
  load: number;
  loadPerHour?: number;
  bySport: Record<Sport, SportTotals>;
}

export function emptySportTotals(): Record<Sport, SportTotals> {
  return {
    run: { activities: 0, durationSec: 0, distanceM: 0, load: 0 },
    bike: { activities: 0, durationSec: 0, distanceM: 0, load: 0 },
    swim: { activities: 0, durationSec: 0, distanceM: 0, load: 0 },
    multisport: { activities: 0, durationSec: 0, distanceM: 0, load: 0 },
    other: { activities: 0, durationSec: 0, distanceM: 0, load: 0 },
  };
}

export interface ActivitySlice {
  durationSec: number;
  distanceM: number;
  elevationM?: number;
  load: number;
}

export function sliceActivity(activity: LoadedActivity, sport: Sport | 'all'): ActivitySlice | null {
  if (sport === 'all' || (sport === 'multisport' && activity.sport === 'multisport')) {
    return {
      durationSec: activity.durationSec,
      distanceM: activity.distanceM,
      elevationM: activity.elevationGainM,
      load: activity.load,
    };
  }
  if (sport === 'multisport') return null;
  const legs = activity.legs.filter((leg) => leg.sport === sport);
  if (legs.length === 0) {
    if (activity.sport !== sport) return null;
    return {
      durationSec: activity.durationSec,
      distanceM: activity.distanceM,
      elevationM: activity.elevationGainM,
      load: activity.load,
    };
  }
  const durationSec = legs.reduce((sum, leg) => sum + leg.durationSec, 0);
  const distanceM = legs.reduce((sum, leg) => sum + leg.distanceM, 0);
  const elevations = legs.map((leg) => leg.elevationGainM).filter((value): value is number => value !== undefined);
  const share = activity.durationSec > 0 ? durationSec / activity.durationSec : 1;
  return {
    durationSec,
    distanceM,
    elevationM: elevations.length > 0 ? elevations.reduce((sum, value) => sum + value, 0) : undefined,
    load: activity.load * Math.min(1, Math.max(0, share)),
  };
}

export function durationBySport(activity: LoadedActivity): Record<Sport, number> {
  const out = emptySportNumbers();
  if (activity.sport !== 'multisport' || activity.legs.length === 0) {
    out[activity.sport] += activity.durationSec;
    return out;
  }
  const legSum = activity.legs.reduce((sum, leg) => sum + leg.durationSec, 0);
  if (legSum <= 0) {
    out.multisport += activity.durationSec;
    return out;
  }
  if (legSum > activity.durationSec) {
    const scale = activity.durationSec / legSum;
    for (const leg of activity.legs) out[leg.sport] += leg.durationSec * scale;
    return out;
  }
  for (const leg of activity.legs) out[leg.sport] += leg.durationSec;
  const rest = activity.durationSec - legSum;
  if (rest > 30) out.multisport += rest;
  return out;
}

export function aggregate(activities: LoadedActivity[], range: DateRange, sport: Sport | 'all' = 'all'): Totals {
  const totals: Totals = {
    activities: 0,
    activeDays: 0,
    days: daysInRange(range),
    durationSec: 0,
    distanceM: 0,
    load: 0,
    bySport: emptySportTotals(),
  };
  const days = new Set<string>();
  let elevation: number | undefined;
  for (const activity of activities) {
    if (!isInRange(activity.startTime, range)) continue;
    const parts = durationBySport(activity);
    for (const key of SPORT_ORDER) {
      if (parts[key] > 0) {
        totals.bySport[key].durationSec += parts[key];
        totals.bySport[key].activities += key === activity.sport || activity.legs.some((leg) => leg.sport === key) ? 1 : 0;
      }
    }
    for (const leg of activity.legs) {
      totals.bySport[leg.sport].distanceM += leg.distanceM;
      const share = activity.durationSec > 0 ? leg.durationSec / activity.durationSec : 0;
      totals.bySport[leg.sport].load += activity.load * share;
    }
    if (activity.sport === 'multisport') {
      const legDuration = activity.legs.reduce((sum, leg) => sum + leg.durationSec, 0);
      const rest = activity.durationSec - legDuration;
      if (rest > 30) totals.bySport.multisport.load += activity.load * (rest / activity.durationSec);
    }
    const slice = sliceActivity(activity, sport);
    if (!slice) continue;
    totals.activities += 1;
    totals.durationSec += slice.durationSec;
    totals.distanceM += slice.distanceM;
    totals.load += slice.load;
    days.add(localDateKey(new Date(activity.startTime)));
    if (slice.elevationM !== undefined) elevation = (elevation ?? 0) + slice.elevationM;
  }
  totals.activeDays = days.size;
  totals.elevationM = elevation;
  if (totals.durationSec > 0) totals.loadPerHour = totals.load / (totals.durationSec / 3600);
  return totals;
}

export interface WeekBucket {
  start: string;
  durationSec: number;
  distanceM: number;
  load: number;
  activities: number;
  bySport: Record<Sport, number>;
}

export function weeklyBuckets(activities: LoadedActivity[], range: DateRange, sport: Sport | 'all', now = new Date()): WeekBucket[] {
  const first = startOfIsoWeek(range.start);
  const last = startOfIsoWeek(range.end < now ? range.end : now);
  const buckets: WeekBucket[] = [];
  const lastKey = localDateKey(last);
  for (let cursor = first; localDateKey(cursor) <= lastKey; cursor = addDays(cursor, 7)) {
    buckets.push({
      start: localDateKey(cursor),
      durationSec: 0,
      distanceM: 0,
      load: 0,
      activities: 0,
      bySport: emptySportNumbers(),
    });
  }
  const index = new Map(buckets.map((bucket, position) => [bucket.start, position]));
  for (const activity of activities) {
    if (!isInRange(activity.startTime, range)) continue;
    const slice = sliceActivity(activity, sport);
    if (!slice) continue;
    const key = localDateKey(startOfIsoWeek(new Date(activity.startTime)));
    const position = index.get(key);
    if (position === undefined) continue;
    const bucket = buckets[position]!;
    bucket.durationSec += slice.durationSec;
    bucket.distanceM += slice.distanceM;
    bucket.load += slice.load;
    bucket.activities += 1;
    if (sport === 'all') {
      const parts = durationBySport(activity);
      for (const sportKey of SPORT_ORDER) bucket.bySport[sportKey] += parts[sportKey];
    } else {
      bucket.bySport[sport] += slice.durationSec;
    }
  }
  return buckets;
}

export function splitProgress(buckets: WeekBucket[]): { firstHours: number; secondHours: number; firstLoad: number; secondLoad: number } | null {
  const active = buckets.filter((bucket) => bucket.activities > 0);
  if (buckets.length < 4 || active.length < 4) return null;
  const half = Math.floor(buckets.length / 2);
  const first = buckets.slice(0, half);
  const second = buckets.slice(half);
  if (!first.some((bucket) => bucket.activities > 0) || !second.some((bucket) => bucket.activities > 0)) return null;
  return {
    firstHours: first.reduce((sum, bucket) => sum + bucket.durationSec, 0) / 3600,
    secondHours: second.reduce((sum, bucket) => sum + bucket.durationSec, 0) / 3600,
    firstLoad: first.reduce((sum, bucket) => sum + bucket.load, 0),
    secondLoad: second.reduce((sum, bucket) => sum + bucket.load, 0),
  };
}
