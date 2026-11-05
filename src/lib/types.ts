export type Sport = 'run' | 'bike' | 'swim' | 'multisport' | 'other';

export type LoadMethod = 'trimp' | 'tss' | 'pace' | 'duration';

export interface ActivityLeg {
  sport: Exclude<Sport, 'multisport'>;
  durationSec: number;
  distanceM: number;
  elevationGainM?: number;
  avgHr?: number;
  avgPower?: number;
}

export interface ActivitySource {
  kind: 'file' | 'strava';
  label: string;
  externalId?: string;
}

export interface Activity {
  id: string;
  dedupeKey: string;
  name: string;
  sport: Sport;
  sportLocked: boolean;
  rawType: string;
  indoor: boolean;
  commute: boolean;
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
  legs: ActivityLeg[];
  sources: ActivitySource[];
  importedAt: string;
}

export interface LoadedActivity extends Activity {
  load: number;
  loadMethod: LoadMethod;
  loadNote: string;
}

export interface AthleteProfile {
  name: string;
  maxHr?: number;
  restHr?: number;
  trimpK: number;
  ftp?: number;
  runThresholdPaceSec?: number;
  swimThresholdPaceSec?: number;
  includeCommutes: boolean;
}

export interface StravaSettings {
  clientId: string;
  clientSecret: string;
}

export interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  athleteLabel?: string;
  scope?: string;
  /** Über welchen Weg das Token geholt wurde. Ältere Einträge ohne Angabe gelten als eigene API-Anwendung. */
  via?: 'hosted' | 'own';
}

export interface DailyPoint {
  date: string;
  load: number;
  durationSec: number;
  distanceM: number;
  elevationM: number;
  elevationKnown: boolean;
  activities: number;
  ctl: number;
  atl: number;
  tsb: number;
}

export interface ParsedDraft {
  activity: Activity;
  warnings: string[];
}

export interface ParseProblem {
  file: string;
  message: string;
}

export interface ParseBatch {
  drafts: ParsedDraft[];
  problems: ParseProblem[];
  notes: string[];
  /** Modell-Eingaben aus einer PaceMates-Sicherung, falls vorhanden. */
  profile?: AthleteProfile;
}

export const defaultProfile: AthleteProfile = {
  name: '',
  trimpK: 1.92,
  includeCommutes: true,
};
