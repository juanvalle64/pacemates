import { addDays, localDateKey, localDaySpan } from './dates.ts';
import { formatDate, formatDuration, formatLoad, formatNumber } from './format.ts';
import { buildSeries } from './series.ts';
import { sliceActivity } from './stats.ts';
import type { DailyPoint, LoadedActivity, Sport } from './types.ts';

export interface Tip {
  id: string;
  severity: 'high' | 'medium' | 'info' | 'positive';
  title: string;
  body: string;
  evidence: { label: string; value: string }[];
}

export interface TipReport {
  status: 'empty' | 'thin' | 'stale' | 'ready';
  tips: Tip[];
  facts: { label: string; value: string }[];
}

const rank: Record<Tip['severity'], number> = { high: 0, medium: 1, positive: 2, info: 3 };

function loadsEnding(series: DailyPoint[], end: Date, days: number): number[] {
  const map = new Map(series.map((point) => [point.date, point.load]));
  const values: number[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    values.push(map.get(localDateKey(addDays(end, -offset))) ?? 0);
  }
  return values;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function inWindow(activities: LoadedActivity[], end: Date, days: number): LoadedActivity[] {
  const endKey = localDateKey(end);
  const startKey = localDateKey(addDays(end, -(days - 1)));
  return activities.filter((activity) => {
    const key = localDateKey(new Date(activity.startTime));
    return key >= startKey && key <= endKey;
  });
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return sum(values) / values.length;
}

function stdev(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = mean(values);
  const variance = mean(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
}

function sportCount(activities: LoadedActivity[], sport: Sport): number {
  return activities.filter((activity) => sliceActivity(activity, sport) !== null).length;
}

function sportDistance(activities: LoadedActivity[], sport: Sport): number {
  return activities.reduce((total, activity) => total + (sliceActivity(activity, sport)?.distanceM ?? 0), 0);
}

function longestSport(activities: LoadedActivity[], sport: Sport): number {
  return activities.reduce((max, activity) => Math.max(max, sliceActivity(activity, sport)?.distanceM ?? 0), 0);
}

function hours(activities: LoadedActivity[]): number {
  return activities.reduce((total, activity) => total + activity.durationSec, 0) / 3600;
}

function intensity(activities: LoadedActivity[]): number | undefined {
  const duration = activities.reduce((total, activity) => total + activity.durationSec, 0);
  if (duration <= 0) return undefined;
  const load = activities.reduce((total, activity) => total + activity.load, 0);
  return load / (duration / 3600);
}

export function buildTips(activities: LoadedActivity[], now = new Date()): TipReport {
  if (activities.length === 0) return { status: 'empty', tips: [], facts: [] };
  const stamped = activities.filter((activity) => Number.isFinite(Date.parse(activity.startTime)));
  if (stamped.length === 0) return { status: 'empty', tips: [], facts: [] };
  const times = stamped.map((activity) => new Date(activity.startTime));
  const earliest = new Date(Math.min(...times.map((date) => date.getTime())));
  const latest = new Date(Math.max(...times.map((date) => date.getTime())));
  const inclusiveDays = localDaySpan(earliest, latest) + 1;
  const daysSince = Math.max(0, localDaySpan(latest, now));
  const facts = [
    { label: 'Aktivitäten', value: formatNumber(stamped.length) },
    { label: 'Erste Einheit', value: formatDate(earliest) },
    { label: 'Letzte Einheit', value: formatDate(latest) },
    { label: 'Zeitraum', value: `${formatNumber(inclusiveDays)} Tage` },
    { label: 'Tage seit der letzten Einheit', value: formatNumber(daysSince) },
  ];
  if (stamped.length < 3 || inclusiveDays < 7) return { status: 'thin', tips: [], facts };

  const series = buildSeries(stamped, now);
  const anchor = daysSince <= 2 ? now : latest;
  const anchorKey = localDateKey(anchor);
  const anchorPoint = series.find((point) => point.date === anchorKey) ?? series[series.length - 1];
  const history = series.length;
  const proxyLoad = stamped.reduce((total, activity) => total + (activity.loadMethod === 'duration' ? activity.load : 0), 0);
  const totalLoad = stamped.reduce((total, activity) => total + activity.load, 0);
  const proxyHeavy = totalLoad > 0 && proxyLoad / totalLoad > 0.5;
  const proxyFact = proxyHeavy
    ? { label: 'Modellhinweis', value: `Dauer-Proxy ${formatNumber((proxyLoad / totalLoad) * 100)} % der Belastung` }
    : null;

  const tips: Tip[] = [];
  const cite = (evidence: Tip['evidence']): Tip['evidence'] => (proxyFact ? [...evidence, proxyFact] : evidence);

  if (daysSince > 10) {
    tips.push({
      id: 'stale',
      severity: 'info',
      title: 'Die letzte Einheit liegt zurück',
      body: `Die letzte importierte Aktivität ist vom ${formatDate(latest)}, das sind ${formatNumber(daysSince)} Tage vor heute. Formwerte bis heute rechnen fehlende Tage mit Belastung 0. Das stimmt nur, wenn du seitdem wirklich nicht trainiert hast. Hol die fehlenden Einheiten, bevor du aus der Form eine Entscheidung für heute ableitest.`,
      evidence: cite([
        { label: 'Letzte Aktivität', value: formatDate(latest) },
        { label: 'Tage ohne importierte Einheit', value: formatNumber(daysSince) },
      ]),
    });
  }

  const recent7 = inWindow(stamped, anchor, 7);
  const prev7 = inWindow(stamped, addDays(anchor, -7), 7);
  const load7 = sum(loadsEnding(series, anchor, 7));
  const loadPrev7 = sum(loadsEnding(series, addDays(anchor, -7), 7));
  const jumpRatio = loadPrev7 > 0 ? load7 / loadPrev7 : 0;
  const tsb = anchorPoint?.tsb;
  const canUseForm = history >= 42;
  const jumped = loadPrev7 >= 50 && jumpRatio >= 1.35 && recent7.length >= 2 && prev7.length >= 2;
  if (jumped) {
    const steep = jumpRatio >= 1.6 || (canUseForm && (tsb ?? 0) < -15);
    const formSentence = canUseForm && tsb !== undefined && tsb < -15
      ? ` Die Form am Morgen des ${formatDate(anchor)} (TSB) liegt bei ${formatLoad(tsb)}. Plane leichtere Tage, bevor der Umfang weiter steigt.`
      : ' Ein flacherer Schritt ist der konkretere Hebel als noch mehr gleiche Einheiten.';
    const tense = daysSince > 10 ? 'lag' : 'liegt';
    tips.push({
      id: 'load-jump',
      severity: daysSince > 10 ? 'info' : steep ? 'high' : 'medium',
      title: daysSince > 10 ? 'Die Belastung ist damals steil gestiegen' : 'Die Belastung steigt steil',
      body: `Die Belastung der 7 Tage bis ${formatDate(anchor)} ${tense} bei ${formatLoad(load7)}. Die 7 Tage davor ${daysSince > 10 ? 'lagen' : 'liegen'} bei ${formatLoad(loadPrev7)}. Das ist ein Anstieg um ${formatNumber(Math.round((jumpRatio - 1) * 100))} %.${formSentence}`,
      evidence: cite([
        { label: 'Belastung 7 Tage', value: formatLoad(load7) },
        { label: 'Belastung 7 Tage davor', value: formatLoad(loadPrev7) },
        { label: 'Anstieg', value: `${formatNumber(Math.round((jumpRatio - 1) * 100))} %` },
        ...(canUseForm && tsb !== undefined ? [{ label: 'Form (TSB)', value: formatLoad(tsb) }] : []),
      ]),
    });
  }

  if (daysSince <= 10 && canUseForm && tsb !== undefined && tsb < -25 && !jumped && load7 >= loadPrev7 * 0.8 && recent7.length >= 3) {
    tips.push({
      id: 'low-form',
      severity: 'high',
      title: 'Die Form ist deutlich im Minus',
      body: `Die Form am Morgen des ${formatDate(anchor)} (TSB) liegt bei ${formatLoad(tsb)}. Die Belastung der letzten 7 Tage ist ${formatLoad(load7)}, die der 7 Tage davor ${formatLoad(loadPrev7)}. Ein kurzer Rückgang lässt die Ermüdung (ATL ${formatLoad(anchorPoint?.atl)}) eher sinken als eine weitere gleiche Woche.`,
      evidence: cite([
        { label: 'Form (TSB)', value: formatLoad(tsb) },
        { label: 'Ermüdung (ATL)', value: formatLoad(anchorPoint?.atl) },
        { label: 'Fitness (CTL)', value: formatLoad(anchorPoint?.ctl) },
        { label: 'Belastung 7 Tage', value: formatLoad(load7) },
      ]),
    });
  }

  if (daysSince <= 10 && canUseForm && anchorPoint) {
    const previousKey = localDateKey(addDays(anchor, -7));
    const previous = series.find((point) => point.date === previousKey);
    if (previous && anchorPoint.ctl - previous.ctl > 6) {
      const delta = anchorPoint.ctl - previous.ctl;
      tips.push({
        id: 'ctl-ramp',
        severity: 'medium',
        title: 'Die Fitness steigt schnell',
        body: `Die Fitness (CTL) ist in 7 Tagen von ${formatLoad(previous.ctl)} auf ${formatLoad(anchorPoint.ctl)} gestiegen (+${formatLoad(delta)}). Mehr als etwa 5 bis 7 Punkte pro Woche gelten als steiler Aufbau. Halte die nächste Woche flacher, statt noch einen Block draufzulegen.`,
        evidence: cite([
          { label: 'CTL heute', value: formatLoad(anchorPoint.ctl) },
          { label: 'CTL vor 7 Tagen', value: formatLoad(previous.ctl) },
          { label: 'Anstieg', value: formatLoad(delta) },
        ]),
      });
    }
  }

  const daily = loadsEnding(series, anchor, 7);
  const activeDays = daily.filter((value) => value > 0).length;
  const sd = stdev(daily);
  const avg = mean(daily);
  const monotony = sd > 0 ? avg / sd : avg > 0 ? Number.POSITIVE_INFINITY : 0;
  if (daysSince <= 10 && activeDays >= 5 && avg >= 15 && monotony >= 2) {
    tips.push({
      id: 'monotony',
      severity: 'medium',
      title: 'Die Woche ist sehr gleichförmig',
      body: `Die Monotonie der 7 Tage bis ${formatDate(anchor)} liegt bei ${Number.isFinite(monotony) ? formatNumber(monotony, 1) : 'einem konstanten Tageswert'}. ${formatNumber(activeDays)} dieser Tage haben eine Einheit, der Mittelwert der Tagesbelastung ist ${formatLoad(avg)}. Ein deutlich leichter Tag und ein klar härterer Tag machen die Woche robuster als sieben ähnliche Einheiten.`,
      evidence: cite([
        { label: 'Monotonie', value: Number.isFinite(monotony) ? formatNumber(monotony, 1) : 'konstant' },
        { label: 'Aktive Tage', value: formatNumber(activeDays) },
        { label: 'Mittlere Tagesbelastung', value: formatLoad(avg) },
      ]),
    });
  }

  if (daysSince <= 10) {
    let streak = 0;
    const map = new Map(series.map((point) => [point.date, point.load]));
    for (let offset = 0; offset < 21; offset += 1) {
      const load = map.get(localDateKey(addDays(anchor, -offset))) ?? 0;
      if (load > 30) streak += 1;
      else break;
    }
    if (streak >= 9) {
      tips.push({
        id: 'no-easy-day',
        severity: 'medium',
        title: 'Seit Tagen fehlt ein leichter Tag',
        body: `Bis ${formatDate(anchor)} lagen ${formatNumber(streak)} Tage in Folge über 30 Belastungspunkten. Ein Tag unter dieser Schwelle gibt der Ermüdung Raum. Die Form (TSB) ${canUseForm && tsb !== undefined ? `liegt bei ${formatLoad(tsb)}` : 'ist bei der kurzen Historie noch nicht die Grundlage'}.`,
        evidence: cite([
          { label: 'Tage über 30 Belastung', value: formatNumber(streak) },
          { label: 'Schwelle', value: '30' },
          ...(canUseForm && tsb !== undefined ? [{ label: 'Form (TSB)', value: formatLoad(tsb) }] : []),
        ]),
      });
    }
  }

  const windowDays = history >= 56 ? 28 : history >= 28 ? 14 : 0;
  if (daysSince <= 10 && windowDays > 0) {
    const recent = inWindow(stamped, anchor, windowDays);
    const prior = inWindow(stamped, addDays(anchor, -windowDays), windowDays);
    const recentIntensity = intensity(recent);
    const priorIntensity = intensity(prior);
    const recentHours = hours(recent);
    const priorHours = hours(prior);
    if (recent.length >= 3 && prior.length >= 3 && priorHours > 0 && recentIntensity !== undefined && priorIntensity !== undefined) {
      const volumeRatio = recentHours / priorHours;
      const intensityRatio = recentIntensity / priorIntensity;
      if (volumeRatio >= 1.12 && intensityRatio >= 0.95 && intensityRatio <= 1.08) {
        tips.push({
          id: 'volume-flat-intensity',
          severity: 'medium',
          title: 'Mehr Umfang, kaum mehr Intensität',
          body: `In den letzten ${formatNumber(windowDays)} Tagen liegen ${formatDuration(recentHours * 3600)} und ${formatLoad(recentIntensity)} Belastung pro Stunde. Die ${formatNumber(windowDays)} Tage davor liegen bei ${formatDuration(priorHours * 3600)} und ${formatLoad(priorIntensity)} pro Stunde. Der Umfang ist gestiegen, die Intensität pro Stunde kaum. Wenn du die Leistung verschieben willst, ist eine gezielte härtere Einheit oft wirksamer als noch mehr vom Gleichen.`,
          evidence: cite([
            { label: `Zeit ${windowDays} Tage`, value: formatDuration(recentHours * 3600) },
            { label: `Zeit ${windowDays} Tage davor`, value: formatDuration(priorHours * 3600) },
            { label: 'Belastung pro Stunde', value: formatLoad(recentIntensity) },
            { label: 'Belastung pro Stunde davor', value: formatLoad(priorIntensity) },
          ]),
        });
      }
      if (canUseForm && tsb !== undefined && tsb > 15 && (anchorPoint?.ctl ?? 0) > 20 && recent.length >= 4 && intensityRatio < 0.85 && daysSince <= 3) {
        tips.push({
          id: 'fresh-quality',
          severity: 'medium',
          title: 'Du bist erholt, die Intensität ist flach',
          body: `Die Form am Morgen (TSB) liegt bei ${formatLoad(tsb)}, die Fitness (CTL) bei ${formatLoad(anchorPoint?.ctl)}. Die Belastung pro Stunde der letzten ${formatNumber(windowDays)} Tage ist ${formatLoad(recentIntensity)}, in den ${formatNumber(windowDays)} Tagen davor ${formatLoad(priorIntensity)}. Wenn du gesund bist, passt eine gezielte Qualitätseinheit besser als nur weitere lockere Einheiten.`,
          evidence: cite([
            { label: 'Form (TSB)', value: formatLoad(tsb) },
            { label: 'Fitness (CTL)', value: formatLoad(anchorPoint?.ctl) },
            { label: 'Belastung pro Stunde', value: formatLoad(recentIntensity) },
            { label: 'Belastung pro Stunde davor', value: formatLoad(priorIntensity) },
          ]),
        });
      }
    }
    if (windowDays === 28) {
      const recentActive = new Set(recent.map((activity) => localDateKey(new Date(activity.startTime)))).size;
      const priorActive = new Set(prior.map((activity) => localDateKey(new Date(activity.startTime)))).size;
      if (daysSince <= 10 && priorActive >= 10 && recentActive <= priorActive * 0.6) {
        tips.push({
          id: 'consistency',
          severity: 'medium',
          title: 'Die Regelmäßigkeit ist zurückgegangen',
          body: `Aktive Tage sind von ${formatNumber(priorActive)} in den 28 Tagen davor auf ${formatNumber(recentActive)} in den letzten 28 Tagen gefallen. Wenn das kein geplanter Rückgang ist, liegt der Hebel eher in der Regelmäßigkeit als in einer einzelnen harten Einheit.`,
          evidence: cite([
            { label: 'Aktive Tage, 28 Tage', value: formatNumber(recentActive) },
            { label: 'Aktive Tage, 28 Tage davor', value: formatNumber(priorActive) },
          ]),
        });
      }
      const base = inWindow(stamped, addDays(anchor, -28), 56);
      const endurance: Sport[] = ['run', 'bike', 'swim'];
      const baseCounts = Object.fromEntries(endurance.map((sport) => [sport, sportCount(base, sport)])) as Record<Sport, number>;
      if (endurance.every((sport) => baseCounts[sport] >= 3)) {
        for (const sport of endurance) {
          const recentCount = sportCount(recent, sport);
          const priorCount = sportCount(prior, sport);
          if (recentCount === 0 && priorCount > 0) {
            const label = sport === 'run' ? 'Laufen' : sport === 'bike' ? 'Radfahren' : 'Schwimmen';
            tips.push({
              id: `sport-gap-${sport}`,
              severity: 'info',
              title: `${label} fehlt im letzten Block`,
              body: `${label} kommt in den letzten 28 Tagen nicht vor. In den 28 Tagen davor waren es ${formatNumber(priorCount)} Einheiten, in den 56 Tagen vor diesem Fenster ${formatNumber(baseCounts[sport])}. Wenn Triathlon das Ziel bleibt, ist diese Lücke der konkrete Punkt.`,
              evidence: cite([
                { label: `${label}, 28 Tage`, value: '0' },
                { label: `${label}, 28 Tage davor`, value: formatNumber(priorCount) },
                { label: `${label}, 56 Tage davor`, value: formatNumber(baseCounts[sport]) },
              ]),
            });
          }
        }
      }
    }
  }

  if (daysSince <= 10) {
    const recent = inWindow(stamped, anchor, 14);
    const runDistance = sportDistance(recent, 'run');
    const runs = sportCount(recent, 'run');
    const longestRun = longestSport(recent, 'run');
    if (runs >= 3 && runDistance >= 25_000 && longestRun / runDistance < 0.28) {
      tips.push({
        id: 'long-run',
        severity: 'info',
        title: 'Der lange Lauf hat wenig Anteil',
        body: `Der längste Lauf der letzten 14 Tage ist ${formatNumber(longestRun / 1000, 1)} km. Das sind ${formatNumber(Math.round((longestRun / runDistance) * 100))} % der Laufdistanz von ${formatNumber(runDistance / 1000, 1)} km. Für Grundlagenausdauer liegt der lange Lauf oft näher an 30 % oder mehr des Laufumfangs.`,
        evidence: cite([
          { label: 'Längster Lauf', value: `${formatNumber(longestRun / 1000, 1)} km` },
          { label: 'Laufdistanz 14 Tage', value: `${formatNumber(runDistance / 1000, 1)} km` },
          { label: 'Anteil', value: `${formatNumber(Math.round((longestRun / runDistance) * 100))} %` },
        ]),
      });
    }
    const bikeDistance = sportDistance(recent, 'bike');
    const rides = sportCount(recent, 'bike');
    const longestRide = longestSport(recent, 'bike');
    if (rides >= 3 && bikeDistance >= 80_000 && longestRide / bikeDistance < 0.3) {
      tips.push({
        id: 'long-ride',
        severity: 'info',
        title: 'Die lange Fahrt hat wenig Anteil',
        body: `Die längste Fahrt der letzten 14 Tage ist ${formatNumber(longestRide / 1000, 1)} km. Das sind ${formatNumber(Math.round((longestRide / bikeDistance) * 100))} % der Raddistanz von ${formatNumber(bikeDistance / 1000, 1)} km. Eine längere Einheit näher an 30 % des Radumfangs deckt den Ausdauerreiz besser ab als nur weitere kurze Fahrten.`,
        evidence: cite([
          { label: 'Längste Fahrt', value: `${formatNumber(longestRide / 1000, 1)} km` },
          { label: 'Raddistanz 14 Tage', value: `${formatNumber(bikeDistance / 1000, 1)} km` },
          { label: 'Anteil', value: `${formatNumber(Math.round((longestRide / bikeDistance) * 100))} %` },
        ]),
      });
    }
  }

  const hasHigh = tips.some((tip) => tip.severity === 'high');
  if (daysSince <= 10 && canUseForm && anchorPoint && !hasHigh) {
    const previous = series.find((point) => point.date === localDateKey(addDays(anchor, -28)));
    if (previous) {
      const delta = anchorPoint.ctl - previous.ctl;
      if (delta >= 8 && delta <= 24 && (tsb ?? -99) > -18 && (monotony < 2 || activeDays < 5)) {
        tips.push({
          id: 'steady',
          severity: 'positive',
          title: 'Der Aufbau ist gleichmäßig',
          body: `Die Fitness (CTL) ist in 28 Tagen von ${formatLoad(previous.ctl)} auf ${formatLoad(anchorPoint.ctl)} gestiegen. Die Form (TSB) liegt bei ${formatLoad(tsb)}. Behalte den Umfang in der Nähe dieses Niveaus, statt ihn noch einmal stark anzuheben.`,
          evidence: cite([
            { label: 'CTL vor 28 Tagen', value: formatLoad(previous.ctl) },
            { label: 'CTL aktuell', value: formatLoad(anchorPoint.ctl) },
            { label: 'Form (TSB)', value: formatLoad(tsb) },
          ]),
        });
      }
    }
  }

  if (tips.length === 0 || (daysSince <= 10 && tips.every((tip) => tip.id === 'steady'))) {
    if (tips.length === 0) {
      tips.push({
        id: 'none',
        severity: 'info',
        title: 'Keine der Regeln schlägt an',
        body: 'Aus den festen Regeln ergibt sich gerade kein zusätzlicher Hinweis. Die Werte, mit denen geprüft wurde, stehen daneben. Das ist keine Freigabe für beliebige Steigerung.',
        evidence: cite([
          { label: 'Belastung 7 Tage', value: formatLoad(load7) },
          { label: 'Belastung 7 Tage davor', value: formatLoad(loadPrev7) },
          ...(canUseForm && tsb !== undefined ? [{ label: 'Form (TSB)', value: formatLoad(tsb) }] : [{ label: 'Form (TSB)', value: 'noch nicht bewertet' }]),
          { label: 'Historie', value: `${formatNumber(history)} Tage` },
        ]),
      });
    }
  }

  tips.sort((a, b) => rank[a.severity] - rank[b.severity]);
  return {
    status: daysSince > 10 ? 'stale' : 'ready',
    tips: tips.slice(0, 5),
    facts,
  };
}
