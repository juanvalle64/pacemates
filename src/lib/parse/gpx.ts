import { createActivity, hasSignal } from '../activity.ts';
import { normalizeSport } from '../sport.ts';
import type { ParsedDraft } from '../types.ts';
import { elevationGain, haversine, mean } from './geo.ts';
import { byLocal, childText, numberFrom, parseXml } from './xml.ts';

interface Point {
  lat: number;
  lon: number;
  ele?: number;
  time?: number;
  hr?: number;
  power?: number;
}

interface TrackDraft {
  name?: string;
  type?: string;
  points: Point[];
}

function fileStem(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
}

function readPoint(element: Element): Point | null {
  const lat = Number(element.getAttribute('lat'));
  const lon = Number(element.getAttribute('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const timeText = childText(element, 'time');
  const time = timeText ? Date.parse(timeText) : undefined;
  return {
    lat,
    lon,
    ele: numberFrom(childText(element, 'ele')),
    time: time !== undefined && Number.isFinite(time) ? time : undefined,
    hr: numberFrom(byLocal(element, 'hr')[0]?.textContent ?? undefined),
    power: numberFrom(byLocal(element, 'power')[0]?.textContent ?? undefined),
  };
}

function readTrack(element: Element): TrackDraft {
  return {
    name: childText(element, 'name'),
    type: childText(element, 'type'),
    points: byLocal(element, 'trkpt').flatMap((point) => {
      const parsed = readPoint(point);
      return parsed ? [parsed] : [];
    }),
  };
}

function firstTime(track: TrackDraft): number | undefined {
  return track.points.find((point) => point.time !== undefined)?.time;
}

function lastTime(track: TrackDraft): number | undefined {
  for (let index = track.points.length - 1; index >= 0; index -= 1) {
    if (track.points[index]?.time !== undefined) return track.points[index]?.time;
  }
  return undefined;
}

function groupTracks(tracks: TrackDraft[]): TrackDraft[] {
  const sorted = [...tracks].filter((track) => track.points.length > 0).sort((a, b) => (firstTime(a) ?? 0) - (firstTime(b) ?? 0));
  const groups: TrackDraft[] = [];
  for (const track of sorted) {
    const previous = groups[groups.length - 1];
    const start = firstTime(track);
    const previousEnd = previous ? lastTime(previous) : undefined;
    if (previous && start !== undefined && previousEnd !== undefined && start - previousEnd < 15 * 60_000 && start >= previousEnd - 60_000) {
      previous.points.push(...track.points);
      previous.name ||= track.name;
      previous.type ||= track.type;
    } else {
      groups.push({ name: track.name, type: track.type, points: [...track.points] });
    }
  }
  return groups;
}

function activityFromTrack(track: TrackDraft, fileName: string): ParsedDraft | null {
  const warnings: string[] = [];
  let distance = 0;
  let moving = 0;
  const elevations: number[] = [];
  const hrs: number[] = [];
  const powers: number[] = [];
  for (let index = 0; index < track.points.length; index += 1) {
    const point = track.points[index]!;
    if (point.ele !== undefined) elevations.push(point.ele);
    if (point.hr && point.hr > 30 && point.hr < 240) hrs.push(point.hr);
    if (point.power && point.power > 0 && point.power < 2500) powers.push(point.power);
    if (index === 0) continue;
    const previous = track.points[index - 1]!;
    const segment = haversine(previous.lat, previous.lon, point.lat, point.lon);
    const dt = point.time !== undefined && previous.time !== undefined ? (point.time - previous.time) / 1000 : undefined;
    const speed = dt && dt > 0 ? segment / dt : undefined;
    if (segment >= 0 && (speed === undefined || speed <= 50)) distance += segment;
    if (dt && dt > 0 && speed !== undefined && speed >= 0.4 && speed <= 50) moving += dt;
  }
  const startMs = firstTime(track);
  const endMs = lastTime(track);
  const elapsed = startMs !== undefined && endMs !== undefined ? Math.max(0, (endMs - startMs) / 1000) : 0;
  const durationSec = moving >= elapsed * 0.5 && moving > 0 ? moving : elapsed;
  if (!hasSignal(durationSec, distance)) return null;
  if (startMs === undefined) warnings.push('GPX ohne Zeitstempel. Trag die Startzeit in der Vorschau ein.');
  const sportSource = track.type || track.name || '';
  const sport = normalizeSport(sportSource);
  if (!sportSource) warnings.push('Sportart steht nicht in der Datei. Du kannst sie vor dem Übernehmen setzen.');
  const activity = createActivity({
    name: track.name || fileStem(fileName) || 'Aktivität',
    sport: sport.sport,
    rawType: track.type || '',
    indoor: sport.indoor,
    startTime: startMs !== undefined ? new Date(startMs).toISOString() : '',
    durationSec,
    elapsedSec: elapsed > durationSec + 30 ? elapsed : undefined,
    distanceM: distance,
    elevationGainM: elevationGain(elevations),
    avgHr: mean(hrs),
    maxHr: hrs.length > 0 ? Math.max(...hrs) : undefined,
    avgPower: mean(powers),
    sources: [{ kind: 'file', label: fileName }],
  });
  return { activity, warnings };
}

export function parseGpx(text: string, fileName: string): ParsedDraft[] {
  const doc = parseXml(text);
  const tracks = groupTracks(byLocal(doc, 'trk').map(readTrack));
  const drafts = tracks.flatMap((track) => {
    const draft = activityFromTrack(track, fileName);
    return draft ? [draft] : [];
  });
  if (drafts.length === 0) throw new Error('Keine GPX-Spur mit Koordinaten erkannt.');
  return drafts;
}
