import { createActivity } from './activity.ts';
import { sanitizeProfile } from './storage.ts';
import type { Activity, ActivityLeg, ActivitySource, AthleteProfile, ParsedDraft, Sport } from './types.ts';

/**
 * Sicherung der Bibliothek als JSON. Das ist der Weg, Daten auf ein anderes Gerät
 * zu bringen: Datei exportieren, dort importieren. Es gibt keine Cloud dazwischen.
 * Strava-Zugang und Client Secret kommen nie in die Sicherung.
 */
export const BACKUP_FORMAT = 'pacemates-backup';
export const BACKUP_VERSION = 1;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  profile: AthleteProfile;
  activities: Activity[];
}

export function buildBackup(activities: Activity[], profile: AthleteProfile, now = new Date()): Backup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    profile: sanitizeProfile(profile),
    activities,
  };
}

export function backupFileName(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `pacemates-sicherung-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

const SPORTS: Sport[] = ['run', 'bike', 'swim', 'multisport', 'other'];

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function str(value: unknown, max = 200): string | undefined {
  return typeof value === 'string' ? value.slice(0, max) : undefined;
}

function readLegs(value: unknown): ActivityLeg[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const legs = value.flatMap((item): ActivityLeg[] => {
    if (!item || typeof item !== 'object') return [];
    const leg = item as Record<string, unknown>;
    const sport = SPORTS.includes(leg.sport as Sport) && leg.sport !== 'multisport' ? leg.sport as ActivityLeg['sport'] : 'other';
    return [{
      sport,
      durationSec: Math.max(0, num(leg.durationSec) ?? 0),
      distanceM: Math.max(0, num(leg.distanceM) ?? 0),
      elevationGainM: num(leg.elevationGainM),
      avgHr: num(leg.avgHr),
      avgPower: num(leg.avgPower),
    }];
  });
  return legs.length > 0 ? legs : undefined;
}

function readSources(value: unknown): ActivitySource[] {
  if (!Array.isArray(value)) return [{ kind: 'file', label: 'Sicherung' }];
  const sources = value.flatMap((item): ActivitySource[] => {
    if (!item || typeof item !== 'object') return [];
    const source = item as Record<string, unknown>;
    const kind = source.kind === 'strava' ? 'strava' : 'file';
    const externalId = str(source.externalId, 80);
    return [{ kind, label: str(source.label, 120) || (kind === 'strava' ? 'Strava' : 'Sicherung'), externalId: externalId || undefined }];
  });
  return sources.length > 0 ? sources : [{ kind: 'file', label: 'Sicherung' }];
}

function readActivity(value: unknown): Activity | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const startTime = str(raw.startTime, 40);
  if (!startTime || !Number.isFinite(Date.parse(startTime))) return null;
  const durationSec = num(raw.durationSec) ?? 0;
  const distanceM = num(raw.distanceM) ?? 0;
  if (durationSec <= 0 && distanceM <= 0) return null;
  const sport = SPORTS.includes(raw.sport as Sport) ? raw.sport as Sport : 'other';
  return createActivity({
    id: str(raw.id, 80),
    name: str(raw.name, 140) ?? 'Aktivität',
    sport,
    sportLocked: raw.sportLocked === true,
    rawType: str(raw.rawType, 60),
    indoor: raw.indoor === true,
    commute: raw.commute === true,
    startTime: new Date(startTime).toISOString(),
    durationSec,
    elapsedSec: num(raw.elapsedSec),
    distanceM,
    elevationGainM: num(raw.elevationGainM),
    avgHr: num(raw.avgHr),
    maxHr: num(raw.maxHr),
    avgPower: num(raw.avgPower),
    normPower: num(raw.normPower),
    calories: num(raw.calories),
    deviceLoad: num(raw.deviceLoad),
    legs: readLegs(raw.legs),
    sources: readSources(raw.sources),
    importedAt: str(raw.importedAt, 40),
  });
}

export interface ParsedBackup {
  drafts: ParsedDraft[];
  profile?: AthleteProfile;
  skipped: number;
  exportedAt?: string;
}

export function looksLikeBackup(text: string): boolean {
  const head = text.trimStart().slice(0, 200);
  return head.startsWith('[') || head.includes(BACKUP_FORMAT);
}

/** Liest eine PaceMates-Sicherung. Ältere Exporte als reine Liste werden auch erkannt. */
export function parseBackup(text: string): ParsedBackup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Die JSON-Datei ist beschädigt oder unvollständig.');
  }
  let list: unknown[];
  let profile: AthleteProfile | undefined;
  let exportedAt: string | undefined;
  if (Array.isArray(data)) {
    list = data;
  } else if (data && typeof data === 'object' && (data as Record<string, unknown>).format === BACKUP_FORMAT) {
    const backup = data as Record<string, unknown>;
    if (typeof backup.version === 'number' && backup.version > BACKUP_VERSION) {
      throw new Error('Diese Sicherung stammt aus einer neueren PaceMates-Version.');
    }
    list = Array.isArray(backup.activities) ? backup.activities : [];
    profile = backup.profile ? sanitizeProfile(backup.profile) : undefined;
    exportedAt = str(backup.exportedAt, 40);
  } else {
    throw new Error('Das ist keine PaceMates-Sicherung.');
  }
  const activities = list.map(readActivity);
  const drafts = activities.filter((item): item is Activity => item !== null).map((activity) => ({ activity, warnings: [] }));
  if (drafts.length === 0) throw new Error('Die Sicherung enthält keine lesbare Aktivität.');
  return { drafts, profile, skipped: activities.length - drafts.length, exportedAt };
}
