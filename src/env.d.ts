/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Öffentliche Client-ID der PaceMates-Strava-Anwendung. Kein Geheimnis. */
  readonly VITE_STRAVA_CLIENT_ID?: string;
  /** Adresse des Token-Proxys, der das Client Secret serverseitig ergänzt. */
  readonly VITE_STRAVA_TOKEN_URL?: string;
  /** Öffentliche Adresse der Seite, z. B. https://pacemates.de. */
  readonly VITE_SITE_URL?: string;
  readonly VITE_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
