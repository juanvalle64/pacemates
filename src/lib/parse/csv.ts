import { createActivity, hasSignal } from '../activity.ts';
import { normalizeSport } from '../sport.ts';
import type { ParsedDraft } from '../types.ts';
import { elevationGain, haversine, mean } from './geo.ts';

export function parseNumber(raw: string | undefined, european = false): number | undefined {
  if (!raw) return undefined;
  let text = raw.trim();
  if (!text || text === '-' || text === '–') return undefined;
  text = text.replace(/\s/g, '').replace(/[a-zA-Z°%]+$/g, '');
  if (!text) return undefined;
  if (european && /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)) text = text.replace(/\./g, '');
  if (text.includes(',') && text.includes('.')) {
    if (text.lastIndexOf(',') > text.lastIndexOf('.')) text = text.replace(/\./g, '').replace(',', '.');
    else text = text.replace(/,/g, '');
  } else if (text.includes(',')) {
    text = text.replace(',', '.');
  }
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
}

export function parseDateTime(raw: string | undefined): string | null {
  if (!raw) return null;
  const text = raw.trim();
  if (!text) return null;
  const german = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[ T,](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (german) {
    const date = new Date(Number(german[3]), Number(german[2]) - 1, Number(german[1]), Number(german[4] ?? 0), Number(german[5] ?? 0), Number(german[6] ?? 0));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const local = text.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (local) {
    const date = new Date(Number(local[1]), Number(local[2]) - 1, Number(local[3]), Number(local[4]), Number(local[5]), Number(local[6] ?? 0));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const dateOnly = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const date = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12, 0, 0);
    return date.toISOString();
  }
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

export function parseDuration(raw: string | undefined, header = ''): number | undefined {
  if (!raw) return undefined;
  const text = raw.trim();
  if (!text) return undefined;
  if (text.includes(':')) {
    const parts = text.split(':').map((part) => Number(part.replace(',', '.')));
    if (parts.some((part) => !Number.isFinite(part))) return undefined;
    if (parts.length === 3) return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!;
    if (parts.length === 2) return parts[0]! * 60 + parts[1]!;
  }
  const value = parseNumber(text);
  if (value === undefined) return undefined;
  const label = header.toLowerCase();
  if (/elapsed|moving|gesamtzeit|bewegungszeit|sek|second|\(s\)/.test(label)) return value;
  if (/stunde|hour/.test(label)) return value * 3600;
  if (/min/.test(label)) return value * 60;
  return value >= 90 ? value : value * 60;
}

function normHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ø/g, 'o')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function countChar(line: string, char: string): number {
  let count = 0;
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const current = line[index];
    if (current === '"') {
      if (quoted && line[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted && current === char) count += 1;
  }
  return count;
}

function detectDelimiter(text: string): ',' | ';' | '\t' {
  const line = text.split(/\r?\n/, 1)[0] ?? '';
  const comma = countChar(line, ',');
  const semicolon = countChar(line, ';');
  const tab = countChar(line, '\t');
  if (tab >= comma && tab >= semicolon && tab > 0) return '\t';
  if (semicolon > comma) return ';';
  return ',';
}

export function parseCsvTable(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(source);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const current = source[index]!;
    if (quoted) {
      if (current === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else quoted = false;
      } else cell += current;
    } else if (current === '"') quoted = true;
    else if (current === delimiter) {
      row.push(cell);
      cell = '';
    } else if (current === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (current !== '\r') cell += current;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((item) => item.trim() !== ''));
}

function findHeader(headers: string[], patterns: RegExp[], used = new Set<number>()): number | undefined {
  for (const pattern of patterns) {
    const index = headers.findIndex((header, position) => !used.has(position) && pattern.test(header));
    if (index >= 0) return index;
  }
  return undefined;
}

function distanceToMeters(value: number, header: string, samples: number[]): number {
  const label = header.toLowerCase();
  if (/(\bmi\b|mile|meile)/.test(label)) return value * 1609.344;
  if (/(\bkm\b|kilometer)/.test(label)) return value * 1000;
  if (/(meter|\bm\b)/.test(label) && !/km/.test(label)) return value;
  const finite = samples.filter((sample) => Number.isFinite(sample) && sample > 0);
  const max = finite.length > 0 ? Math.max(...finite) : value;
  return max > 400 ? value : value * 1000;
}

function fileStem(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
}

function dateFromFileName(fileName: string): string {
  const match = fileName.match(/(20\d{2})[-_]?(\d{2})[-_]?(\d{2})/);
  if (!match) return '';
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function looksLikeTrack(headers: string[], records: string[][]): boolean {
  const hasLat = headers.some((header) => /latitude|breitengrad|^lat$/.test(header));
  if (hasLat && records.length > 5) return true;
  const dateIndex = headers.findIndex((header) => /datum|date|startzeit|start time|activity date/.test(header));
  if (dateIndex >= 0) {
    const unique = new Set(records.slice(0, 20).map((row) => row[dateIndex]?.trim()).filter(Boolean));
    if (unique.size > 1) return false;
  }
  const timeIndex = headers.findIndex((header) => /^(zeit|time|timestamp)$/.test(header));
  if (timeIndex >= 0 && records.length > 8) {
    const clocks = records.slice(0, 12).filter((row) => /^\d{1,2}:\d{2}:\d{2}$/.test((row[timeIndex] ?? '').trim()));
    if (clocks.length >= 8) return true;
  }
  return false;
}

function summaryDrafts(headers: string[], records: string[][], fileName: string, european: boolean): { drafts: ParsedDraft[]; skipped: number } {
  const used = new Set<number>();
  const take = (patterns: RegExp[]) => {
    const index = findHeader(headers, patterns, used);
    if (index !== undefined) used.add(index);
    return index;
  };
  const dateIndex = take([/activity date/, /start time/, /startzeit/, /datum/, /^date$/, /^zeitpunkt$/]);
  const nameIndex = take([/activity name/, /titel/, /^name$/, /^title$/]);
  const typeIndex = take([/activity type/, /sportart/, /^typ$/, /^type$/, /^sport$/]);
  const movingIndex = take([/moving/, /bewegungszeit/, /timerzeit/]);
  const elapsedIndex = take([/elapsed/, /gesamtzeit/, /^zeit$/, /^dauer$/, /^time$/, /timer time/]);
  const distanceIndex = take([/distanz/, /distance/, /strecke/]);
  const elevationIndex = take([/elevation/, /anstieg/, /aufstieg/, /hohenmeter/, /hoehenmeter/, /ascent/]);
  const maxHrIndex = take([/max.*herz/, /max.*heart/, /max.*\bhf\b/, /maximum heart/]);
  const avgHrIndex = take([/herzfrequenz/, /heart rate/, /\bhr\b/, /\bhf\b/, /puls/]);
  const powerIndex = take([/average watts/, /avg power/, /o leistung/, /durchschnitt.*leistung/, /leistung/, /watts/, /power/]);
  const calorieIndex = take([/calor/, /kalorien/, /kcal/]);
  const idIndex = take([/activity id/, /^id$/]);
  const commuteIndex = findHeader(headers, [/commute/, /pendel/]);
  const distanceSamples = distanceIndex === undefined ? [] : records.map((row) => parseNumber(row[distanceIndex], european)).filter((value): value is number => value !== undefined);
  const stravaLike = headers.some((header) => header.includes('activity id') || header.includes('activity date'));
  const drafts: ParsedDraft[] = [];
  let skipped = 0;
  records.forEach((row, position) => {
    const startTime = dateIndex === undefined ? '' : parseDateTime(row[dateIndex]) ?? '';
    const moving = movingIndex === undefined ? undefined : parseDuration(row[movingIndex], headers[movingIndex] ?? '');
    const elapsed = elapsedIndex === undefined ? undefined : parseDuration(row[elapsedIndex], headers[elapsedIndex] ?? '');
    const durationSec = moving ?? elapsed ?? 0;
    const rawDistance = distanceIndex === undefined ? undefined : parseNumber(row[distanceIndex], european);
    const distanceM = rawDistance === undefined
      ? 0
      : stravaLike
        ? rawDistance
        : distanceToMeters(rawDistance, headers[distanceIndex ?? 0] ?? '', distanceSamples);
    if (!startTime || !hasSignal(durationSec, distanceM)) {
      skipped += 1;
      return;
    }
    const rawType = typeIndex === undefined ? '' : (row[typeIndex] ?? '').trim();
    const sport = normalizeSport(rawType);
    const externalIdValue = idIndex === undefined ? '' : (row[idIndex] ?? '').trim();
    const name = (nameIndex === undefined ? '' : row[nameIndex] ?? '').trim();
    drafts.push({
      warnings: rawType ? [] : ['Sportart fehlt in dieser Zeile.'],
      activity: createActivity({
        name: name || `Aktivität ${position + 1}`,
        sport: sport.sport,
        rawType,
        indoor: sport.indoor,
        commute: commuteIndex !== undefined && /^(1|true|yes|ja|y)$/i.test((row[commuteIndex] ?? '').trim()),
        startTime,
        durationSec,
        elapsedSec: elapsed && moving && elapsed > moving + 30 ? elapsed : undefined,
        distanceM,
        elevationGainM: elevationIndex === undefined ? undefined : parseNumber(row[elevationIndex], european),
        avgHr: avgHrIndex === undefined ? undefined : parseNumber(row[avgHrIndex], european),
        maxHr: maxHrIndex === undefined ? undefined : parseNumber(row[maxHrIndex], european),
        avgPower: powerIndex === undefined ? undefined : parseNumber(row[powerIndex], european),
        calories: calorieIndex === undefined ? undefined : parseNumber(row[calorieIndex], european),
        sources: [{
          kind: 'file',
          label: fileName,
          externalId: externalIdValue ? `${stravaLike ? 'strava' : 'csv'}:${externalIdValue}` : undefined,
        }],
      }),
    });
  });
  return { drafts, skipped };
}

function trackDraft(headers: string[], records: string[][], fileName: string, european: boolean): ParsedDraft {
  const indexOf = (pattern: RegExp) => headers.findIndex((header) => pattern.test(header));
  const timeIndex = indexOf(/^(zeit|time|timestamp|uhrzeit)$/);
  const latIndex = indexOf(/latitude|breitengrad|^lat$/);
  const lonIndex = indexOf(/longitude|laengengrad|^lon$|^lng$/);
  const hrIndex = indexOf(/herz|heart|\bhr\b|\bhf\b|puls/);
  const powerIndex = indexOf(/power|watt|leistung/);
  const distanceIndex = indexOf(/distanz|distance|strecke/);
  const eleIndex = indexOf(/hoehe|hohe|altitude|elevation|^ele$/);
  const times = records.map((row) => (timeIndex >= 0 ? Date.parse(row[timeIndex] ?? '') : Number.NaN));
  const clocks = records.map((row) => parseDuration(timeIndex >= 0 ? row[timeIndex] : undefined, 'zeit'));
  const absolute = times.filter((time) => Number.isFinite(time));
  let startTime = '';
  let durationSec = 0;
  if (absolute.length >= 2) {
    startTime = new Date(Math.min(...absolute)).toISOString();
    durationSec = (Math.max(...absolute) - Math.min(...absolute)) / 1000;
  } else if (clocks.some((value) => value !== undefined)) {
    const values = clocks.filter((value): value is number => value !== undefined);
    durationSec = Math.max(...values) - Math.min(...values);
    startTime = dateFromFileName(fileName);
  }
  let distanceM = 0;
  if (distanceIndex >= 0) {
    const values = records.map((row) => parseNumber(row[distanceIndex], european)).filter((value): value is number => value !== undefined);
    if (values.length >= 2) {
      const delta = Math.max(...values) - Math.min(...values);
      distanceM = distanceToMeters(delta, headers[distanceIndex] ?? '', values);
    }
  }
  if (distanceM <= 0 && latIndex >= 0 && lonIndex >= 0) {
    let previous: { lat: number; lon: number } | undefined;
    for (const row of records) {
      const lat = parseNumber(row[latIndex], european);
      const lon = parseNumber(row[lonIndex], european);
      if (lat === undefined || lon === undefined) continue;
      if (previous) distanceM += haversine(previous.lat, previous.lon, lat, lon);
      previous = { lat, lon };
    }
  }
  const hrs = hrIndex >= 0 ? records.map((row) => parseNumber(row[hrIndex], european)).filter((value): value is number => value !== undefined && value > 30 && value < 240) : [];
  const powers = powerIndex >= 0 ? records.map((row) => parseNumber(row[powerIndex], european)).filter((value): value is number => value !== undefined && value > 0) : [];
  const elevations = eleIndex >= 0 ? records.map((row) => parseNumber(row[eleIndex], european)).filter((value): value is number => value !== undefined) : [];
  const warnings = ['Spur-CSV. Die Sportart steht meist nicht in der Datei.'];
  if (!startTime) warnings.push('Kein Datum in der Spur. Trag die Startzeit ein oder benenne die Datei mit JJJJ-MM-TT.');
  return {
    warnings,
    activity: createActivity({
      name: fileStem(fileName) || 'Aktivität',
      sport: 'other',
      rawType: '',
      startTime,
      durationSec,
      distanceM,
      elevationGainM: elevationGain(elevations),
      avgHr: mean(hrs),
      maxHr: hrs.length > 0 ? Math.max(...hrs) : undefined,
      avgPower: mean(powers),
      sources: [{ kind: 'file', label: fileName }],
    }),
  };
}

export function parseCsv(text: string, fileName: string): { drafts: ParsedDraft[]; note?: string } {
  const rows = parseCsvTable(text);
  if (rows.length < 2) throw new Error('CSV ohne Datenzeilen.');
  if ((rows[0]?.length ?? 0) < 2 && (rows[1]?.length ?? 0) > 2) rows.shift();
  const headers = (rows.shift() ?? []).map(normHeader);
  const records = rows.filter((row) => row.some((cell) => cell.trim() !== ''));
  const european = detectDelimiter(text) === ';';
  if (looksLikeTrack(headers, records)) {
    const draft = trackDraft(headers, records, fileName, european);
    if (!hasSignal(draft.activity.durationSec, draft.activity.distanceM)) throw new Error('Spur-CSV ohne Dauer oder Distanz.');
    return { drafts: [draft] };
  }
  const { drafts, skipped } = summaryDrafts(headers, records, fileName, european);
  if (drafts.length === 0) throw new Error('Keine Zeile mit Datum und Dauer oder Distanz.');
  return {
    drafts,
    note: skipped > 0 ? `${fileName}: ${skipped} Zeilen ohne Datum oder ohne Dauer und Distanz übersprungen.` : undefined,
  };
}
