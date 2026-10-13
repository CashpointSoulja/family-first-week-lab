import { CATEGORIES } from './fixtures';
import type { CategoryId, ConsentState, Scenario, SensorId, SensorStatus } from './types';
import { canSeeData } from './consent';

export type CategoryState = 'reporting' | 'quiet' | 'missing' | 'stale' | 'notShared';
export type InsightStatus = 'noConsent' | 'revoked' | 'tooEarly' | 'stale' | 'insufficient' | 'ready';

/** Data older than this is stale and never counts as reassurance. */
export const STALE_AFTER_MINS = 6 * 60;
/** Minimum share of shared categories that must be reporting for a first insight. */
export const MIN_COVERAGE = 0.6;
export const MIN_HOURS_FOR_INSIGHT = 24;

export interface CategoryReading {
  id: CategoryId;
  label: string;
  state: CategoryState;
  sentence: string;
  lastEventMins: number | null;
}

export interface Insight {
  status: InsightStatus;
  headline: string;
  body: string;
  readings: CategoryReading[];
  coverage: { reporting: number; shared: number; pct: number };
  freshness: string;
  uncertainty: string[];
}

export const fmtAge = (mins: number | null): string => {
  if (mins === null) return 'no data yet';
  if (mins < 60) return `${Math.round(mins)} min ago`;
  const h = mins / 60;
  if (h < 48) return `${Math.round(h)} h ago`;
  return `${Math.round(h / 24)} days ago`;
};

const usable = (s: SensorStatus) => s === 'ready' || s === 'lowBattery';

export function categoryState(cat: CategoryId, sc: Scenario, sensors: Record<SensorId, SensorStatus>, shared: CategoryId[]): CategoryState {
  if (!shared.includes(cat)) return 'notShared';
  const def = CATEGORIES.find((c) => c.id === cat)!;
  const last = sc.lastEventMins[cat];
  if (sensors.hub === 'offline') return last === null ? 'missing' : 'stale';
  if (!usable(sensors[def.sensor])) return last !== null && last <= STALE_AFTER_MINS ? 'reporting' : 'missing';
  if (last === null) return cat === 'night' && sc.daysElapsed > 0 ? 'quiet' : 'missing';
  if (last > STALE_AFTER_MINS && cat !== 'night' && cat !== 'outside') return 'stale';
  const today = sc.series[cat].at(-1);
  if (today === 0) return 'quiet';
  return 'reporting';
}

function sentence(cat: CategoryId, st: CategoryState, sc: Scenario): string {
  const def = CATEGORIES.find((c) => c.id === cat)!;
  if (st === 'notShared') return `Not shared. Only the person being invited can turn this on.`;
  if (st === 'missing') return `No data received yet from the ${def.unit.split(' ')[0]} sensor. This is unknown, not a good or bad sign.`;
  if (st === 'stale') return `Last heard ${fmtAge(sc.lastEventMins[cat])}. Older data is not used to reassure you.`;
  const y = sc.series[cat].at(-1);
  const count = y === null || y === undefined ? 'some' : String(y);
  switch (cat) {
    case 'drinks': {
      const t = sc.firstKettle.at(-1);
      return t ? `Kettle first used around ${t}; ${count} uses in the last day.` : `${count} kettle uses in the last day.`;
    }
    case 'wake': {
      const t = sc.wake.at(-1);
      return t ? `First bedroom movement around ${t}.` : `Bedroom movement detected.`;
    }
    case 'outside':
      return st === 'quiet' ? `Front door not opened in the last day.` : `Front door opened ${count} times in the last day.`;
    case 'night':
      return st === 'quiet' ? `No hallway movement overnight.` : `${count} hallway movement${y === 1 ? '' : 's'} between 11pm and 6am.`;
    default:
      return `${count} ${def.unit} in the last day.`;
  }
}

export function firstInsight(sc: Scenario, consent: ConsentState, sensors: Record<SensorId, SensorStatus>): Insight {
  const shared = canSeeData(consent) ? consent.shared : [];
  const readings: CategoryReading[] = CATEGORIES.map((c) => {
    const st = categoryState(c.id, sc, sensors, shared);
    return { id: c.id, label: c.label, state: st, sentence: sentence(c.id, st, sc), lastEventMins: st === 'notShared' ? null : sc.lastEventMins[c.id] };
  });
  const sharedReadings = readings.filter((r) => r.state !== 'notShared');
  const reporting = sharedReadings.filter((r) => r.state === 'reporting' || r.state === 'quiet').length;
  const coverage = { reporting, shared: sharedReadings.length, pct: sharedReadings.length ? Math.round((reporting / sharedReadings.length) * 100) : 0 };
  const freshMins = Math.min(...sharedReadings.map((r) => r.lastEventMins ?? Infinity));
  const freshness = sensors.hub === 'offline'
    ? `Hub last heard ${fmtAge(sc.hubLastSeenHours * 60)}`
    : Number.isFinite(freshMins) ? `Latest sensor event ${fmtAge(freshMins)}` : 'No sensor events yet';
  const uncertainty = [
    sc.daysElapsed < 7
      ? `Based on ${sc.daysElapsed === 0 ? 'less than a day' : `${sc.daysElapsed} day${sc.daysElapsed === 1 ? '' : 's'}`} of data, so "usual" is not known yet.`
      : `Based on ${sc.daysElapsed} days of data. One week is still a short baseline.`,
    'Sensors show that a device or room was used, not who used it or why. Visitors change the picture.',
    'This is not a medical or safety service and cannot tell you someone is well or unwell.',
  ];
  const base = { readings, coverage, freshness, uncertainty };

  if (consent.status === 'revoked') return { ...base, status: 'revoked', headline: 'Sharing has been turned off', body: 'Nothing is being shared, so there is nothing to show. Earlier insights are hidden too.' };
  if (!canSeeData(consent)) return { ...base, status: 'noConsent', headline: 'Waiting for consent', body: 'No data is collected or shown until the person being invited says yes.' };
  if (sensors.hub === 'offline' || sc.hubLastSeenHours * 60 > STALE_AFTER_MINS) {
    return { ...base, status: 'stale', headline: `We haven't heard from the hub since ${fmtAge(sc.hubLastSeenHours * 60)}`, body: 'Without new data we cannot say how today is going, either way. A quick call or message is the reliable option.' };
  }
  if (sc.hoursSinceSetup < MIN_HOURS_FOR_INSIGHT) {
    return { ...base, status: 'tooEarly', headline: 'Your first insight arrives after the first full day', body: `Sensors have been in place for ${sc.hoursSinceSetup} hours. One full day is needed before a summary means anything.` };
  }
  if (coverage.shared === 0 || reporting / coverage.shared < MIN_COVERAGE) {
    return { ...base, status: 'insufficient', headline: 'Not enough data to summarise yet', body: `Only ${reporting} of ${coverage.shared} shared sensors are reporting. Fix the gaps below before reading anything into the rest.` };
  }
  const gaps = sharedReadings.filter((r) => r.state === 'missing' || r.state === 'stale').length;
  return {
    ...base,
    status: 'ready',
    headline: 'Here is what the sensors saw in the last day',
    body: gaps
      ? `${reporting} of ${coverage.shared} shared sensors reported. ${gaps} ${gaps === 1 ? 'is' : 'are'} missing, so this picture is incomplete.`
      : `All ${coverage.shared} shared sensors reported. These are observations about routine, not a judgement of wellbeing.`,
  };
}
