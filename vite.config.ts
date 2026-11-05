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

export default defineConfig(({ command, mode, isPreview }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const configured = process.env.VITE_BASE || env.VITE_BASE;
  // GitHub project site is /pacemates/. The dev server stays at / unless VITE_BASE is set.
  const fallback = command === 'build' || isPreview ? '/pacemates/' : '/';
  const base = normalizeBase(configured || fallback);
  return {
    base,
    plugins: [react(), githubPagesFallback(base)],
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
