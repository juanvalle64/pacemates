// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { handleRequest, redirectAllowed, trimTokenResponse } from './handler.js';

const env = {
  STRAVA_CLIENT_ID: '12345',
  STRAVA_CLIENT_SECRET: 'nur-im-test',
  ALLOWED_ORIGINS: 'https://pacemates.de,http://127.0.0.1:43123',
};

function post(body, origin = 'https://pacemates.de') {
  return new Request('https://proxy.example/token', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Strava-Token-Proxy', () => {
  it('ergänzt das Secret und gibt nur die nötigen Felder zurück', async () => {
    const upstream = vi.fn(async (_url, init) => {
      const form = new URLSearchParams(String(init.body));
      expect(form.get('client_secret')).toBe('nur-im-test');
      expect(form.get('client_id')).toBe('12345');
      expect(form.get('code_verifier')).toHaveLength(43);
      return new Response(JSON.stringify({
        access_token: 'access-token-1', refresh_token: 'refresh-token-1', expires_at: 2_000_000_000,
        athlete: { firstname: 'A', lastname: 'B', city: 'Geheim', id: 7 },
      }), { status: 200 });
    });
    const response = await handleRequest(post({
      grant_type: 'authorization_code',
      code: 'abcdef123456',
      code_verifier: 'a'.repeat(43),
      redirect_uri: 'https://pacemates.de/strava/callback',
    }), env, upstream);
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://pacemates.de');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const body = await response.json();
    expect(body.athlete).toEqual({ firstname: 'A', lastname: 'B' });
    expect(JSON.stringify(body)).not.toContain('nur-im-test');
  });

  it('lehnt fremde Herkunft und fremde Rückleitung ab', async () => {
    const upstream = vi.fn();
    const foreign = await handleRequest(post({ grant_type: 'refresh_token', refresh_token: 'refresh-token-1' }, 'https://boese.example'), env, upstream);
    expect(foreign.status).toBe(403);
    const redirect = await handleRequest(post({
      grant_type: 'authorization_code', code: 'abcdef123456', redirect_uri: 'https://boese.example/strava/callback',
    }), env, upstream);
    expect(redirect.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('beantwortet den CORS-Vorabcheck', async () => {
    const response = await handleRequest(new Request('https://proxy.example/token', {
      method: 'OPTIONS', headers: { Origin: 'http://127.0.0.1:43123' },
    }), env);
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });

  it('verweigert ohne konfiguriertes Secret', async () => {
    const response = await handleRequest(post({ grant_type: 'refresh_token', refresh_token: 'refresh-token-1' }), { ...env, STRAVA_CLIENT_SECRET: '' });
    expect(response.status).toBe(500);
  });

  it('prüft Rückleitungen streng', () => {
    const origins = ['https://juanvalle64.github.io'];
    expect(redirectAllowed('https://juanvalle64.github.io/pacemates/strava/callback', origins)).toBe(true);
    expect(redirectAllowed('https://juanvalle64.github.io/pacemates/strava/callback?x=1', origins)).toBe(false);
    expect(redirectAllowed('https://juanvalle64.github.io/anders', origins)).toBe(false);
    expect(trimTokenResponse(null)).toEqual({});
  });
});
