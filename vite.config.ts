import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

function normalizeBase(input: string | undefined): string {
  if (!input || input === '/' || input === './') return '/';
  let base = input.trim();
  if (!base.startsWith('/')) base = `/${base}`;
  if (!base.endsWith('/')) base = `${base}/`;
  return base;
}

function githubPagesFallback(base: string): Plugin {
  return {
    name: 'pacemates-github-pages-fallback',
    apply: 'build',
    closeBundle() {
      const trimmed = base === '/' ? '' : base.replace(/\/$/, '');
      const keep = trimmed.split('/').filter(Boolean).length;
      const html = `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <title>PaceMates</title>
    <script>
      // Generated for base "${base}". pathSegmentsToKeep matches that prefix.
      var pathSegmentsToKeep = ${keep};
      var parts = window.location.pathname.split('/');
      var prefix = parts.slice(0, pathSegmentsToKeep + 1).join('/');
      var target = (prefix || '') + '/?p=' + encodeURIComponent(
        window.location.pathname + window.location.search + window.location.hash
      );
      window.location.replace(target);
    </script>
  </head>
  <body>
    <p>Weiterleitung zu PaceMates …</p>
  </body>
</html>
`;
      fs.writeFileSync(path.resolve(process.cwd(), 'dist/404.html'), html);
    },
  };
}

/**
 * Setzt Teilen-Bild, kanonische Adresse und im Build eine Content-Security-Policy.
 * Die CSP erlaubt nur eigene Skripte, die zwei Inline-Skripte per Hash, Strava und den Token-Proxy.
 */
function htmlMeta(base: string, env: Record<string, string>, isBuild: boolean): Plugin {
  const site = (env.VITE_SITE_URL || '').trim().replace(/\/$/, '');
  const tokenUrl = (env.VITE_STRAVA_TOKEN_URL || '').trim();
  let proxyOrigin = '';
  try {
    proxyOrigin = tokenUrl ? new URL(tokenUrl).origin : '';
  } catch {
    proxyOrigin = '';
  }
  return {
    name: 'pacemates-html-meta',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const ogImage = site ? `${site}${base}og.png` : `${base}og.png`;
        let out = html.replace('%PACEMATES_OG_IMAGE%', ogImage);
        if (site) out = out.replace('</title>', `</title>\n    <link rel="canonical" href="${site}${base}" />\n    <meta property="og:url" content="${site}${base}" />`);
        if (!isBuild) return out;
        const hashes = [...out.matchAll(/<script>([\s\S]*?)<\/script>/g)]
          .map((match) => `'sha256-${createHash('sha256').update(match[1] ?? '').digest('base64')}'`);
        const connect = ["'self'", 'https://www.strava.com', proxyOrigin].filter(Boolean).join(' ');
        const policy = [
          "default-src 'self'",
          `script-src 'self' ${hashes.join(' ')}`,
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data:",
          "font-src 'self' data:",
          `connect-src ${connect}`,
          "manifest-src 'self'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; ');
        return out.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`);
      },
    },
  };
}

export default defineConfig(({ command, mode, isPreview }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const configured = process.env.VITE_BASE || env.VITE_BASE;
  // GitHub project site is /pacemates/. The dev server stays at / unless VITE_BASE is set.
  const fallback = command === 'build' || isPreview ? '/pacemates/' : '/';
  const base = normalizeBase(configured || fallback);
  return {
    base,
    plugins: [react(), githubPagesFallback(base), htmlMeta(base, { ...env, ...process.env } as Record<string, string>, command === 'build')],
    server: {
      host: '0.0.0.0',
      port: 43123,
      strictPort: true,
    },
    preview: {
      host: '0.0.0.0',
      port: 43123,
      strictPort: true,
    },
  };
});
