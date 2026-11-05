import { createActivity, hasSignal } from '../activity.ts';
import { normalizeSport } from '../sport.ts';
import type { ActivityLeg, ParsedDraft, Sport } from '../types.ts';
import { elevationGain, haversine, mean } from './geo.ts';
import { byLocal, childText, firstNumber, inside, nestedNumber, numberFrom, parseXml } from './xml.ts';

interface LegDraft {
  sport: Exclude<Sport, 'multisport'>;
  rawType: string;
  indoor: boolean;
  start?: string;
  durationSec: number;
  elapsedSec?: number;
  distanceM: number;
  elevationGainM?: number;
  avgHr?: number;
  maxHr?: number;
  avgPower?: number;
  calories?: number;
}

function fileStem(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
}

function readLeg(activity: Element): LegDraft {
  const rawType = activity.getAttribute('Sport') ?? childText(activity, 'Sport') ?? '';
  const normalized = normalizeSport(rawType);
  const sport = normalized.sport === 'multisport' ? 'other' : normalized.sport;
  const laps = byLocal(activity, 'Lap');
  const points = byLocal(activity, 'Trackpoint');
  let durationSec = 0;
  let distanceM = 0;
  let calories = 0;
  const lapHr: { seconds: number; hr: number }[] = [];
  const lapPower: number[] = [];
  let maxHr: number | undefined;
  for (const lap of laps) {
    const seconds = nestedDirect(lap, 'TotalTimeSeconds');
    const distance = nestedDirect(lap, 'DistanceMeters');
    const lapCalories = nestedDirect(lap, 'Calories');
    if (seconds) durationSec += seconds;
    if (distance) distanceM += distance;
    if (lapCalories) calories += lapCalories;
    const hr = nestedNumber(lap, 'AverageHeartRateBpm');
    const lapMax = nestedNumber(lap, 'MaximumHeartRateBpm');
    if (hr && seconds) lapHr.push({ seconds, hr });
    if (lapMax) maxHr = Math.max(maxHr ?? 0, lapMax);
    const watts = firstNumber(lap, 'AvgWatts') ?? firstNumber(lap, 'Watts');
    if (watts && watts > 0) lapPower.push(watts);
  }
  const hrs: number[] = [];
  const powers: number[] = [];
  const elevations: number[] = [];
  const coords: { lat: number; lon: number; time?: number }[] = [];
  let lastDistance: number | undefined;
  for (const point of points) {
    const hr = nestedNumber(point, 'HeartRateBpm');
    if (hr && hr > 30 && hr < 240) hrs.push(hr);
    const watts = firstNumber(point, 'Watts');
    if (watts && watts > 0 && watts < 2500) powers.push(watts);
    const altitude = nestedDirect(point, 'AltitudeMeters');
    if (altitude !== undefined) elevations.push(altitude);
    const distance = nestedDirect(point, 'DistanceMeters');
    if (distance !== undefined) lastDistance = distance;
    const lat = numberFrom(byLocal(point, 'LatitudeDegrees')[0]?.textContent ?? undefined);
    const lon = numberFrom(byLocal(point, 'LongitudeDegrees')[0]?.textContent ?? undefined);
    const time = childText(point, 'Time');
    if (lat !== undefined && lon !== undefined) {
      coords.push({ lat, lon, time: time ? Date.parse(time) : undefined });
    }
  }
  if (distanceM <= 0 && lastDistance) distanceM = lastDistance;
  if (distanceM <= 0 && coords.length > 1) {
    for (let index = 1; index < coords.length; index += 1) {
      const segment = haversine(coords[index - 1]!.lat, coords[index - 1]!.lon, coords[index]!.lat, coords[index]!.lon);
      const dt = coords[index]?.time && coords[index - 1]?.time ? (coords[index]!.time! - coords[index - 1]!.time!) / 1000 : undefined;
      const speed = dt && dt > 0 ? segment / dt : undefined;
      if (speed === undefined || speed <= 50) distanceM += segment;
    }
  }
  const times = points
    .map((point) => childText(point, 'Time'))
    .filter((value): value is string => Boolean(value))
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value));
  const elapsed = times.length > 1 ? Math.max(0, (times[times.length - 1]! - times[0]!) / 1000) : 0;
  if (durationSec <= 0) durationSec = elapsed;
  const weightedHr = lapHr.reduce((sum, item) => sum + item.hr * item.seconds, 0);
  const weight = lapHr.reduce((sum, item) => sum + item.seconds, 0);
  const avgHr = hrs.length >= 5 ? mean(hrs) : weight > 0 ? weightedHr / weight : undefined;
  const avgPower = powers.length >= 5 ? mean(powers) : mean(lapPower);
  const idText = childText(activity, 'Id');
  const start = idText && Number.isFinite(Date.parse(idText))
    ? new Date(idText).toISOString()
    : times[0] !== undefined ? new Date(times[0]).toISOString() : undefined;
  return {
    sport,
    rawType,
    indoor: normalized.indoor,
    start,
    durationSec,
    elapsedSec: elapsed > durationSec + 30 ? elapsed : undefined,
    distanceM,
    elevationGainM: elevationGain(elevations),
    avgHr,
    maxHr: hrs.length > 0 ? Math.max(maxHr ?? 0, ...hrs) : maxHr,
    avgPower,
    calories: calories > 0 ? calories : undefined,
  };
}

function nestedDirect(element: Element, localName: string): number | undefined {
  const text = childText(element, localName);
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toActivity(legs: LegDraft[], fileName: string, forcedName?: string): ParsedDraft | null {
  const usable = legs.filter((leg) => hasSignal(leg.durationSec, leg.distanceM));
  if (usable.length === 0) return null;
  const endurance = new Set(usable.map((leg) => leg.sport).filter((sport) => sport === 'run' || sport === 'bike' || sport === 'swim'));
  const sport = endurance.size >= 2 ? 'multisport' : usable[0]!.sport;
  const durationSec = usable.reduce((sum, leg) => sum + leg.durationSec, 0);
  const distanceM = usable.reduce((sum, leg) => sum + leg.distanceM, 0);
  const elevations = usable.map((leg) => leg.elevationGainM).filter((value): value is number => value !== undefined);
  const activityLegs: ActivityLeg[] = usable.map((leg) => ({
    sport: leg.sport,
    durationSec: leg.durationSec,
    distanceM: leg.distanceM,
    elevationGainM: leg.elevationGainM,
    avgHr: leg.avgHr,
    avgPower: leg.avgPower,
  }));
  const weightedHr = usable.reduce((sum, leg) => sum + (leg.avgHr && leg.durationSec > 0 ? leg.avgHr * leg.durationSec : 0), 0);
  const hrWeight = usable.reduce((sum, leg) => sum + (leg.avgHr && leg.durationSec > 0 ? leg.durationSec : 0), 0);
  const starts = usable.map((leg) => leg.start).filter((value): value is string => Boolean(value)).sort();
  const warnings: string[] = [];
  if (!starts[0]) warnings.push('TCX ohne Startzeit. Trag sie in der Vorschau ein.');
  if (!usable.some((leg) => leg.rawType)) warnings.push('Sportart unklar. Du kannst sie vor dem Übernehmen setzen.');
  return {
    warnings,
    activity: createActivity({
      name: forcedName || fileStem(fileName) || (sport === 'multisport' ? 'Kombi' : 'Aktivität'),
      sport,
      rawType: usable.map((leg) => leg.rawType).filter(Boolean).join(' + '),
      indoor: usable.every((leg) => leg.indoor),
      startTime: starts[0] ?? '',
      durationSec,
      elapsedSec: usable.reduce((sum, leg) => sum + (leg.elapsedSec ?? 0), 0) || undefined,
      distanceM,
      elevationGainM: elevations.length > 0 ? elevations.reduce((sum, value) => sum + value, 0) : undefined,
      avgHr: hrWeight > 0 ? weightedHr / hrWeight : undefined,
      maxHr: usable.reduce<number | undefined>((max, leg) => (leg.maxHr ? Math.max(max ?? 0, leg.maxHr) : max), undefined),
      avgPower: mean(usable.flatMap((leg) => (leg.avgPower ? [leg.avgPower] : []))),
      calories: usable.reduce((sum, leg) => sum + (leg.calories ?? 0), 0) || undefined,
      legs: activityLegs,
      sources: [{ kind: 'file', label: fileName }],
    }),
  };
}

export function parseTcx(text: string, fileName: string): ParsedDraft[] {
  const doc = parseXml(text);
  const drafts: ParsedDraft[] = [];
  for (const session of byLocal(doc, 'MultiSportSession')) {
    const legs = byLocal(session, 'Activity').map(readLeg);
    const draft = toActivity(legs, fileName);
    if (draft) drafts.push(draft);
  }
  for (const activity of byLocal(doc, 'Activity')) {
    if (inside(activity, 'MultiSportSession')) continue;
    const notes = childText(activity, 'Notes');
    const draft = toActivity([readLeg(activity)], fileName, notes);
    if (draft) drafts.push(draft);
  }
  if (drafts.length === 0) throw new Error('Keine TCX-Aktivität erkannt.');
  return drafts;
}
