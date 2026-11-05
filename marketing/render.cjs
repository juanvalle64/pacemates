// Rendert die Launch-Grafiken aus templates/card.html.
// Braucht Playwright mit Chromium: npx playwright install chromium (einmalig), dann node marketing/render.cjs
const path = require('node:path');
const { chromium } = require('playwright');

const jobs = [
  ['og', 1200, 630, '../public/og.png'],
  ['post-1', 1080, 1350, 'assets/post-1-sieh-was-dein-training-tut.png'],
  ['post-2', 1080, 1350, 'assets/post-2-ohne-daten-leer.png'],
  ['post-3', 1080, 1350, 'assets/post-3-jeder-tipp-zeigt-seine-zahl.png'],
  ['post-4', 1080, 1350, 'assets/post-4-daten-bleiben-auf-dem-geraet.png'],
  ['story', 1080, 1920, 'assets/story-launch.png'],
];

(async () => {
  const browser = await chromium.launch();
  const template = 'file://' + path.join(__dirname, 'templates', 'card.html');
  for (const [variant, w, h, out] of jobs) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await page.goto(`${template}?v=${variant}&w=${w}&h=${h}`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(__dirname, out) });
    await page.close();
    console.log('geschrieben:', out);
  }
  const icon = await browser.newPage({ viewport: { width: 512, height: 512 } });
  const svg = require('node:fs').readFileSync(path.join(__dirname, '..', 'public', 'favicon.svg'), 'utf8').replace('<svg ', '<svg width="512" height="512" ');
  await icon.setContent(`<style>html,body{margin:0}</style>${svg}`);
  await icon.screenshot({ path: path.join(__dirname, '..', 'public', 'icon-512.png'), omitBackground: true });
  console.log('geschrieben: ../public/icon-512.png');
  await browser.close();
})();
