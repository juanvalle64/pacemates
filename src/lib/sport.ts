import type { Sport } from './types.ts';

export const SPORT_ORDER: Sport[] = ['run', 'bike', 'swim', 'multisport', 'other'];

export function sportLabel(sport: Sport): string {
  switch (sport) {
    case 'run':
      return 'Laufen';
    case 'bike':
      return 'Radfahren';
    case 'swim':
      return 'Schwimmen';
    case 'multisport':
      return 'Kombi';
    default:
      return 'Andere';
  }
}

export function sportShort(sport: Sport): string {
  switch (sport) {
    case 'run':
      return 'Lauf';
    case 'bike':
      return 'Rad';
    case 'swim':
      return 'Schwimmen';
    case 'multisport':
      return 'Kombi';
    default:
      return 'Andere';
  }
}

const OTHER_SPORT =
  /motor|snow|ski|yoga|pilates|kraft|strength|weight|walk|hike|wander|golf|tennis|soccer|football|basket|horse|reit|paddl|kayak|surf|climb|box|row/;

export function normalizeSport(raw: string): { sport: Sport; indoor: boolean } {
  const text = raw
    .toLowerCase()
    .replace(/[_./]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const indoor = /indoor|virtual|treadmill|trainer|rolle|laufband|ergometer|zwift/.test(text);
  if (!text) return { sport: 'other', indoor };
  if (/swim ?run|swimrun|brick|triathlon|duathlon|multisp|koppel|kombi/.test(text)) {
    return { sport: 'multisport', indoor };
  }
  if (OTHER_SPORT.test(text)) return { sport: 'other', indoor };
  if (/swim|schwimm|open water/.test(text)) return { sport: 'swim', indoor };
  if (/e-?bike|ebike|ride|cycling|cycle|biking|\bbike\b|radfahr|rennrad|\brad\b|velo|gravel|\bmtb\b|handcycle|spinning/.test(text)) {
    return { sport: 'bike', indoor };
  }
  if (/\brun\b|running|lauf|jog|trail|marathon/.test(text)) return { sport: 'run', indoor };
  return { sport: 'other', indoor };
}

export function sportsCompatible(a: Sport, b: Sport): boolean {
  if (a === b) return true;
  if (a === 'other' || b === 'other') return true;
  if (a === 'multisport' || b === 'multisport') return true;
  return false;
}

export function emptySportNumbers(): Record<Sport, number> {
  return { run: 0, bike: 0, swim: 0, multisport: 0, other: 0 };
}
