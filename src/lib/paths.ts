export function routerBasename(): string | undefined {
  const base = import.meta.env.BASE_URL || '/';
  if (base === '/' || base === './') return undefined;
  return base.endsWith('/') ? base.slice(0, -1) : base;
}

export function stravaRedirectUri(): string {
  const url = new URL(window.location.origin);
  const base = routerBasename() ?? '';
  url.pathname = `${base}/strava/callback`;
  url.search = '';
  url.hash = '';
  return url.toString();
}
