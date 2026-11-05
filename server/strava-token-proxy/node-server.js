// Einstieg für einen eigenen Server mit Node.js 22 oder neuer, z. B. bei einem Hoster in der EU.
// Start: STRAVA_CLIENT_ID=… STRAVA_CLIENT_SECRET=… ALLOWED_ORIGINS=https://pacemates.de node node-server.js
// Davor gehört ein Reverse-Proxy mit HTTPS (z. B. Caddy oder nginx).
import { createServer } from 'node:http';
import { handleRequest } from './handler.js';

const port = Number(process.env.PORT || 8787);
const env = {
  STRAVA_CLIENT_ID: process.env.STRAVA_CLIENT_ID ?? '',
  STRAVA_CLIENT_SECRET: process.env.STRAVA_CLIENT_SECRET ?? '',
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ?? '',
  ALLOWED_REDIRECT_BASES: process.env.ALLOWED_REDIRECT_BASES ?? '',
};

createServer(async (req, res) => {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 8192) {
      res.writeHead(413).end();
      return;
    }
    chunks.push(chunk);
  }
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value);
  }
  const request = new Request(`http://localhost${req.url ?? '/'}`, {
    method: req.method,
    headers,
    body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
  });
  const response = await handleRequest(request, env);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(await response.text());
}).listen(port, () => {
  console.log(`Strava-Token-Proxy auf Port ${port}`);
});
