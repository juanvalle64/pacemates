import { defaultProfile, type Activity, type AthleteProfile, type StravaSettings, type StravaTokens } from './types.ts';

const DB_NAME = 'pacemates';
const STORE = 'activities';
const PROFILE_KEY = 'pacemates.profile.v1';
const STRAVA_SETTINGS_KEY = 'pacemates.strava.settings.v1';
const STRAVA_TOKENS_KEY = 'pacemates.strava.tokens.v1';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Dieser Browser stellt keinen lokalen Speicher bereit.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Speicher nicht verfügbar.'));
  });
}

export async function loadActivities(): Promise<Activity[]> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).getAll();
      request.onsuccess = () => resolve((request.result as Activity[]) ?? []);
      request.onerror = () => reject(request.error ?? new Error('Aktivitäten konnten nicht gelesen werden.'));
    });
  } finally {
    db.close();
  }
}

export async function saveActivities(activities: Activity[]): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      store.clear();
      for (const activity of activities) store.put(activity);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Aktivitäten konnten nicht gespeichert werden.'));
    });
  } finally {
    db.close();
  }
}

function numberIn(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) return undefined;
  return value;
}

export function sanitizeProfile(value: unknown): AthleteProfile {
  const raw = value && typeof value === 'object' ? value as Partial<AthleteProfile> : {};
  const trimp = raw.trimpK === 1.67 ? 1.67 : 1.92;
  return {
    name: typeof raw.name === 'string' ? raw.name.trim().slice(0, 40) : '',
    maxHr: numberIn(raw.maxHr, 120, 230),
    restHr: numberIn(raw.restHr, 30, 100),
    trimpK: trimp,
    ftp: numberIn(raw.ftp, 50, 600),
    runThresholdPaceSec: numberIn(raw.runThresholdPaceSec, 150, 720),
    swimThresholdPaceSec: numberIn(raw.swimThresholdPaceSec, 45, 240),
    includeCommutes: raw.includeCommutes !== false,
  };
}

export function loadProfile(): AthleteProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return { ...defaultProfile };
    return sanitizeProfile(JSON.parse(raw));
  } catch {
    return { ...defaultProfile };
  }
}

export function saveProfile(profile: AthleteProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(sanitizeProfile(profile)));
}

export function loadStravaSettings(): StravaSettings {
  try {
    const raw = localStorage.getItem(STRAVA_SETTINGS_KEY);
    if (!raw) return { clientId: '', clientSecret: '' };
    const parsed = JSON.parse(raw) as Partial<StravaSettings>;
    return {
      clientId: typeof parsed.clientId === 'string' ? parsed.clientId.replace(/\D/g, '').slice(0, 12) : '',
      clientSecret: typeof parsed.clientSecret === 'string' ? parsed.clientSecret.trim().slice(0, 200) : '',
    };
  } catch {
    return { clientId: '', clientSecret: '' };
  }
}

export function saveStravaSettings(settings: StravaSettings): void {
  localStorage.setItem(STRAVA_SETTINGS_KEY, JSON.stringify({
    clientId: settings.clientId.replace(/\D/g, '').slice(0, 12),
    clientSecret: settings.clientSecret.trim().slice(0, 200),
  }));
}

export function loadStravaTokens(): StravaTokens | null {
  try {
    const raw = localStorage.getItem(STRAVA_TOKENS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StravaTokens>;
    if (!parsed.accessToken || !parsed.refreshToken || typeof parsed.expiresAt !== 'number') return null;
    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      expiresAt: parsed.expiresAt,
      athleteLabel: typeof parsed.athleteLabel === 'string' ? parsed.athleteLabel.slice(0, 80) : undefined,
      scope: typeof parsed.scope === 'string' ? parsed.scope : undefined,
      via: parsed.via === 'hosted' ? 'hosted' : 'own',
    };
  } catch {
    return null;
  }
}

export function saveStravaTokens(tokens: StravaTokens | null): void {
  if (!tokens) localStorage.removeItem(STRAVA_TOKENS_KEY);
  else localStorage.setItem(STRAVA_TOKENS_KEY, JSON.stringify(tokens));
}

export function clearLocalPreferences(): void {
  localStorage.removeItem(PROFILE_KEY);
  localStorage.removeItem(STRAVA_SETTINGS_KEY);
  localStorage.removeItem(STRAVA_TOKENS_KEY);
}
