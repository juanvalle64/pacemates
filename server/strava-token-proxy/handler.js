// PaceMates Strava-Token-Proxy.
//
// Ergänzt beim Token-Tausch das Client Secret, damit es nie im Browser
// oder im Repository liegt. Speichert nichts, loggt keine Tokens und
// leitet nur zwei Anfragen an Strava weiter: authorization_code und refresh_token.
//
// Läuft überall, wo es die Fetch-API gibt: Cloudflare Workers, Deno, Node 22.

const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const CALLBACK_PATH = '/strava/callback';
const MAX_BODY_BYTES = 4096;
const TOKEN_PATTERN = /^[A-Za-z0-9._~-]{8,512}$/;

/**
 * @typedef {Object} ProxyEnv
 * @property {string} STRAVA_CLIENT_ID
 * @property {string} STRAVA_CLIENT_SECRET
 * @property {string} ALLOWED_ORIGINS Kommagetrennt, z. B. "https://pacemates.de,http://127.0.0.1:43123"
 * @property {string} [ALLOWED_REDIRECT_BASES] Optional, kommagetrennt. Standard: jede erlaubte Origin plus Basispfad aus der Rückleitung.
 */

/** @param {string | undefined} value */
export function parseList(value) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

/**
 * @param {string | null} origin
 * @param {string[]} allowed
 */
function corsHeaders(origin, allowed) {
  /** @type {Record<string, string>} */
  const headers = {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Origin',
  };
  if (origin && allowed.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers['Access-Control-Max-Age'] = '600';
  }
  return headers;
}

/**
 * @param {number} status
 * @param {unknown} body
 * @param {Record<string, string>} headers
 */
function json(status, body, headers) {
  return new Response(JSON.stringify(body), { status, headers });
}

/**
 * Die Rückleitung muss auf einer erlaubten Origin liegen und auf /strava/callback enden.
 * @param {string} value
 * @param {string[]} origins
 */
export function redirectAllowed(value, origins) {
  try {
    const url = new URL(value);
    if (url.search || url.hash || url.username || url.password) return false;
    if (!origins.includes(url.origin)) return false;
    return url.pathname.endsWith(CALLBACK_PATH) && !url.pathname.includes('..');
  } catch {
    return false;
  }
}

/**
 * Nur Felder, die PaceMates braucht. Athletendaten außer dem Namen fallen weg.
 * @param {any} payload
 */
export function trimTokenResponse(payload) {
  if (!payload || typeof payload !== 'object') return {};
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const key of ['access_token', 'refresh_token', 'expires_at', 'expires_in', 'token_type', 'message', 'errors']) {
    if (key in payload) out[key] = payload[key];
  }
  if (payload.athlete && typeof payload.athlete === 'object') {
    out.athlete = { firstname: payload.athlete.firstname, lastname: payload.athlete.lastname };
  }
  return out;
}

/**
 * @param {Request} request
 * @param {ProxyEnv} env
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<Response>}
 */
export async function handleRequest(request, env, fetchImpl = fetch) {
  const allowed = parseList(env.ALLOWED_ORIGINS);
  const origin = request.headers.get('Origin');
  const headers = corsHeaders(origin, allowed);
  const url = new URL(request.url);

  if (url.pathname !== '/token' && url.pathname !== '/') {
    return json(404, { message: 'Nicht gefunden.' }, headers);
  }
  if (!origin || !allowed.includes(origin)) {
    return json(403, { message: 'Diese Herkunft ist nicht freigegeben.' }, headers);
  }
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return json(405, { message: 'Nur POST.' }, headers);
  if (!/^\d{1,12}$/.test(env.STRAVA_CLIENT_ID ?? '') || !env.STRAVA_CLIENT_SECRET) {
    return json(500, { message: 'Der Proxy ist nicht konfiguriert.' }, headers);
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { message: 'Anfrage zu groß.' }, headers);
  /** @type {any} */
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { message: 'Ungültiges JSON.' }, headers);
  }
  if (!body || typeof body !== 'object') return json(400, { message: 'Ungültige Anfrage.' }, headers);

  const form = new URLSearchParams({
    client_id: env.STRAVA_CLIENT_ID,
    client_secret: env.STRAVA_CLIENT_SECRET,
  });
  if (body.grant_type === 'authorization_code') {
    const redirectBases = parseList(env.ALLOWED_REDIRECT_BASES);
    const redirectOrigins = redirectBases.length > 0 ? redirectBases : allowed;
    if (typeof body.code !== 'string' || !TOKEN_PATTERN.test(body.code)) return json(400, { message: 'Code fehlt.', errors: [{ field: 'code', code: 'invalid' }] }, headers);
    if (typeof body.redirect_uri !== 'string' || !redirectAllowed(body.redirect_uri, redirectOrigins)) {
      return json(400, { message: 'Rückleitung nicht erlaubt.', errors: [{ field: 'redirect_uri', code: 'invalid' }] }, headers);
    }
    form.set('grant_type', 'authorization_code');
    form.set('code', body.code);
    form.set('redirect_uri', body.redirect_uri);
    if (typeof body.code_verifier === 'string' && /^[A-Za-z0-9._~-]{43,128}$/.test(body.code_verifier)) {
      form.set('code_verifier', body.code_verifier);
    }
  } else if (body.grant_type === 'refresh_token') {
    if (typeof body.refresh_token !== 'string' || !TOKEN_PATTERN.test(body.refresh_token)) {
      return json(400, { message: 'Refresh-Token fehlt.', errors: [{ field: 'refresh_token', code: 'invalid' }] }, headers);
    }
    form.set('grant_type', 'refresh_token');
    form.set('refresh_token', body.refresh_token);
  } else {
    return json(400, { message: 'Unbekannter grant_type.' }, headers);
  }

  let upstream;
  try {
    upstream = await fetchImpl(STRAVA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: form,
    });
  } catch {
    return json(502, { message: 'Strava ist nicht erreichbar.' }, headers);
  }
  /** @type {any} */
  let payload = {};
  try {
    payload = await upstream.json();
  } catch {
    payload = { message: 'Antwort von Strava nicht lesbar.' };
  }
  const status = upstream.status >= 500 ? 502 : upstream.status;
  return json(status, trimTokenResponse(payload), headers);
}
