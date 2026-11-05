import type { Activity, ActivityLeg, AthleteProfile, LoadedActivity, LoadMethod, Sport } from './types.ts';

export function bannisterTrimp(durationSec: number, avgHr: number, profile: AthleteProfile): number | undefined {
  if (!profile.maxHr || !profile.restHr || profile.maxHr <= profile.restHr) return undefined;
  if (durationSec <= 0 || avgHr < 40) return undefined;
  const reserve = (avgHr - profile.restHr) / (profile.maxHr - profile.restHr);
  if (reserve <= 0.05 || reserve > 1.25) return undefined;
  const minutes = durationSec / 60;
  return minutes * reserve * 0.64 * Math.exp(profile.trimpK * reserve);
}

function powerLoad(durationSec: number, power: number | undefined, ftp: number | undefined): number | undefined {
  if (!power || !ftp || durationSec <= 0 || power <= 0 || ftp <= 0) return undefined;
  const intensity = power / ftp;
  if (intensity < 0.3 || intensity > 1.8) return undefined;
  return (durationSec / 3600) * intensity * intensity * 100;
}

function paceLoad(durationSec: number, distanceM: number, thresholdSec: number, metersPerUnit: number): number | undefined {
  if (durationSec <= 0 || distanceM <= 0 || thresholdSec <= 0) return undefined;
  const pace = durationSec / (distanceM / metersPerUnit);
  const intensity = thresholdSec / pace;
  if (intensity < 0.45 || intensity > 1.5) return undefined;
  return (durationSec / 3600) * intensity * intensity * 100;
}

function durationLoad(durationSec: number, sport: Sport): number {
  const factor = sport === 'bike' ? 0.85 : sport === 'other' ? 0.6 : sport === 'multisport' ? 0.95 : 1;
  return (durationSec / 60) * factor;
}

interface LoadResult {
  load: number;
  loadMethod: LoadMethod;
  loadNote: string;
}

function fromLeg(leg: ActivityLeg, profile: AthleteProfile): LoadResult | undefined {
  const trimp = leg.avgHr ? bannisterTrimp(leg.durationSec, leg.avgHr, profile) : undefined;
  if (trimp !== undefined) {
    const reserve = profile.maxHr && profile.restHr ? (leg.avgHr! - profile.restHr) / (profile.maxHr - profile.restHr) : 0;
    return {
      load: trimp,
      loadMethod: 'trimp',
      loadNote: reserve > 1 ? 'TRIMP, Puls über der eingetragenen maximalen Herzfrequenz' : 'TRIMP aus Herzfrequenz',
    };
  }
  const tss = powerLoad(leg.durationSec, leg.avgPower, profile.ftp);
  if (tss !== undefined) return { load: tss, loadMethod: 'tss', loadNote: 'TSS aus Ø-Leistung und FTP, ohne Normalized Power' };
  if (leg.sport === 'run' && profile.runThresholdPaceSec) {
    const pace = paceLoad(leg.durationSec, leg.distanceM, profile.runThresholdPaceSec, 1000);
    if (pace !== undefined) return { load: pace, loadMethod: 'pace', loadNote: 'rTSS aus Pace und Schwellenpace' };
  }
  if (leg.sport === 'swim' && profile.swimThresholdPaceSec) {
    const pace = paceLoad(leg.durationSec, leg.distanceM, profile.swimThresholdPaceSec, 100);
    if (pace !== undefined) return { load: pace, loadMethod: 'pace', loadNote: 'sTSS aus Pace und Schwellenpace je 100 m' };
  }
  return undefined;
}

export function applyLoad(activity: Activity, profile: AthleteProfile): LoadedActivity {
  if (activity.deviceLoad && activity.deviceLoad > 0) {
    return { ...activity, load: activity.deviceLoad, loadMethod: 'tss', loadNote: 'TSS aus der Datei' };
  }
  const legs = activity.legs.length > 0 ? activity.legs : [];
  if (legs.length > 1) {
    const parts = legs.map((leg) => fromLeg(leg, profile));
    if (parts.every((part) => part !== undefined)) {
      const defined = parts as LoadResult[];
      const methods = new Set(defined.map((part) => part.loadMethod));
      return {
        ...activity,
        load: defined.reduce((sum, part) => sum + part.load, 0),
        loadMethod: methods.size === 1 ? defined[0]!.loadMethod : 'trimp',
        loadNote: methods.size === 1 ? `${defined[0]!.loadNote}, je Abschnitt` : 'Belastung je Abschnitt, gemischte Verfahren',
      };
    }
  }
  const whole = fromLeg({
    sport: activity.sport === 'multisport' ? 'other' : activity.sport,
    durationSec: activity.durationSec,
    distanceM: activity.distanceM,
    avgHr: activity.avgHr,
    avgPower: activity.normPower ?? activity.avgPower,
  }, profile);
  if (whole) {
    const note = activity.normPower && whole.loadMethod === 'tss'
      ? 'TSS aus Normalized Power und FTP'
      : whole.loadNote;
    return { ...activity, ...whole, loadNote: note };
  }
  if (activity.sport === 'run' && profile.runThresholdPaceSec) {
    const pace = paceLoad(activity.durationSec, activity.distanceM, profile.runThresholdPaceSec, 1000);
    if (pace !== undefined) return { ...activity, load: pace, loadMethod: 'pace', loadNote: 'rTSS aus Pace und Schwellenpace' };
  }
  if (activity.sport === 'swim' && profile.swimThresholdPaceSec) {
    const pace = paceLoad(activity.durationSec, activity.distanceM, profile.swimThresholdPaceSec, 100);
    if (pace !== undefined) return { ...activity, load: pace, loadMethod: 'pace', loadNote: 'sTSS aus Pace und Schwellenpace je 100 m' };
  }
  return {
    ...activity,
    load: durationLoad(activity.durationSec, activity.sport),
    loadMethod: 'duration',
    loadNote: 'Dauer-Proxy: keine verwertbare Herzfrequenz, Leistung oder Schwellenpace',
  };
}
