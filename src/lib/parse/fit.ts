import { Decoder, Stream } from '@garmin/fitsdk';
import { createActivity, hasSignal } from '../activity.ts';
import { normalizeSport } from '../sport.ts';
import type { ActivityLeg, ParsedDraft, Sport } from '../types.ts';
import { mean } from './geo.ts';

interface LooseMessage {
  sport?: unknown;
  subSport?: unknown;
  startTime?: unknown;
  timestamp?: unknown;
  totalElapsedTime?: unknown;
  totalTimerTime?: unknown;
  totalDistance?: unknown;
  totalAscent?: unknown;
  avgHeartRate?: unknown;
  maxHeartRate?: unknown;
  avgPower?: unknown;
  normalizedPower?: unknown;
  totalCalories?: unknown;
  trainingStressScore?: unknown;
  numLengths?: unknown;
  numActiveLengths?: unknown;
  poolLength?: unknown;
  heartRate?: unknown;
  power?: unknown;
  wktName?: unknown;
}

export interface FitLike {
  sessionMesgs?: LooseMessage[];
  lapMesgs?: LooseMessage[];
  recordMesgs?: LooseMessage[];
  workoutMesgs?: LooseMessage[];
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

const FIT_EPOCH = Date.UTC(1989, 11, 31);

function asDate(value: unknown): Date | undefined {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(FIT_EPOCH + value * 1000);
  return undefined;
}

function sportText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

function fileStem(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
}

function averageBetween(records: LooseMessage[], field: 'heartRate' | 'power', start?: Date, end?: Date): number | undefined {
  const values: number[] = [];
  for (const record of records) {
    const value = asNumber(record[field]);
    if (!value || value <= 0) continue;
    if (start && end) {
      const time = asDate(record.timestamp);
      if (!time || time < start || time > end) continue;
    }
    values.push(value);
  }
  return values.length >= 5 ? mean(values) : undefined;
}

interface LegDraft {
  sport: Exclude<Sport, 'multisport'>;
  raw: string;
  indoor: boolean;
  start?: Date;
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
}

function readSession(message: LooseMessage, records: LooseMessage[]): LegDraft | null {
  const raw = [sportText(message.sport), sportText(message.subSport)].filter(Boolean).join(' ');
  if (/transition/i.test(raw)) return null;
  const normalized = normalizeSport(raw);
  const sport = normalized.sport === 'multisport' ? 'other' : normalized.sport;
  const timer = asNumber(message.totalTimerTime);
  const elapsed = asNumber(message.totalElapsedTime);
  const durationSec = timer && timer > 0 ? timer : elapsed ?? 0;
  let distanceM = asNumber(message.totalDistance) ?? 0;
  const lengths = asNumber(message.numActiveLengths) ?? asNumber(message.numLengths);
  const pool = asNumber(message.poolLength);
  if (distanceM < 50 && lengths && pool && lengths * pool > distanceM) distanceM = lengths * pool;
  if (!hasSignal(durationSec, distanceM)) return null;
  const start = asDate(message.startTime) ?? asDate(message.timestamp);
  const end = start && elapsed ? new Date(start.getTime() + elapsed * 1000) : undefined;
  const avgHr = asNumber(message.avgHeartRate) ?? averageBetween(records, 'heartRate', start, end);
  const avgPower = asNumber(message.avgPower) ?? averageBetween(records, 'power', start, end);
  return {
    sport,
    raw,
    indoor: normalized.indoor,
    start,
    durationSec,
    elapsedSec: elapsed && timer && elapsed > timer + 30 ? elapsed : undefined,
    distanceM,
    elevationGainM: asNumber(message.totalAscent),
    avgHr,
    maxHr: asNumber(message.maxHeartRate),
    avgPower,
    normPower: asNumber(message.normalizedPower),
    calories: asNumber(message.totalCalories),
    deviceLoad: asNumber(message.trainingStressScore),
  };
}

function draftsFromLegs(legs: LegDraft[], fileName: string, workoutName?: string): ParsedDraft[] {
  const endurance = new Set(legs.map((leg) => leg.sport).filter((sport) => sport === 'run' || sport === 'bike' || sport === 'swim'));
  const combine = endurance.size >= 2;
  const groups = combine ? [legs] : legs.map((leg) => [leg]);
  return groups.flatMap((group) => {
    const sport = combine ? 'multisport' : group[0]!.sport;
    const durationSec = group.reduce((sum, leg) => sum + leg.durationSec, 0);
    const distanceM = group.reduce((sum, leg) => sum + leg.distanceM, 0);
    const starts = group.map((leg) => leg.start).filter((date): date is Date => Boolean(date)).sort((a, b) => a.getTime() - b.getTime());
    const elevations = group.map((leg) => leg.elevationGainM).filter((value): value is number => value !== undefined);
    const hrWeight = group.reduce((sum, leg) => sum + (leg.avgHr ? leg.durationSec : 0), 0);
    const hrSum = group.reduce((sum, leg) => sum + (leg.avgHr ? leg.avgHr * leg.durationSec : 0), 0);
    const deviceLoads = group.map((leg) => leg.deviceLoad).filter((value): value is number => value !== undefined && value > 0);
    const warnings: string[] = [];
    if (!starts[0]) warnings.push('FIT ohne Startzeit. Trag sie in der Vorschau ein.');
    if (!group.some((leg) => leg.raw)) warnings.push('Sportart unklar. Du kannst sie vor dem Übernehmen setzen.');
    const legsOut: ActivityLeg[] = group.map((leg) => ({
      sport: leg.sport,
      durationSec: leg.durationSec,
      distanceM: leg.distanceM,
      elevationGainM: leg.elevationGainM,
      avgHr: leg.avgHr,
      avgPower: leg.avgPower,
    }));
    return [{
      warnings,
      activity: createActivity({
        name: workoutName || fileStem(fileName) || (sport === 'multisport' ? 'Kombi' : 'Aktivität'),
        sport,
        rawType: group.map((leg) => leg.raw).filter(Boolean).join(' + '),
        indoor: group.every((leg) => leg.indoor),
        startTime: starts[0]?.toISOString() ?? '',
        durationSec,
        elapsedSec: group.reduce((sum, leg) => sum + (leg.elapsedSec ?? 0), 0) || undefined,
        distanceM,
        elevationGainM: elevations.length > 0 ? elevations.reduce((sum, value) => sum + value, 0) : undefined,
        avgHr: hrWeight > 0 ? hrSum / hrWeight : undefined,
        maxHr: group.reduce<number | undefined>((max, leg) => (leg.maxHr ? Math.max(max ?? 0, leg.maxHr) : max), undefined),
        avgPower: mean(group.flatMap((leg) => (leg.avgPower ? [leg.avgPower] : []))),
        normPower: mean(group.flatMap((leg) => (leg.normPower ? [leg.normPower] : []))),
        calories: group.reduce((sum, leg) => sum + (leg.calories ?? 0), 0) || undefined,
        deviceLoad: deviceLoads.length > 0 ? deviceLoads.reduce((sum, value) => sum + value, 0) : undefined,
        legs: legsOut,
        sources: [{ kind: 'file', label: fileName }],
      }),
    }];
  });
}

export function activitiesFromFitMessages(messages: FitLike, fileName: string): ParsedDraft[] {
  const records = messages.recordMesgs ?? [];
  const workoutName = messages.workoutMesgs
    ?.map((message) => (typeof message.wktName === 'string' ? message.wktName.trim() : ''))
    .find((name) => name.length > 0);
  const sessions = (messages.sessionMesgs ?? [])
    .map((message) => readSession(message, records))
    .filter((leg): leg is LegDraft => leg !== null);
  if (sessions.length > 0) return draftsFromLegs(sessions, fileName, workoutName);
  const laps = (messages.lapMesgs ?? [])
    .map((message) => readSession(message, records))
    .filter((leg): leg is LegDraft => leg !== null);
  return draftsFromLegs(laps, fileName, workoutName);
}

export function parseFit(bytes: Uint8Array, fileName: string): ParsedDraft[] {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const probe = Stream.fromArrayBuffer(buffer);
  if (!Decoder.isFIT(probe)) throw new Error('Das ist keine gültige FIT-Datei. Exportiere die Aktivität in Garmin Connect als Original-FIT.');
  const stream = Stream.fromArrayBuffer(buffer);
  const decoder = new Decoder(stream);
  const { messages, errors } = decoder.read();
  const drafts = activitiesFromFitMessages(messages, fileName);
  if (drafts.length === 0) {
    throw new Error(errors.length > 0
      ? 'Die FIT-Datei ist beschädigt oder unvollständig. Exportiere die Aktivität noch einmal als Original-FIT.'
      : 'In der FIT-Datei steht keine Trainingseinheit. Geräte- oder Einstellungsdateien enthalten keine Aktivität.');
  }
  return drafts;
}
