export interface DateRange {
  start: Date;
  end: Date;
}

export type RangePreset = '7' | '28' | '90' | '365' | 'all';
export type ComparePreset = 'week' | 'month' | 'd7' | 'd28' | 'custom';

export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year || 1970, (month || 1) - 1, day || 1, 12, 0, 0, 0);
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
  next.setDate(next.getDate() + days);
  return next;
}

export function localDaySpan(a: Date, b: Date): number {
  const start = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const end = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((end - start) / 86_400_000);
}

export function startOfIsoWeek(date: Date): Date {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
  const offset = (day.getDay() + 6) % 7;
  day.setDate(day.getDate() - offset);
  return startOfDay(day);
}

export function daysInRange(range: DateRange): number {
  return localDaySpan(range.start, range.end) + 1;
}

export function isInRange(iso: string, range: DateRange): boolean {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return false;
  return time >= range.start.getTime() && time <= range.end.getTime();
}

export function presetRange(preset: RangePreset, now: Date, earliest?: Date): DateRange | null {
  if (preset === 'all') {
    if (!earliest) return null;
    return { start: startOfDay(earliest), end: endOfDay(now) };
  }
  const days = Number(preset);
  return { start: startOfDay(addDays(now, -(days - 1))), end: endOfDay(now) };
}

export interface NamedRange extends DateRange {
  label: string;
}

export function comparePreset(preset: Exclude<ComparePreset, 'custom'>, now: Date): { current: NamedRange; previous: NamedRange } {
  if (preset === 'week') {
    const thisMonday = startOfIsoWeek(now);
    const prevMonday = addDays(thisMonday, -7);
    return {
      current: { label: 'Diese Woche', start: startOfDay(thisMonday), end: endOfDay(now) },
      previous: { label: 'Letzte Woche', start: startOfDay(prevMonday), end: endOfDay(addDays(thisMonday, -1)) },
    };
  }
  if (preset === 'month') {
    const currentStart = new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0, 0);
    const prevEnd = addDays(currentStart, -1);
    const prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth(), 1, 12, 0, 0, 0);
    return {
      current: { label: 'Dieser Monat', start: startOfDay(currentStart), end: endOfDay(now) },
      previous: { label: 'Letzter Monat', start: startOfDay(prevStart), end: endOfDay(prevEnd) },
    };
  }
  const length = preset === 'd28' ? 28 : 7;
  const currentStart = addDays(now, -(length - 1));
  const previousEnd = addDays(currentStart, -1);
  const previousStart = addDays(previousEnd, -(length - 1));
  const label = length === 28 ? '28 Tage' : '7 Tage';
  return {
    current: { label: `Letzte ${label}`, start: startOfDay(currentStart), end: endOfDay(now) },
    previous: { label: `${label} davor`, start: startOfDay(previousStart), end: endOfDay(previousEnd) },
  };
}

export function rangeFromKeys(startKey: string, endKey: string): DateRange | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startKey) || !/^\d{4}-\d{2}-\d{2}$/.test(endKey)) return null;
  const start = parseDateKey(startKey);
  const end = parseDateKey(endKey);
  if (start.getTime() > end.getTime()) return null;
  return { start: startOfDay(start), end: endOfDay(end) };
}

export function toDateInputValue(date: Date): string {
  return localDateKey(date);
}

export function toDatetimeLocalValue(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDatetimeLocalValue(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
}
