import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AthleteContext, type AthleteState } from './athlete-state.ts';
import { applyImport, applySportOverride, type ImportSelection } from '../lib/activity.ts';
import { applyLoad } from '../lib/load.ts';
import { buildSeries } from '../lib/series.ts';
import {
  clearLocalPreferences,
  loadActivities,
  loadProfile,
  loadStravaSettings,
  loadStravaTokens,
  saveActivities,
  saveProfile,
  saveStravaSettings,
  saveStravaTokens,
} from '../lib/storage.ts';
import { defaultProfile, type Activity, type AthleteProfile, type Sport, type StravaSettings, type StravaTokens } from '../lib/types.ts';

export function AthleteProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [profile, setProfile] = useState<AthleteProfile>(defaultProfile);
  const [stravaSettings, setStravaSettings] = useState<StravaSettings>({ clientId: '', clientSecret: '' });
  const [stravaTokens, setTokens] = useState<StravaTokens | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const queue = useRef(Promise.resolve());

  const persist = useCallback((next: Activity[]) => {
    queue.current = queue.current
      .then(() => saveActivities(next))
      .catch((error: unknown) => {
        setStorageError(error instanceof Error ? error.message : 'Speichern fehlgeschlagen.');
      });
  }, []);

  useEffect(() => {
    let cancel = false;
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('strava_client_id');
    const leakedSecret = params.get('strava_client_secret');
    if (fromQuery || leakedSecret) {
      params.delete('strava_client_id');
      params.delete('strava_client_secret');
      const query = params.toString();
      window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
    }
    void (async () => {
      try {
        const [storedActivities, storedProfile, storedSettings, storedTokens] = await Promise.all([
          loadActivities(),
          Promise.resolve(loadProfile()),
          Promise.resolve(loadStravaSettings()),
          Promise.resolve(loadStravaTokens()),
        ]);
        if (cancel) return;
        const settings = fromQuery && /^\d{1,12}$/.test(fromQuery)
          ? { ...storedSettings, clientId: fromQuery }
          : storedSettings;
        if (settings !== storedSettings) saveStravaSettings(settings);
        setActivities(storedActivities);
        setProfile(storedProfile);
        setStravaSettings(settings);
        setTokens(storedTokens);
        if (leakedSecret) setNotice('Ein Client Secret in der Adresse wurde nicht gespeichert. Trag es in das Feld ein, damit es nicht in der URL steht.');
        setReady(true);
      } catch (error) {
        if (!cancel) setStorageError(error instanceof Error ? error.message : 'Die lokalen Daten konnten nicht gelesen werden.');
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const updateProfile = useCallback((patch: Partial<AthleteProfile>) => {
    setProfile((current) => {
      const next = { ...current, ...patch };
      saveProfile(next);
      return next;
    });
  }, []);

  const updateStravaSettings = useCallback((patch: Partial<StravaSettings>) => {
    setStravaSettings((current) => {
      const next = { ...current, ...patch };
      saveStravaSettings(next);
      return next;
    });
  }, []);

  const setStravaTokens = useCallback((tokens: StravaTokens | null) => {
    setTokens(tokens);
    saveStravaTokens(tokens);
  }, []);

  const activitiesRef = useRef(activities);
  useEffect(() => {
    activitiesRef.current = activities;
  }, [activities]);
  const commitImport = useCallback((selection: ImportSelection[]) => {
    const applied = applyImport(activitiesRef.current, selection);
    activitiesRef.current = applied.activities;
    setActivities(applied.activities);
    persist(applied.activities);
    return { added: applied.added, merged: applied.merged };
  }, [persist]);

  const updateActivity = useCallback((id: string, patch: { name?: string; sport?: Sport }) => {
    setActivities((current) => {
      const next = current.map((activity) => {
        if (activity.id !== id) return activity;
        const named = patch.name !== undefined ? { ...activity, name: patch.name.trim().slice(0, 140) || activity.name } : activity;
        return patch.sport ? applySportOverride(named, patch.sport) : named;
      });
      persist(next);
      return next;
    });
  }, [persist]);

  const removeActivity = useCallback((id: string) => {
    setActivities((current) => {
      const next = current.filter((activity) => activity.id !== id);
      persist(next);
      return next;
    });
  }, [persist]);

  const clearActivities = useCallback(() => {
    setActivities([]);
    persist([]);
  }, [persist]);

  const disconnectStrava = useCallback(() => {
    setTokens(null);
    saveStravaTokens(null);
  }, []);

  const clearAllLocal = useCallback(() => {
    setActivities([]);
    setProfile({ ...defaultProfile });
    setStravaSettings({ clientId: '', clientSecret: '' });
    setTokens(null);
    clearLocalPreferences();
    persist([]);
  }, [persist]);

  const allLoaded = useMemo(
    () => [...activities]
      .map((activity) => applyLoad(activity, profile))
      .sort((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime)),
    [activities, profile],
  );
  const evaluated = useMemo(
    () => allLoaded.filter((activity) => profile.includeCommutes || !activity.commute),
    [allLoaded, profile.includeCommutes],
  );
  const series = useMemo(() => buildSeries(evaluated), [evaluated]);

  const value = useMemo<AthleteState>(() => ({
    ready,
    storageError,
    activities,
    allLoaded,
    evaluated,
    profile,
    series,
    stravaSettings,
    stravaTokens,
    notice,
    setNotice,
    updateProfile,
    updateStravaSettings,
    setStravaTokens,
    commitImport,
    updateActivity,
    removeActivity,
    clearActivities,
    disconnectStrava,
    clearAllLocal,
  }), [
    ready,
    storageError,
    activities,
    allLoaded,
    evaluated,
    profile,
    series,
    stravaSettings,
    stravaTokens,
    notice,
    updateProfile,
    updateStravaSettings,
    setStravaTokens,
    commitImport,
    updateActivity,
    removeActivity,
    clearActivities,
    disconnectStrava,
    clearAllLocal,
  ]);

  return <AthleteContext.Provider value={value}>{children}</AthleteContext.Provider>;
}
