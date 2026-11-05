import { Encoder, Profile } from '@garmin/fitsdk';
import { describe, expect, it } from 'vitest';
import { createActivity, isSameActivity, mergeActivities } from './activity.ts';
import { buildSeries } from './series.ts';
import { bannisterTrimp } from './load.ts';
import { applyLoad } from './load.ts';
import { buildAuthorizeUrl, createPkce, explainStravaFailure } from './strava.ts';
import { aggregate, weeklyBuckets } from './stats.ts';
import { buildTips } from './tips.ts';
import { defaultProfile, type LoadedActivity } from './types.ts';
import { startOfIsoWeek, localDateKey } from './dates.ts';
import { parseFit } from './parse/fit.ts';
import { parseGpx } from './parse/gpx.ts';
import { parseTcx } from './parse/tcx.ts';
import { parseCsv, parseDateTime, parseNumber } from './parse/csv.ts';
import { zipSync, strToU8 } from 'fflate';
import { parseNamedBuffer } from './parse/files.ts';
import { normalizeSport } from './sport.ts';

function at(year: number, month: number, day: number, hour = 12, minute = 0): Date {
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function loadedRun(date: Date, minutes: number, km = minutes / 6): LoadedActivity {
  return applyLoad(createActivity({
    name: 'Lauf',
    sport: 'run',
    rawType: 'running',
    startTime: date.toISOString(),
    durationSec: minutes * 60,
    distanceM: km * 1000,
    sources: [{ kind: 'file', label: 'lauf.gpx' }],
  }), defaultProfile);
}

describe('Sportarten', () => {
  it('erkennt Lauf, Rad, Schwimmen und Kombi', () => {
    expect(normalizeSport('TrailRun').sport).toBe('run');
    expect(normalizeSport('VirtualRide')).toEqual({ sport: 'bike', indoor: true });
    expect(normalizeSport('OpenWaterSwim').sport).toBe('swim');
    expect(normalizeSport('Triathlon').sport).toBe('multisport');
    expect(normalizeSport('Hike').sport).toBe('other');
    expect(normalizeSport('Radfahren').sport).toBe('bike');
  });
});

describe('Belastung und Form', () => {
  it('rechnet Bannister-TRIMP im erwarteten Bereich', () => {
    const load = bannisterTrimp(3600, 150, { ...defaultProfile, maxHr: 190, restHr: 60 });
    expect(load).toBeGreaterThan(95);
    expect(load).toBeLessThan(110);
  });

  it('lässt CTL bei konstanter Belastung gegen den Tageswert laufen', () => {
    const activities = Array.from({ length: 42 }, (_, index) => loadedRun(at(2024, 1, index + 1), 60, 10));
    const series = buildSeries(activities, at(2024, 1, 42, 18));
    const closed = 60 * (1 - (1 - 1 / 42) ** 42);
    expect(series.at(-1)?.ctl).toBeCloseTo(closed, 1);
    expect(series[0]?.tsb).toBe(0);
  });

  it('gibt ohne Aktivitäten keine Tipps aus', () => {
    expect(buildTips([])).toEqual({ status: 'empty', tips: [], facts: [] });
    const one = buildTips([loadedRun(at(2024, 3, 1), 40)]);
    expect(one.status).toBe('thin');
    expect(one.tips).toHaveLength(0);
  });

  it('meldet einen steilen Belastungsanstieg mit den echten Summen', () => {
    const easy = Array.from({ length: 7 }, (_, index) => loadedRun(at(2024, 4, index + 1), 30, 5));
    const hard = Array.from({ length: 7 }, (_, index) => loadedRun(at(2024, 4, index + 8), 90, 15));
    const report = buildTips([...easy, ...hard], at(2024, 4, 14, 18));
    const tip = report.tips.find((item) => item.id === 'load-jump');
    expect(tip).toBeTruthy();
    expect(tip?.evidence.some((item) => item.value === '210')).toBe(true);
    expect(tip?.evidence.some((item) => item.value === '630')).toBe(true);
  });
});

describe('Vergleich und Duplikate', () => {
  it('rechnet die Differenz zweier Zeiträume', () => {
    const activities = [
      loadedRun(at(2024, 5, 2), 40, 8),
      loadedRun(at(2024, 5, 10), 80, 16),
    ];
    const left = aggregate(activities, { start: at(2024, 5, 8), end: new Date(2024, 4, 14, 23, 59, 59) });
    const right = aggregate(activities, { start: at(2024, 5, 1), end: new Date(2024, 4, 7, 23, 59, 59) });
    expect(left.durationSec).toBe(80 * 60);
    expect(right.durationSec).toBe(40 * 60);
  });

  it('führt dieselbe Einheit zusammen und trennt Lauf von Rad', () => {
    const file = createActivity({
      name: 'lauf.gpx',
      sport: 'other',
      startTime: at(2024, 6, 1, 7).toISOString(),
      durationSec: 3600,
      distanceM: 10000,
      avgHr: 150,
      sources: [{ kind: 'file', label: 'lauf.gpx' }],
    });
    const strava = createActivity({
      name: 'Morgenlauf',
      sport: 'run',
      startTime: at(2024, 6, 1, 7, 1).toISOString(),
      durationSec: 3580,
      distanceM: 10040,
      sources: [{ kind: 'strava', label: 'Strava', externalId: 'strava:1' }],
    });
    expect(isSameActivity(file, strava)).toBe(true);
    const merged = mergeActivities(file, strava);
    expect(merged.sport).toBe('run');
    expect(merged.avgHr).toBe(150);
    expect(merged.name).toBe('Morgenlauf');
    const ride = createActivity({
      name: 'Fahrt',
      sport: 'bike',
      startTime: file.startTime,
      durationSec: 3600,
      distanceM: 10000,
      sources: [{ kind: 'strava', label: 'Strava', externalId: 'strava:2' }],
    });
    expect(isSameActivity(strava, ride)).toBe(false);
  });

  it('zählt die laufende Woche mit', () => {
    const activities = [
      loadedRun(at(2026, 10, 26), 40, 8),
      loadedRun(at(2026, 11, 4), 45, 9),
    ];
    const buckets = weeklyBuckets(activities, { start: at(2026, 10, 26), end: at(2026, 11, 5) }, 'all', at(2026, 11, 5, 18));
    expect(buckets.map((bucket) => bucket.start)).toEqual(['2026-10-26', '2026-11-02']);
    expect(buckets[1]?.activities).toBe(1);
    expect(buckets[0]?.durationSec).toBe(40 * 60);
  });

  it('beginnt die Woche am Montag', () => {
    expect(localDateKey(startOfIsoWeek(at(2026, 11, 5)))).toBe('2026-11-02');
  });
});

describe('Dateien', () => {
  it('liest GPX mit Puls und Distanz', () => {
    const gpx = `<?xml version="1.0"?>
      <gpx><trk><name>Runde</name><type>running</type><trkseg>
        <trkpt lat="52.5" lon="13.4"><ele>40</ele><time>2024-05-01T08:00:00Z</time><extensions><hr>140</hr></extensions></trkpt>
        <trkpt lat="52.51" lon="13.4"><ele>48</ele><time>2024-05-01T08:10:00Z</time><extensions><hr>150</hr></extensions></trkpt>
      </trkseg></trk></gpx>`;
    const [draft] = parseGpx(gpx, 'runde.gpx');
    expect(draft?.activity.sport).toBe('run');
    expect(draft?.activity.distanceM).toBeGreaterThan(1000);
    expect(draft?.activity.distanceM).toBeLessThan(1200);
    expect(draft?.activity.avgHr).toBe(145);
    expect(draft?.activity.durationSec).toBe(600);
  });

  it('liest TCX-Runden', () => {
    const tcx = `<?xml version="1.0"?>
      <TrainingCenterDatabase><Activities><Activity Sport="Biking">
        <Id>2024-05-02T09:00:00Z</Id>
        <Lap><TotalTimeSeconds>1800</TotalTimeSeconds><DistanceMeters>15000</DistanceMeters>
          <AverageHeartRateBpm><Value>132</Value></AverageHeartRateBpm>
        </Lap>
      </Activity></Activities></TrainingCenterDatabase>`;
    const [draft] = parseTcx(tcx, 'fahrt.tcx');
    expect(draft?.activity.sport).toBe('bike');
    expect(draft?.activity.distanceM).toBe(15000);
    expect(draft?.activity.durationSec).toBe(1800);
    expect(draft?.activity.avgHr).toBe(132);
  });

  it('liest eine deutsche CSV mit Semikolon', () => {
    const csv = 'Datum;Titel;Typ;Distanz;Zeit;Ø Herzfrequenz\n01.06.2024 07:30;See;Laufen;12,5;1:02:00;148\n';
    const { drafts } = parseCsv(csv, 'garmin.csv');
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.activity.sport).toBe('run');
    expect(drafts[0]?.activity.distanceM).toBeCloseTo(12500, 0);
    expect(drafts[0]?.activity.durationSec).toBe(3720);
    expect(drafts[0]?.activity.avgHr).toBe(148);
  });

  it('behandelt Strava-Distanz als Meter', () => {
    const csv = 'Activity Date,Activity Name,Activity Type,Elapsed Time,Distance,Activity ID\n2024-06-01 07:30:00,Morgen,Run,3600,10000,99\n';
    const { drafts } = parseCsv(csv, 'activities.csv');
    expect(drafts[0]?.activity.distanceM).toBe(10000);
    expect(drafts[0]?.activity.sources[0]?.externalId).toBe('strava:99');
  });

  it('packt GPX aus einem ZIP', () => {
    const gpx = '<gpx><trk><name>Zip</name><type>running</type><trkseg><trkpt lat="48" lon="11"><time>2024-07-01T06:00:00Z</time></trkpt><trkpt lat="48.02" lon="11"><time>2024-07-01T06:20:00Z</time></trkpt></trkseg></trk></gpx>';
    const zipped = zipSync({ 'lauf.gpx': strToU8(gpx) });
    const parsed = parseNamedBuffer('export.zip', zipped);
    expect(parsed.drafts).toHaveLength(1);
    expect(parsed.drafts[0]?.activity.sport).toBe('run');
  });

  it('liest eine FIT-Aktivität', () => {
    const start = new Date(2024, 5, 1, 8, 0, 0);
    const encoder = new Encoder();
    const fileId = {
      type: 'activity',
      manufacturer: 'development',
      product: 1,
      timeCreated: start,
    };
    const session = {
      timestamp: new Date(start.getTime() + 3_600_000),
      startTime: start,
      sport: 'running',
      totalElapsedTime: 3600,
      totalTimerTime: 3500,
      totalDistance: 10000,
      avgHeartRate: 150,
      maxHeartRate: 170,
      totalAscent: 42,
    };
    encoder.onMesg(Profile.MesgNum.FILE_ID, fileId as never);
    encoder.onMesg(Profile.MesgNum.SESSION, session as never);
    const [draft] = parseFit(encoder.close(), 'morgen.fit');
    expect(draft?.activity.sport).toBe('run');
    expect(draft?.activity.durationSec).toBeCloseTo(3500, 0);
    expect(draft?.activity.distanceM).toBeCloseTo(10000, 0);
    expect(draft?.activity.avgHr).toBe(150);
  });

  it('parst deutsche und ISO-Zeiten', () => {
    expect(parseDateTime('01.02.2024 07:30')).toBe(new Date(2024, 1, 1, 7, 30).toISOString());
    expect(parseNumber('1.234,5', true)).toBe(1234.5);
  });
});

describe('Strava-OAuth', () => {
  it('baut eine PKCE-Adresse ohne Secret', async () => {
    const pkce = await createPkce();
    const url = new URL(buildAuthorizeUrl('123', 'http://127.0.0.1/strava/callback', pkce.challenge, pkce.state));
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('client_id')).toBe('123');
    expect(url.searchParams.get('code_challenge')?.length).toBeGreaterThan(20);
    expect(url.toString()).not.toContain('client_secret');
    const message = explainStravaFailure({ message: 'Bad Request', errors: [{ field: 'client_secret', code: 'invalid' }] }, 400);
    expect(message).toMatch(/Client Secret/);
  });
});
