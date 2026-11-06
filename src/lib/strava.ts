import { createActivity } from './activity.ts';
import { stravaHosted, type StravaHostedConfig } from './config.ts';
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
const ROUTE_KEY = 'pacemates.strava.route';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const API_URL = 'https://www.strava.com/api/v3/athlete/activities';
const DEAUTHORIZE_URL = 'https://www.strava.com/oauth/deauthorize';
const PAGE_SIZE = 200;
const MAX_PAGES = 20;

export class StravaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StravaError';
  }
}

/**
 * Welcher Weg zu Strava gerade möglich ist.
 * hosted: Der Betreiber hat eine Strava-Anwendung und einen Token-Proxy. Das Secret liegt nur dort.
 * own: Der Sportler nutzt seine eigene Strava-API-Anwendung. Das Secret liegt nur in seinem Browser.
 * none: Es fehlt eine Client-ID. Dann startet kein Login.
 */
export type StravaRoute =
  | { kind: 'hosted'; clientId: string; tokenUrl: string }
  | { kind: 'own'; clientId: string; clientSecret: string }
  | { kind: 'none' };

export function resolveStravaRoute(settings: StravaSettings, hosted: StravaHostedConfig | null = stravaHosted): StravaRoute {
  if (/^\d{1,12}$/.test(settings.clientId)) return { kind: 'own', clientId: settings.clientId, clientSecret: settings.clientSecret };
  if (hosted) return { kind: 'hosted', clientId: hosted.clientId, tokenUrl: hosted.tokenUrl };
  return { kind: 'none' };
}

/** Der Weg, über den ein gespeichertes Token erneuert werden muss. */
export function routeForTokens(tokens: StravaTokens, settings: StravaSettings, hosted: StravaHostedConfig | null = stravaHosted): StravaRoute {
  if (tokens.via === 'hosted') {
    return hosted ? { kind: 'hosted', clientId: hosted.clientId, tokenUrl: hosted.tokenUrl } : { kind: 'none' };
  }
  if (/^\d{1,12}$/.test(settings.clientId)) return { kind: 'own', clientId: settings.clientId, clientSecret: settings.clientSecret };
  return { kind: 'none' };
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

export async function beginStravaLogin(route: StravaRoute): Promise<void> {
  if (route.kind === 'none') throw new StravaError('Es ist keine Strava-Anwendung eingerichtet. Ohne Client-ID startet kein Login.');
  const pkce = await createPkce();
  sessionStorage.setItem(VERIFIER_KEY, pkce.verifier);
  sessionStorage.setItem(STATE_KEY, pkce.state);
  sessionStorage.setItem(ROUTE_KEY, route.kind);
  window.location.assign(buildAuthorizeUrl(route.clientId, stravaRedirectUri(), pkce.challenge, pkce.state));
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  athlete?: { firstname?: string; lastname?: string };
  message?: string;
  errors?: { field?: string; code?: string; resource?: string }[];
}

function athleteLabel(athlete: TokenResponse['athlete']): string | undefined {
  if (!athlete) return undefined;
  const label = [athlete.firstname, athlete.lastname].filter((part) => typeof part === 'string' && part.trim()).join(' ');
  return label || undefined;
}

export function explainStravaFailure(body: TokenResponse, status: number, via: 'hosted' | 'own' = 'own'): string {
  const field = body.errors?.find((error) => error.field)?.field;
  if (via === 'own' && (field === 'client_secret' || /client_secret/i.test(body.message ?? ''))) {
    return 'Strava verlangt beim Token-Tausch das Client Secret deiner API-Anwendung. Trag es lokal ein und starte die Verbindung erneut. Es bleibt nur in diesem Browser.';
  }
  if (field === 'code' || /authorization code/i.test(body.message ?? '')) {
    return 'Der Anmeldecode von Strava ist abgelaufen oder wurde schon benutzt. Starte die Verbindung erneut.';
  }
  if (field === 'refresh_token') {
    return 'Strava hat die Verbindung nicht erneuert. Vermutlich wurde der Zugriff bei Strava widerrufen. Verbinde dich erneut.';
  }
  if (field === 'redirect_uri' || /redirect/i.test(body.message ?? '')) {
    return 'Strava akzeptiert die Rückleitungs-URL nicht. Die Callback-Domain der Strava-Anwendung muss zu dieser Seite passen.';
  }
  if (status === 429) return 'Strava begrenzt gerade die Anfragen. Versuch es in etwa 15 Minuten erneut.';
  if (via === 'hosted' && status === 403) return 'Der Strava-Dienst von PaceMates nimmt Anfragen von dieser Adresse nicht an.';
  if (via === 'hosted' && status >= 500) return 'Der Strava-Dienst von PaceMates ist gerade nicht erreichbar. Der Datei-Import funktioniert weiter.';
  if (status === 401) return via === 'own'
    ? 'Strava hat den Zugang abgelehnt. Prüfe Client-ID und Secret oder verbinde dich erneut.'
    : 'Strava hat den Zugang abgelehnt. Verbinde dich erneut.';
  return body.message ? `Strava: ${body.message}` : `Strava antwortet mit Status ${status}.`;
}

function tokenRequest(route: Exclude<StravaRoute, { kind: 'none' }>, fields: Record<string, string>): { url: string; init: RequestInit } {
  if (route.kind === 'hosted') {
    // Der Proxy ergänzt client_id und client_secret serverseitig.
    return {
      url: route.tokenUrl,
      init: {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      },
    };
  }
  const body = new URLSearchParams({ client_id: route.clientId, ...fields });
  if (route.clientSecret) body.set('client_secret', route.clientSecret);
  return {
    url: STRAVA_TOKEN_URL,
    init: {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    },
  };
}

async function postToken(route: Exclude<StravaRoute, { kind: 'none' }>, fields: Record<string, string>): Promise<StravaTokens> {
  const { url, init } = tokenRequest(route, fields);
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new StravaError(route.kind === 'hosted'
      ? 'Der Strava-Dienst von PaceMates ist nicht erreichbar. Der Datei-Import funktioniert ohne Verbindung.'
      : 'Strava ist nicht erreichbar. Der Datei-Import funktioniert ohne Verbindung.');
  }
  let payload: TokenResponse = {};
  try {
    payload = await response.json() as TokenResponse;
  } catch {
    payload = {};
  }
  if (!response.ok || !payload.access_token || !payload.refresh_token || !payload.expires_at) {
    throw new StravaError(explainStravaFailure(payload, response.status, route.kind));
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: payload.expires_at,
    athleteLabel: athleteLabel(payload.athlete),
    via: route.kind,
  };
}

const inflight = new Map<string, Promise<StravaTokens>>();

async function exchangeOnce(code: string, settings: StravaSettings, scope: string | null): Promise<StravaTokens> {
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  const expectedState = sessionStorage.getItem(STATE_KEY);
  if (!verifier || !expectedState) throw new StravaError('Die Anmeldung ist abgelaufen. Starte die Strava-Verbindung erneut.');
  const startedVia = sessionStorage.getItem(ROUTE_KEY);
  const route = resolveStravaRoute(startedVia === 'hosted' ? { clientId: '', clientSecret: '' } : settings);
  if (route.kind === 'none') throw new StravaError('Die Strava-Anwendung ist nicht mehr eingerichtet. Starte die Verbindung erneut.');
  const tokens = await postToken(route, {
    code,
    grant_type: 'authorization_code',
    code_verifier: verifier,
    redirect_uri: stravaRedirectUri(),
  });
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(ROUTE_KEY);
  return { ...tokens, scope: scope ?? undefined };
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

export async function refreshStravaTokens(settings: StravaSettings, tokens: StravaTokens, force = false): Promise<StravaTokens> {
  if (!force && tokens.expiresAt * 1000 - Date.now() > 120_000) return tokens;
  const route = routeForTokens(tokens, settings);
  if (route.kind === 'none' || !tokens.refreshToken) {
    throw new StravaError('Der Strava-Zugang ist abgelaufen und lässt sich auf diesem Weg nicht erneuern. Verbinde dich erneut.');
  }
  if (route.kind === 'own' && !route.clientSecret) {
    throw new StravaError('Der Strava-Zugang ist abgelaufen. Zum Erneuern braucht PaceMates das lokal gespeicherte Client Secret deiner API-Anwendung. Trag es ein oder verbinde dich erneut.');
  }
  const refreshed = await postToken(route, { grant_type: 'refresh_token', refresh_token: tokens.refreshToken });
  return { ...tokens, ...refreshed, athleteLabel: refreshed.athleteLabel ?? tokens.athleteLabel, scope: tokens.scope };
}

/** Widerruft den Zugriff bei Strava, so weit der Browser das zulässt. Fehler werden nicht verschwiegen, aber auch nicht geworfen. */
export async function revokeStrava(tokens: StravaTokens): Promise<boolean> {
  try {
    const response = await fetch(DEAUTHORIZE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ access_token: tokens.accessToken }),
      signal: AbortSignal.timeout(10_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export interface StravaActivity {
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

export interface StravaFetchResult {
  activities: StravaActivity[];
  /** true, wenn Strava wegen Rate-Limit abgebrochen hat. Was bis dahin kam, ist enthalten. */
  limited: boolean;
  capped: boolean;
}

export class StravaAuthError extends StravaError {
  constructor(message: string) {
    super(message);
    this.name = 'StravaAuthError';
  }
}

export async function fetchStravaActivities(token: string, options: { after?: number; onPage?: (count: number) => void } = {}): Promise<StravaFetchResult> {
  const all: StravaActivity[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = new URL(API_URL);
    url.searchParams.set('per_page', String(PAGE_SIZE));
    url.searchParams.set('page', String(page));
    if (options.after && options.after > 0) url.searchParams.set('after', String(Math.floor(options.after)));
    let response: Response;
    try {
      response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30_000) });
    } catch {
      throw new StravaError('Die Aktivitäten konnten nicht geladen werden. Strava ist vom Browser aus gerade nicht erreichbar.');
    }
    if (response.status === 401) throw new StravaAuthError('Der Strava-Zugang ist ungültig oder abgelaufen.');
    if (response.status === 403) throw new StravaError('Strava verweigert den Zugriff. Wahrscheinlich fehlt die Freigabe activity:read_all. Verbinde dich erneut und lass sie angehakt.');
    if (response.status === 429) return { activities: all, limited: true, capped: false };
    if (!response.ok) throw new StravaError(`Strava antwortet mit Status ${response.status}.`);
    const batch = await response.json() as unknown;
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch as StravaActivity[]);
    options.onPage?.(all.length);
    if (batch.length < PAGE_SIZE) break;
    if (page === MAX_PAGES) return { activities: all, limited: false, capped: true };
  }
  return { activities: all, limited: false, capped: false };
}

export interface StravaSyncResult {
  drafts: ParsedDraft[];
  fetched: number;
  limited: boolean;
  capped: boolean;
  tokens: StravaTokens;
}

/**
 * Holt Aktivitäten mit gültigem Token. Ein abgelaufenes Token wird einmal erneuert,
 * auch wenn Strava es früher als angekündigt ablehnt.
 */
export async function syncStrava(
  settings: StravaSettings,
  tokens: StravaTokens,
  options: { after?: number; onPage?: (count: number) => void; onTokens?: (tokens: StravaTokens) => void } = {},
): Promise<StravaSyncResult> {
  let current = await refreshStravaTokens(settings, tokens);
  if (current !== tokens) options.onTokens?.(current);
  let result: StravaFetchResult;
  try {
    result = await fetchStravaActivities(current.accessToken, options);
  } catch (error) {
    if (!(error instanceof StravaAuthError)) throw error;
    current = await refreshStravaTokens(settings, current, true);
    options.onTokens?.(current);
    result = await fetchStravaActivities(current.accessToken, options);
  }
  return { drafts: mapStravaActivities(result.activities), fetched: result.activities.length, limited: result.limited, capped: result.capped, tokens: current };
}

/** Startpunkt für einen schnellen Abgleich: eine Woche vor der neuesten Strava-Einheit. Überschneidungen fängt die Dublettenprüfung ab. */
export function incrementalAfter(activities: { startTime: string; sources: { kind: string }[] }[]): number | undefined {
  let latest = 0;
  for (const activity of activities) {
    if (!activity.sources.some((source) => source.kind === 'strava')) continue;
    const time = Date.parse(activity.startTime);
    if (Number.isFinite(time) && time > latest) latest = time;
  }
  if (latest === 0) return undefined;
  return Math.floor(latest / 1000) - 7 * 86_400;
}

export function describeSync(result: { added: number; merged: number }, sync: Pick<StravaSyncResult, 'fetched' | 'limited' | 'capped'>): string {
  if (sync.fetched === 0) return 'Strava hat keine neuen Aktivitäten zurückgegeben.';
  const parts = [`${sync.fetched} von Strava gelesen: ${result.added} neu, ${result.merged} mit vorhandenen zusammengeführt.`];
  if (sync.limited) parts.push('Strava hat die Abfrage wegen des Rate-Limits gestoppt. Hol den Rest in etwa 15 Minuten.');
  if (sync.capped) parts.push(`Es wurden höchstens ${PAGE_SIZE * MAX_PAGES} Aktivitäten geholt. Ältere Einheiten kannst du über den Strava-Datenexport importieren.`);
  return parts.join(' ');
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
