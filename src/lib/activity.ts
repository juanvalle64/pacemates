import { sportsCompatible } from './sport.ts';
import type { Activity, ActivityLeg, ActivitySource, Sport } from './types.ts';

export function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
}

export function cleanName(value: string): string {
  let cleaned = '';
  for (const char of value) cleaned += char.charCodeAt(0) < 32 ? ' ' : char;
  return cleaned.replace(/\s+/g, ' ').trim().slice(0, 140);
}

export function buildDedupeKey(startTime: string, durationSec: number, distanceM: number): string {
  const time = Date.parse(startTime);
  const minute = Number.isFinite(time) ? String(Math.round(time / 60_000)) : startTime;
  return `${minute}|${Math.round(durationSec)}|${Math.round(distanceM)}`;
}

export interface ActivityInput {
  id?: string;
  name: string;
  sport: Sport;
  sportLocked?: boolean;
  rawType?: string;
  indoor?: boolean;
  commute?: boolean;
  startTime: string;
  durationSec: number;
  elapsedSec?: number;
  distanceM: number;
  elevationGainM?: number;
  avgHr?: number;
  maxHr?: number;
  avgPower?: number;
  normPower?: number;
  calories?: number;
  deviceLoad?: number;
  legs?: ActivityLeg[];
  sources: ActivitySource[];
  importedAt?: string;
}

function finite(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return value;
}

function positive(value: number | undefined): number | undefined {
  const number = finite(value);
  if (number === undefined || number <= 0) return undefined;
  return number;
}

function defaultLeg(input: ActivityInput): ActivityLeg {
  const sport = input.sport === 'multisport' ? 'other' : input.sport;
  return {
    sport,
    durationSec: Math.max(0, input.durationSec || 0),
    distanceM: Math.max(0, input.distanceM || 0),
    elevationGainM: finite(input.elevationGainM),
    avgHr: positive(input.avgHr),
    avgPower: positive(input.avgPower),
  };
}

export function createActivity(input: ActivityInput): Activity {
  const durationSec = Math.max(0, finite(input.durationSec) ?? 0);
  const distanceM = Math.max(0, finite(input.distanceM) ?? 0);
  const startTime = input.startTime;
  const activity: Activity = {
    id: input.id ?? newId(),
    dedupeKey: '',
    name: cleanName(input.name) || 'Aktivität',
    sport: input.sport,
    sportLocked: input.sportLocked ?? false,
    rawType: input.rawType?.trim() ?? '',
    indoor: input.indoor ?? false,
    commute: input.commute ?? false,
    startTime,
    durationSec,
    elapsedSec: positive(input.elapsedSec),
    distanceM,
    elevationGainM: finite(input.elevationGainM),
    avgHr: positive(input.avgHr),
    maxHr: positive(input.maxHr),
    avgPower: positive(input.avgPower),
    normPower: positive(input.normPower),
    calories: positive(input.calories),
    deviceLoad: positive(input.deviceLoad),
    legs: input.legs && input.legs.length > 0 ? input.legs : [defaultLeg({ ...input, durationSec, distanceM })],
    sources: input.sources.length > 0 ? input.sources : [{ kind: 'file', label: 'Import' }],
    importedAt: input.importedAt ?? new Date().toISOString(),
  };
  activity.dedupeKey = buildDedupeKey(activity.startTime, activity.durationSec, activity.distanceM);
  return activity;
}

export function hasSignal(durationSec: number, distanceM: number): boolean {
  return durationSec > 0 || distanceM > 0;
}

function externalIds(activity: Activity): string[] {
  return activity.sources.flatMap((source) => (source.externalId ? [source.externalId] : []));
}

function relClose(a: number, b: number, ratio: number, slack: number): boolean {
  const diff = Math.abs(a - b);
  return diff <= slack || diff <= Math.max(a, b) * ratio;
}

function durations(activity: Activity): number[] {
  return [activity.durationSec, activity.elapsedSec].filter((value): value is number => typeof value === 'number' && value > 0);
}

export function isSameActivity(a: Activity, b: Activity): boolean {
  const idsA = externalIds(a);
  const idsB = externalIds(b);
  if (idsA.some((id) => idsB.includes(id))) return true;
  const stravaA = idsA.filter((id) => id.startsWith('strava:'));
  const stravaB = idsB.filter((id) => id.startsWith('strava:'));
  if (stravaA.length > 0 && stravaB.length > 0) return false;
  if (!sportsCompatible(a.sport, b.sport)) return false;
  const startA = Date.parse(a.startTime);
  const startB = Date.parse(b.startTime);
  if (!Number.isFinite(startA) || !Number.isFinite(startB)) return false;
  if (Math.abs(startA - startB) > 3 * 60_000) return false;
  const durationA = durations(a);
  const durationB = durations(b);
  if (durationA.length === 0 || durationB.length === 0) return false;
  const durationMatches = durationA.some((left) => durationB.some((right) => relClose(left, right, 0.08, 60)));
  if (!durationMatches) return false;
  if (a.distanceM > 0 && b.distanceM > 0 && !relClose(a.distanceM, b.distanceM, 0.08, 200)) return false;
  return true;
}

function preferPositive(primary: number | undefined, fallback: number | undefined): number | undefined {
  if (primary !== undefined && primary > 0) return primary;
  if (fallback !== undefined && fallback > 0) return fallback;
  return primary ?? fallback;
}

function mergeSources(existing: ActivitySource[], incoming: ActivitySource[]): ActivitySource[] {
  const merged = [...existing];
  for (const source of incoming) {
    const duplicate = merged.some((item) => {
      if (item.externalId && source.externalId) return item.externalId === source.externalId;
      return item.kind === source.kind && item.label === source.label;
    });
    if (!duplicate) merged.push(source);
  }
  return merged;
}

function looksGeneric(activity: Activity): boolean {
  const name = activity.name.trim().toLowerCase().replace(/\.[^.]+$/, '');
  if (!name || name === 'aktivität') return true;
  return activity.sources.some((source) => {
    const label = source.label.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim().toLowerCase();
    return label.length > 0 && label === name;
  });
}

function pickName(existing: Activity, incoming: Activity): string {
  if (looksGeneric(existing) && !looksGeneric(incoming)) return incoming.name;
  if (!looksGeneric(existing)) return existing.name;
  return incoming.name || existing.name;
}

export function mergeActivities(existing: Activity, incoming: Activity): Activity {
  let sport = existing.sport;
  let legs = existing.legs;
  let sportLocked = existing.sportLocked;
  if (existing.sportLocked) {
    sport = existing.sport;
    legs = existing.legs;
    sportLocked = true;
  } else if (incoming.sportLocked) {
    sport = incoming.sport;
    legs = incoming.legs;
    sportLocked = true;
  } else if (existing.sport === 'other' && incoming.sport !== 'other') {
    sport = incoming.sport;
    legs = incoming.legs.length > 0 ? incoming.legs : existing.legs;
  } else if (incoming.sport === 'multisport' && incoming.legs.length > 1 && existing.sport !== 'multisport') {
    sport = 'multisport';
    legs = incoming.legs;
  }
  const durationSec = preferPositive(existing.durationSec, incoming.durationSec) ?? 0;
  const distanceM = preferPositive(existing.distanceM, incoming.distanceM) ?? 0;
  const startTime = existing.startTime || incoming.startTime;
  return {
    ...existing,
    name: pickName(existing, incoming),
    sport,
    sportLocked,
    rawType: existing.rawType || incoming.rawType,
    indoor: existing.indoor || incoming.indoor,
    commute: existing.commute || incoming.commute,
    startTime,
    durationSec,
    elapsedSec: preferPositive(existing.elapsedSec, incoming.elapsedSec),
    distanceM,
    elevationGainM: existing.elevationGainM ?? incoming.elevationGainM,
    avgHr: preferPositive(existing.avgHr, incoming.avgHr),
    maxHr: preferPositive(existing.maxHr, incoming.maxHr),
    avgPower: preferPositive(existing.avgPower, incoming.avgPower),
    normPower: preferPositive(existing.normPower, incoming.normPower),
    calories: preferPositive(existing.calories, incoming.calories),
    deviceLoad: preferPositive(existing.deviceLoad, incoming.deviceLoad),
    legs,
    sources: mergeSources(existing.sources, incoming.sources),
    importedAt: existing.importedAt <= incoming.importedAt ? existing.importedAt : incoming.importedAt,
    dedupeKey: buildDedupeKey(startTime, durationSec, distanceM),
  };
}

const BUCKET_MS = 3 * 60_000;

/**
 * Schneller Abgleich für große Bibliotheken. Kandidaten kommen aus der externen ID
 * oder aus dem Startzeit-Fenster von ±3 Minuten. Entschieden wird weiter mit isSameActivity.
 */
export class ActivityIndex {
  readonly items: Activity[];
  private byExternal = new Map<string, number>();
  private byBucket = new Map<number, Set<number>>();

  constructor(list: Activity[] = []) {
    this.items = [];
    for (const activity of list) this.add(activity);
  }

  private bucket(activity: Activity): number | undefined {
    const time = Date.parse(activity.startTime);
    return Number.isFinite(time) ? Math.floor(time / BUCKET_MS) : undefined;
  }

  private register(index: number): void {
    const activity = this.items[index]!;
    for (const id of externalIds(activity)) this.byExternal.set(id, index);
    const bucket = this.bucket(activity);
    if (bucket === undefined) return;
    const set = this.byBucket.get(bucket) ?? new Set<number>();
    set.add(index);
    this.byBucket.set(bucket, set);
  }

  private unregister(index: number): void {
    const activity = this.items[index]!;
    for (const id of externalIds(activity)) if (this.byExternal.get(id) === index) this.byExternal.delete(id);
    const bucket = this.bucket(activity);
    if (bucket !== undefined) this.byBucket.get(bucket)?.delete(index);
  }

  find(activity: Activity): number {
    for (const id of externalIds(activity)) {
      const hit = this.byExternal.get(id);
      if (hit !== undefined) return hit;
    }
    const bucket = this.bucket(activity);
    if (bucket === undefined) return -1;
    const candidates: number[] = [];
    for (const offset of [-1, 0, 1]) {
      for (const index of this.byBucket.get(bucket + offset) ?? []) candidates.push(index);
    }
    candidates.sort((a, b) => a - b);
    return candidates.find((index) => isSameActivity(this.items[index]!, activity)) ?? -1;
  }

  add(activity: Activity): number {
    this.items.push(activity);
    const index = this.items.length - 1;
    this.register(index);
    return index;
  }

  replace(index: number, activity: Activity): void {
    this.unregister(index);
    this.items[index] = activity;
    this.register(index);
  }

  /** Fügt hinzu oder führt zusammen. Gibt zurück, was passiert ist. */
  upsert(activity: Activity): 'added' | 'merged' {
    const index = this.find(activity);
    if (index === -1) {
      this.add(activity);
      return 'added';
    }
    this.replace(index, mergeActivities(this.items[index]!, activity));
    return 'merged';
  }
}

export function collapseDuplicates(list: Activity[]): Activity[] {
  const index = new ActivityIndex();
  for (const activity of list) index.upsert(activity);
  return index.items;
}

export function applySportOverride(activity: Activity, sport: Sport): Activity {
  if (sport === 'multisport') return { ...activity, sport, sportLocked: true };
  return {
    ...activity,
    sport,
    sportLocked: true,
    legs: [{
      sport,
      durationSec: activity.durationSec,
      distanceM: activity.distanceM,
      elevationGainM: activity.elevationGainM,
      avgHr: activity.avgHr,
      avgPower: activity.avgPower,
    }],
  };
}

export function withStartTime(activity: Activity, startTime: string): Activity {
  return {
    ...activity,
    startTime,
    dedupeKey: buildDedupeKey(startTime, activity.durationSec, activity.distanceM),
  };
}

export interface ImportSelection {
  activity: Activity;
  include: boolean;
}

export function applyImport(existing: Activity[], selection: ImportSelection[]): { activities: Activity[]; added: number; merged: number } {
  const chosen = collapseDuplicates(selection.filter((item) => item.include && item.activity.startTime).map((item) => item.activity));
  const index = new ActivityIndex(existing);
  let added = 0;
  let merged = 0;
  for (const activity of chosen) {
    if (index.upsert(activity) === 'added') added += 1;
    else merged += 1;
  }
  return { activities: index.items, added, merged };
}
