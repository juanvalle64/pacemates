import { createActivity } from './activity.ts';
import { stravaRedirectUri } from './paths.ts';
import type { ParsedDraft, StravaSettings, StravaTokens } from './types.ts';
import { normalizeSport } from './sport.ts';

export interface StravaCallbackParams {
  code: string | null;
  state: string | null;
  error: string | null;
  scope: string | null;
}

let capturedCallback: StravaCallbackParams | null = null;

export function readStravaCallback(): StravaCallbackParams {
  if (!capturedCallback) {
    const params = new URLSearchParams(window.location.search);
    capturedCallback = {
      code: params.get('code'),
      state: params.get('state'),
      error: params.get('error'),
      scope: params.get('scope'),
    };
  }
  return capturedCallback;
}

const VERIFIER_KEY = 'pacemates.strava.pkce';
const STATE_KEY = 'pacemates.strava.state';
const TOKEN_URL = 'https://www.strava.com/oauth/token';
const API_URL = 'https://www.strava.com/api/v3/athlete/activities';

export class StravaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StravaError';
  }
}

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function createPkce(): Promise<{ verifier: string; challenge: string; state: string }> {
  const verifierBytes = new Uint8Array(32);
  crypto.getRandomValues(verifierBytes);
  const verifier = base64url(verifierBytes);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return {
    verifier,
    challenge: base64url(new Uint8Array(digest)),
    state: base64url(crypto.getRandomValues(new Uint8Array(16))),
  };
}

export function buildAuthorizeUrl(clientId: string, redirectUri: string, challenge: string, state: string): string {
  const url = new URL('https://www.strava.com/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('approval_prompt', 'auto');
  url.searchParams.set('scope', 'activity:read_all');
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

export async function beginStravaLogin(clientId: string): Promise<void> {
  if (!/^\d{1,12}$/.test(clientId)) throw new StravaError('Die Client-ID fehlt oder ist keine Zahl.');
  const pkce = await createPkce();
  sessionStorage.setItem(VERIFIER_KEY, pkce.verifier);
  sessionStorage.setItem(STATE_KEY, pkce.state);
  window.location.assign(buildAuthorizeUrl(clientId, stravaRedirectUri(), pkce.challenge, pkce.state));
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  athlete?: { firstname?: string; lastname?: string };
  message?: string;
  errors?: { field?: string; code?: string }[];
}

function athleteLabel(athlete: TokenResponse['athlete']): string | undefined {
  if (!athlete) return undefined;
  const label = [athlete.firstname, athlete.lastname].filter((part) => typeof part === 'string' && part.trim()).join(' ');
  return label || undefined;
}

export function explainStravaFailure(body: TokenResponse, status: number): string {
  const field = body.errors?.find((error) => error.field)?.field;
  if (field === 'client_secret' || /client_secret/i.test(body.message ?? '')) {
    return 'Strava verlangt beim Token-Tausch ein Client Secret. PKCE allein lehnt der Token-Endpunkt derzeit ab. Trag das Secret lokal ein und starte die Verbindung erneut. Es bleibt nur in diesem Browser.';
  }
  if (status === 401) return 'Strava hat den Zugang abgelehnt. Prüfe Client-ID und Secret oder verbinde dich erneut.';
  return body.message ? `Strava: ${body.message}` : `Strava antwortet mit Status ${status}.`;
}

async function postToken(body: URLSearchParams): Promise<StravaTokens> {
  let response: Response;
  try {
    response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
  } catch {
    throw new StravaError('Strava ist nicht erreichbar. Der Datei-Import funktioniert ohne Verbindung.');
  }
  const payload = await response.json() as TokenResponse;
  if (!response.ok || !payload.access_token || !payload.refresh_token || !payload.expires_at) {
    throw new StravaError(explainStravaFailure(payload, response.status));
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: payload.expires_at,
    athleteLabel: athleteLabel(payload.athlete),
  };
}

const inflight = new Map<string, Promise<StravaTokens>>();

async function exchangeOnce(code: string, settings: StravaSettings, scope: string | null): Promise<StravaTokens> {
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  const expectedState = sessionStorage.getItem(STATE_KEY);
  if (!verifier || !expectedState) throw new StravaError('Die Anmeldung ist abgelaufen. Starte die Strava-Verbindung erneut.');
  const body = new URLSearchParams({
    client_id: settings.clientId,
    code,
    grant_type: 'authorization_code',
    code_verifier: verifier,
    redirect_uri: stravaRedirectUri(),
  });
  if (settings.clientSecret) body.set('client_secret', settings.clientSecret);
  const tokens = await postToken(body);
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  return { ...tokens, scope: scope ?? undefined, athleteLabel: tokens.athleteLabel };
}

export function exchangeAuthorizationCode(code: string, settings: StravaSettings, scope: string | null): Promise<StravaTokens> {
  const existing = inflight.get(code);
  if (existing) return existing;
  const promise = exchangeOnce(code, settings, scope).catch((error: unknown) => {
    inflight.delete(code);
    throw error;
  });
  inflight.set(code, promise);
  return promise;
}

export function takeExpectedState(): string | null {
  return sessionStorage.getItem(STATE_KEY);
}

export async function refreshStravaTokens(settings: StravaSettings, tokens: StravaTokens): Promise<StravaTokens> {
  if (tokens.expiresAt * 1000 - Date.now() > 120_000) return tokens;
  if (!settings.clientId || !settings.clientSecret || !tokens.refreshToken) {
    throw new StravaError('Das Zugangs-Token ist abgelaufen. Zum Erneuern braucht PaceMates die lokal gespeicherte Client-ID, das Client Secret und das Refresh-Token. Verbinde dich erneut.');
  }
  const body = new URLSearchParams({
    client_id: settings.clientId,
    client_secret: settings.clientSecret,
    grant_type: 'refresh_token',
    refresh_token: tokens.refreshToken,
  });
  const refreshed = await postToken(body);
  return { ...tokens, ...refreshed, athleteLabel: refreshed.athleteLabel ?? tokens.athleteLabel, scope: tokens.scope };
}

interface StravaActivity {
  id?: number;
  name?: string;
  type?: string;
  sport_type?: string;
  start_date?: string;
  elapsed_time?: number;
  moving_time?: number;
  distance?: number;
  total_elevation_gain?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_watts?: number;
  weighted_average_watts?: number;
  calories?: number;
  kilojoules?: number;
  trainer?: boolean;
  commute?: boolean;
  suffer_score?: number;
}

export async function fetchStravaActivities(token: string, onPage?: (count: number) => void): Promise<StravaActivity[]> {
  const all: StravaActivity[] = [];
  for (let page = 1; page <= 20; page += 1) {
    let response: Response;
    try {
      response = await fetch(`${API_URL}?per_page=200&page=${page}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      throw new StravaError('Die Aktivitäten konnten nicht geladen werden. Strava ist vom Browser aus nicht erreichbar.');
    }
    if (response.status === 401) throw new StravaError('Das Strava-Token ist ungültig oder abgelaufen.');
    if (response.status === 403) throw new StravaError('Strava verweigert den Zugriff. Die Freigabe activity:read_all fehlt wahrscheinlich.');
    if (!response.ok) throw new StravaError(`Strava antwortet mit Status ${response.status}.`);
    const batch = await response.json() as unknown;
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch as StravaActivity[]);
    onPage?.(all.length);
    if (batch.length < 200) break;
    if (page === 20) onPage?.(all.length);
  }
  return all;
}

export function mapStravaActivities(activities: StravaActivity[]): ParsedDraft[] {
  return activities.flatMap((activity) => {
    if (!activity.start_date || !activity.id) return [];
    const raw = activity.sport_type || activity.type || '';
    const sport = normalizeSport(raw);
    const moving = activity.moving_time ?? 0;
    const elapsed = activity.elapsed_time ?? 0;
    const durationSec = moving > 0 ? moving : elapsed;
    const distanceM = activity.distance ?? 0;
    if (durationSec <= 0 && distanceM <= 0) return [];
    return [{
      warnings: [],
      activity: createActivity({
        name: activity.name?.trim() || 'Strava-Aktivität',
        sport: sport.sport,
        rawType: raw,
        indoor: sport.indoor || Boolean(activity.trainer),
        commute: Boolean(activity.commute),
        startTime: activity.start_date,
        durationSec,
        elapsedSec: elapsed > durationSec + 30 ? elapsed : undefined,
        distanceM,
        elevationGainM: activity.total_elevation_gain,
        avgHr: activity.average_heartrate,
        maxHr: activity.max_heartrate,
        avgPower: activity.average_watts,
        normPower: activity.weighted_average_watts,
        calories: activity.calories,
        sources: [{ kind: 'strava', label: 'Strava', externalId: `strava:${activity.id}` }],
      }),
    }];
  });
}

export function scopeAllowsActivities(scope: string | null): boolean {
  if (!scope) return true;
  return /activity:read/.test(scope);
}
