/**
 * Betreiber-Konfiguration zur Build-Zeit. Alle Werte sind öffentlich:
 * Client-ID und Proxy-Adresse stehen ohnehin in jeder Strava-Anfrage.
 * Das Client Secret gehört nie hierher, sondern nur in den Token-Proxy.
 */
export interface StravaHostedConfig {
  clientId: string;
  tokenUrl: string;
}

export function parseHostedConfig(clientId: string | undefined, tokenUrl: string | undefined): StravaHostedConfig | null {
  const id = clientId?.trim() ?? '';
  const url = tokenUrl?.trim() ?? '';
  if (!/^\d{1,12}$/.test(id) || !url) return null;
  try {
    const parsed = new URL(url);
    const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) return null;
    return { clientId: id, tokenUrl: parsed.toString() };
  } catch {
    return null;
  }
}

export const stravaHosted: StravaHostedConfig | null = parseHostedConfig(
  import.meta.env.VITE_STRAVA_CLIENT_ID,
  import.meta.env.VITE_STRAVA_TOKEN_URL,
);

export const siteUrl: string | null = (() => {
  const raw = import.meta.env.VITE_SITE_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).toString().replace(/\/$/, '');
  } catch {
    return null;
  }
})();
