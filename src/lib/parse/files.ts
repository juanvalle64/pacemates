import { gunzipSync, unzipSync } from 'fflate';
import type { ParseBatch, ParsedDraft } from '../types.ts';
import { parseCsv } from './csv.ts';
import { parseFit } from './fit.ts';
import { parseGpx } from './gpx.ts';
import { parseTcx } from './tcx.ts';

const MAX_BYTES = 40 * 1024 * 1024;
const MAX_UNZIPPED = 80 * 1024 * 1024;
const MAX_ENTRIES = 400;

function decodeText(bytes: Uint8Array): string {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes);
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes);
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  if (utf8.includes('\uFFFD')) return new TextDecoder('windows-1252').decode(bytes);
  return utf8;
}

function isZip(bytes: Uint8Array, name: string): boolean {
  return name.endsWith('.zip') || (bytes[0] === 0x50 && bytes[1] === 0x4b);
}

function isGzip(bytes: Uint8Array, name: string): boolean {
  return name.endsWith('.gz') || (bytes[0] === 0x1f && bytes[1] === 0x8b);
}

export function parseNamedBuffer(name: string, bytes: Uint8Array, depth = 0): { drafts: ParsedDraft[]; notes: string[] } {
  const lower = name.toLowerCase();
  if (bytes.byteLength > MAX_BYTES && depth === 0) throw new Error('Datei ist größer als 40 MB.');
  if (isGzip(bytes, lower) && !lower.endsWith('.zip')) {
    const unpacked = gunzipSync(bytes);
    const inner = lower.endsWith('.gz') ? name.slice(0, -3) : `${name}.bin`;
    return parseNamedBuffer(inner, unpacked, depth + 1);
  }
  if (isZip(bytes, lower)) {
    if (depth > 1) return { drafts: [], notes: [`${name}: verschachtelte ZIP-Datei übersprungen.`] };
    const entries = unzipSync(bytes);
    const names = Object.keys(entries).filter((entry) => !entry.endsWith('/') && !entry.includes('__MACOSX') && !entry.split('/').pop()?.startsWith('.'));
    if (names.length > MAX_ENTRIES) throw new Error('Das Archiv enthält mehr als 400 Dateien.');
    let total = 0;
    const drafts: ParsedDraft[] = [];
    const notes: string[] = [];
    for (const entry of names) {
      const data = entries[entry];
      if (!data) continue;
      total += data.byteLength;
      if (total > MAX_UNZIPPED) throw new Error('Das Archiv ist entpackt größer als 80 MB.');
      try {
        const parsed = parseNamedBuffer(entry.split('/').pop() || entry, data, depth + 1);
        drafts.push(...parsed.drafts);
        notes.push(...parsed.notes);
      } catch (error) {
        notes.push(`${entry.split('/').pop() || entry}: ${error instanceof Error ? error.message : 'nicht lesbar'}`);
      }
    }
    return { drafts, notes };
  }
  if (lower.endsWith('.fit')) return { drafts: parseFit(bytes, name), notes: [] };
  const text = decodeText(bytes);
  if (lower.endsWith('.gpx') || text.includes('<gpx')) return { drafts: parseGpx(text, name), notes: [] };
  if (lower.endsWith('.tcx') || text.includes('TrainingCenterDatabase')) return { drafts: parseTcx(text, name), notes: [] };
  if (lower.endsWith('.csv') || text.includes(',') || text.includes(';')) {
    const parsed = parseCsv(text, name);
    return { drafts: parsed.drafts, notes: parsed.note ? [parsed.note] : [] };
  }
  throw new Error('Format nicht erkannt. Erlaubt sind GPX, TCX, FIT, CSV und ZIP.');
}

export async function parseFiles(files: File[], onProgress?: (done: number, total: number) => void): Promise<ParseBatch> {
  const drafts: ParsedDraft[] = [];
  const problems: ParseBatch['problems'] = [];
  const notes: string[] = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]!;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const parsed = parseNamedBuffer(file.name, bytes);
      drafts.push(...parsed.drafts);
      notes.push(...parsed.notes);
    } catch (error) {
      problems.push({ file: file.name, message: error instanceof Error ? error.message : 'Datei nicht lesbar.' });
    }
    onProgress?.(index + 1, files.length);
    if (index % 2 === 1) await new Promise((resolve) => setTimeout(resolve, 0));
  }
  return { drafts, problems, notes };
}
