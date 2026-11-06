import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { ActivityIndex, applyImport, createActivity } from './activity.ts';
import { buildBackup, parseBackup } from './backup.ts';
import { parseHostedConfig } from './config.ts';
import { highestRecordedHr, loadMix, readForm } from './form-reading.ts';
import { applyLoad } from './load.ts';
import { explainParseError, parseNamedBuffer } from './parse/files.ts';
import { buildSeries } from './series.ts';
import { describeSync, explainStravaFailure, incrementalAfter, mapStravaActivities, resolveStravaRoute, routeForTokens } from './strava.ts';
import { buildTips } from './tips.ts';
import { defaultProfile, type Activity } from './types.ts';

function run(start: Date, minutes: number, extra: Partial<Parameters<typeof createActivity>[0]> = {}): Activity {
  return createActivity({
    name: 'Lauf',
    sport: 'run',
    startTime: start.toISOString(),
    durationSec: minutes * 60,
    distanceM: minutes * 170,
    sources: [{ kind: 'file', label: 'lauf.gpx' }],
    ...extra,
  });
}

function day(offset: number, hour = 7): Date {
  return new Date(2026, 5, 1 + offset, hour, 0, 0);
}

describe('Dublettenprüfung', () => {
  it('findet dieselbe Einheit über das Zeitfenster und über die Strava-ID', () => {
    const file = run(day(0), 60);
    const index = new ActivityIndex([file]);
    const strava = run(new Date(day(0).getTime() + 2 * 60_000), 59, { sources: [{ kind: 'strava', label: 'Strava', externalId: 'strava:9' }] });
    expect(index.find(strava)).toBe(0);
    index.upsert(strava);
    expect(index.items).toHaveLength(1);
    // Ein späterer Abruf mit verschobener Zeit trifft über die ID.
    const again = run(day(0, 9), 61, { sources: [{ kind: 'strava', label: 'Strava', externalId: 'strava:9' }] });
    expect(index.upsert(again)).toBe('merged');
    expect(index.items).toHaveLength(1);
  });

  it('hält zwei verschiedene Strava-Einheiten zur selben Zeit auseinander', () => {
    const a = run(day(1), 30, { sources: [{ kind: 'strava', label: 'Strava', externalId: 'strava:1' }] });
    const b = run(day(1), 30, { sources: [{ kind: 'strava', label: 'Strava', externalId: 'strava:2' }] });
    const result = applyImport([a], [{ activity: b, include: true }]);
    expect(result.added).toBe(1);
  });

  it('erkennt Bewegungszeit gegen Gesamtzeit als dieselbe Einheit', () => {
    const file = run(day(2), 70, { elapsedSec: 80 * 60 });
    const strava = run(day(2), 80, { distanceM: file.distanceM, sources: [{ kind: 'strava', label: 'Strava', externalId: 'strava:3' }] });
    expect(applyImport([file], [{ activity: strava, include: true }]).merged).toBe(1);
  });

  it('bleibt bei großen Bibliotheken schnell', () => {
    const existing = Array.from({ length: 4000 }, (_, i) => run(new Date(new Date(2020, 0, 1, 7).getTime() + i * 43_200_000), 45));
    const incoming = existing.map((activity) => ({ activity: { ...activity, id: `${activity.id}-x`, sources: [{ kind: 'strava' as const, label: 'Strava' }] }, include: true }));
    const started = performance.now();
    const result = applyImport(existing, incoming);
    expect(result.merged).toBe(4000);
    expect(performance.now() - started).toBeLessThan(2000);
  });

  it('ignoriert Auswahl ohne Startzeit', () => {
    const missing = { ...run(day(3), 30), startTime: '' };
    expect(applyImport([], [{ activity: missing, include: true }]).added).toBe(0);
  });
});

describe('Sicherung und Gerätewechsel', () => {
  it('überträgt Aktivitäten und Profil, aber keinen Strava-Zugang', () => {
    const profile = { ...defaultProfile, name: 'Test', maxHr: 190, restHr: 50 };
    const backup = buildBackup([run(day(0), 40), run(day(1), 50)], profile);
    const text = JSON.stringify(backup);
    expect(text).not.toMatch(/secret|token/i);
    const parsed = parseNamedBuffer('pacemates-sicherung.json', strToU8(text));
    expect(parsed.drafts).toHaveLength(2);
    expect(parsed.profile?.maxHr).toBe(190);
  });

  it('liest auch den alten Export als reine Liste und überspringt Unsinn', () => {
    const parsed = parseBackup(JSON.stringify([run(day(0), 40), { startTime: 'kaputt' }, 7]));
    expect(parsed.drafts).toHaveLength(1);
    expect(parsed.skipped).toBe(2);
  });

  it('lehnt fremdes JSON und neuere Versionen verständlich ab', () => {
    expect(() => parseBackup('{"hallo":1}')).toThrow(/keine PaceMates-Sicherung/);
    expect(() => parseBackup('{"format":"pacemates-backup","version":99,"activities":[]}')).toThrow(/neueren/);
    expect(() => parseBackup('{"format":')).toThrow(/beschädigt/);
  });
});

describe('Fehlermeldungen beim Import', () => {
  it('erklärt kaputte Dateien auf Deutsch', () => {
    expect(() => parseNamedBuffer('lauf.fit', strToU8('kein fit'))).toThrow(/keine gültige FIT-Datei/);
    expect(() => parseNamedBuffer('export.zip', strToU8('PK kaputt'))).toThrow(/ZIP-Archiv ist beschädigt/);
    expect(() => parseNamedBuffer('leer.gpx', new Uint8Array())).toThrow(/leer/);
    expect(() => parseNamedBuffer('lauf.gpx', strToU8('<gpx><trk>'))).toThrow(/kein gültiges XML/);
    expect(explainParseError('x.fit', new Error('Invalid CRC'))).toMatch(/FIT-Datei ist beschädigt/);
  });

  it('meldet ein ZIP ohne Trainingsdateien', () => {
    const zip = zipSync({ 'bild.jpg': strToU8('x'), 'profil.txt': strToU8('y') });
    expect(() => parseNamedBuffer('export.zip', zip)).toThrow(/keine lesbare Aktivität/);
  });

  it('markiert GPX ohne Zeitstempel für die Vorschau', () => {
    const gpx = '<gpx><trk><trkseg><trkpt lat="52.5" lon="13.4"></trkpt><trkpt lat="52.51" lon="13.41"></trkpt></trkseg></trk></gpx>';
    const [draft] = parseNamedBuffer('ohne-zeit.gpx', strToU8(gpx)).drafts;
    expect(draft?.activity.startTime).toBeFalsy();
    expect(draft?.warnings.join(' ')).toMatch(/Zeitstempel/);
  });
});

describe('Form ehrlich einordnen', () => {
  const profile = { ...defaultProfile };
  const now = new Date(2026, 7, 20, 20);
  const steady = Array.from({ length: 60 }, (_, i) => applyLoad(run(new Date(2026, 5, 21 + i, 7), 50), profile));

  it('behauptet nach langer Pause keine Erholung', () => {
    const later = new Date(2026, 8, 30);
    const reading = readForm(buildSeries(steady, later), steady, later);
    expect(reading?.tone).toBe('stale');
    expect(reading?.title).not.toMatch(/frisch|gleichgewicht/i);
    expect(reading?.body).toMatch(/lässt sich daraus nicht ablesen/);
    expect(reading?.body).not.toMatch(/du bist erholt|frisch/i);
    const tips = buildTips(steady, later);
    expect(tips.status).toBe('stale');
    expect(tips.tips.map((tip) => tip.id)).not.toContain('fresh-quality');
  });

  it('kennzeichnet die Einlaufphase des Modells', () => {
    const short = steady.slice(-20);
    expect(readForm(buildSeries(short, now), short, now)?.tone).toBe('building');
    expect(readForm([], [], now)).toBeNull();
  });

  it('weist den Dauer-Proxy aus und nennt den höchsten Puls nur als Anhaltspunkt', () => {
    expect(loadMix(steady).proxyShare).toBe(1);
    const withHr = applyLoad(run(day(0), 40, { avgHr: 150, maxHr: 186 }), { ...profile, maxHr: 190, restHr: 50 });
    expect(withHr.loadMethod).toBe('trimp');
    expect(loadMix([withHr]).proxyShare).toBe(0);
    expect(highestRecordedHr([withHr, ...steady])).toBe(186);
  });
});

describe('Strava-Wege', () => {
  const hosted = { clientId: '42', tokenUrl: 'https://proxy.example/token' };

  it('startet ohne Client-ID keinen Login', () => {
    expect(resolveStravaRoute({ clientId: '', clientSecret: '' }, null).kind).toBe('none');
    expect(resolveStravaRoute({ clientId: '', clientSecret: '' }, hosted).kind).toBe('hosted');
    expect(resolveStravaRoute({ clientId: '7', clientSecret: 's' }, hosted).kind).toBe('own');
  });

  it('erneuert ein Token über denselben Weg, über den es geholt wurde', () => {
    const tokens = { accessToken: 'a', refreshToken: 'r', expiresAt: 0, via: 'hosted' as const };
    expect(routeForTokens(tokens, { clientId: '7', clientSecret: 's' }, hosted).kind).toBe('hosted');
    expect(routeForTokens(tokens, { clientId: '', clientSecret: '' }, null).kind).toBe('none');
  });

  it('akzeptiert für den Proxy nur HTTPS, lokal auch HTTP', () => {
    expect(parseHostedConfig('42', 'http://proxy.example/token')).toBeNull();
    expect(parseHostedConfig('42', 'http://127.0.0.1:8787/token')).not.toBeNull();
    expect(parseHostedConfig('abc', 'https://proxy.example/token')).toBeNull();
    expect(parseHostedConfig(undefined, undefined)).toBeNull();
  });

  it('holt beim Abgleich ab einer Woche vor der neuesten Strava-Einheit', () => {
    const latest = new Date('2026-10-10T07:00:00Z');
    const after = incrementalAfter([
      { startTime: latest.toISOString(), sources: [{ kind: 'strava' }] },
      { startTime: '2026-11-01T07:00:00Z', sources: [{ kind: 'file' }] },
    ]);
    expect(after).toBe(Math.floor(latest.getTime() / 1000) - 7 * 86_400);
    expect(incrementalAfter([])).toBeUndefined();
  });

  it('erklärt abgelaufene Codes, Rate-Limits und Proxy-Ausfälle', () => {
    expect(explainStravaFailure({ errors: [{ field: 'code' }] }, 400)).toMatch(/abgelaufen/);
    expect(explainStravaFailure({}, 429)).toMatch(/15 Minuten/);
    expect(explainStravaFailure({}, 502, 'hosted')).toMatch(/nicht erreichbar/);
    expect(explainStravaFailure({ errors: [{ field: 'client_secret' }] }, 400, 'hosted')).not.toMatch(/Secret/);
    expect(describeSync({ added: 1, merged: 2 }, { fetched: 3, limited: true, capped: false })).toMatch(/Rate-Limit/);
  });

  it('übernimmt Strava-Aktivitäten mit ID für die Dublettenprüfung', () => {
    const [draft] = mapStravaActivities([{ id: 5, name: 'Lauf', sport_type: 'Run', start_date: '2026-10-01T06:00:00Z', moving_time: 1800, elapsed_time: 2400, distance: 6000 }]);
    expect(draft?.activity.sources[0]?.externalId).toBe('strava:5');
    expect(draft?.activity.elapsedSec).toBe(2400);
    expect(mapStravaActivities([{ id: 6, start_date: '2026-10-01T06:00:00Z' }])).toHaveLength(0);
  });
});
