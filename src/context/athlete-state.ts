import { createContext, useContext } from 'react';
import type { ImportSelection } from '../lib/activity.ts';
import type { Activity, AthleteProfile, DailyPoint, LoadedActivity, Sport, StravaSettings, StravaTokens } from '../lib/types.ts';

export interface AthleteState {
  ready: boolean;
  storageError: string | null;
  activities: Activity[];
  allLoaded: LoadedActivity[];
  evaluated: LoadedActivity[];
  profile: AthleteProfile;
  series: DailyPoint[];
  stravaSettings: StravaSettings;
  stravaTokens: StravaTokens | null;
  notice: string | null;
  setNotice: (notice: string | null) => void;
  updateProfile: (patch: Partial<AthleteProfile>) => void;
  updateStravaSettings: (patch: Partial<StravaSettings>) => void;
  setStravaTokens: (tokens: StravaTokens | null) => void;
  commitImport: (selection: ImportSelection[]) => { added: number; merged: number };
  updateActivity: (id: string, patch: { name?: string; sport?: Sport }) => void;
  removeActivity: (id: string) => void;
  clearActivities: () => void;
  disconnectStrava: () => void;
  clearAllLocal: () => void;
}

export const AthleteContext = createContext<AthleteState | null>(null);

export function useAthlete(): AthleteState {
  const value = useContext(AthleteContext);
  if (!value) throw new Error('Die Trainingsdaten sind hier nicht verfügbar.');
  return value;
}
