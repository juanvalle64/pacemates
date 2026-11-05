import { parseDateKey } from './dates.ts';

const numberFormat = new Intl.NumberFormat('de-DE');
const oneDecimal = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const maybeDecimal = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });

export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
}

export function formatLoad(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '–';
  return numberFormat.format(Math.round(value));
}

export function formatDuration(seconds: number | undefined): string {
  if (seconds === undefined || !Number.isFinite(seconds)) return '–';
  const rounded = Math.max(0, Math.round(seconds));
  let hours = Math.floor(rounded / 3600);
  let minutes = Math.round((rounded % 3600) / 60);
  if (minutes === 60) {
    hours += 1;
    minutes = 0;
  }
  if (hours >= 100) {
    return `${maybeDecimal.format(rounded / 3600)} h`;
  }
  if (hours <= 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

export function formatDistance(meters: number | undefined): string {
  if (meters === undefined || !Number.isFinite(meters)) return '–';
  if (Math.abs(meters) < 1000) return `${numberFormat.format(Math.round(meters))} m`;
  const km = meters / 1000;
  const formatted = km >= 100 ? numberFormat.format(Math.round(km)) : oneDecimal.format(km);
  return `${formatted} km`;
}

export function formatMeters(meters: number | undefined): string {
  if (meters === undefined || !Number.isFinite(meters)) return '–';
  return `${numberFormat.format(Math.round(meters))} m`;
}

export function formatDate(value: Date | string | undefined, withYear = true): string {
  if (!value) return '–';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '–';
  return new Intl.DateTimeFormat('de-DE', withYear
    ? { day: 'numeric', month: 'short', year: 'numeric' }
    : { day: 'numeric', month: 'short' }).format(date);
}

export function formatDateKey(key: string, withYear = true): string {
  return formatDate(parseDateKey(key), withYear);
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '–';
  return new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(date);
}

export function formatDateTime(iso: string): string {
  if (!iso) return '–';
  return `${formatDate(iso)} · ${formatTime(iso)}`;
}

export function formatRange(start: Date, end: Date): string {
  const sameYear = start.getFullYear() === end.getFullYear();
  return `${formatDate(start, !sameYear)} – ${formatDate(end)}`;
}

export function formatPercent(value: number): string {
  return `${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0, signDisplay: 'exceptZero' }).format(value)} %`;
}

export function formatSigned(value: number, formatAbsolute: (value: number) => string): string {
  if (!Number.isFinite(value) || Object.is(value, 0) || Math.abs(value) < 1e-9) return formatAbsolute(0);
  const sign = value > 0 ? '+' : '−';
  return `${sign}${formatAbsolute(Math.abs(value))}`;
}

export function formatDelta(current: number, previous: number, formatAbsolute: (value: number) => string): string {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return '–';
  const diff = current - previous;
  const signed = formatSigned(diff, formatAbsolute);
  if (Math.abs(previous) < 1e-9) {
    if (Math.abs(current) < 1e-9) return signed;
    return `${signed} (vorher 0)`;
  }
  return `${signed} (${formatPercent((diff / previous) * 100)})`;
}

export function formatRunPace(durationSec: number, distanceM: number): string | undefined {
  if (durationSec <= 0 || distanceM <= 0) return undefined;
  const secondsPerKm = durationSec / (distanceM / 1000);
  if (secondsPerKm < 120 || secondsPerKm > 20 * 60) return undefined;
  const total = Math.round(secondsPerKm);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')} /km`;
}

export function formatSwimPace(durationSec: number, distanceM: number): string | undefined {
  if (durationSec <= 0 || distanceM <= 0) return undefined;
  const seconds = durationSec / (distanceM / 100);
  if (seconds < 30 || seconds > 5 * 60) return undefined;
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')} /100 m`;
}

export function formatSpeed(durationSec: number, distanceM: number): string | undefined {
  if (durationSec <= 0 || distanceM <= 0) return undefined;
  const kmh = distanceM / 1000 / (durationSec / 3600);
  if (kmh < 3 || kmh > 80) return undefined;
  return `${maybeDecimal.format(kmh)} km/h`;
}

export function formatPaceInput(seconds: number | undefined): string {
  if (!seconds || seconds <= 0) return '';
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function parsePaceInput(value: string): number | undefined {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return undefined;
  const seconds = Number(match[1]) * 60 + Number(match[2]);
  return seconds > 0 ? seconds : undefined;
}

export function methodLabel(method: string): string {
  switch (method) {
    case 'trimp':
      return 'TRIMP';
    case 'tss':
      return 'TSS';
    case 'pace':
      return 'Pace';
    case 'duration':
      return 'Dauer-Proxy';
    default:
      return method;
  }
}
