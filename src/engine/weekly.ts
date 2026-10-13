import { CATEGORIES } from './fixtures';
import type { CategoryId, ConsentState, Frequency, Scenario, SensorId, SensorStatus } from './types';
import { canSeeData } from './consent';

export type WeeklyState = 'locked' | 'forming' | 'stable' | 'changed' | 'insufficient';

/** A category needs this many days with data out of 7 to count. */
export const MIN_DAYS_WITH_DATA = 5;
/** Relative and absolute difference that counts as "looks different". */
export const CHANGE_RATIO = 0.4;
export const CHANGE_ABS = 1.5;

export interface Trend {
  id: CategoryId;
  label: string;
  series: (number | null)[];
  daysWithData: number;
  earlier: number | null;
  recent: number | null;
  direction: 'same' | 'more' | 'less' | 'unknown';
  sentence: string;
}

export interface WeeklySummary {
  state: WeeklyState;
  headline: string;
  body: string;
  trends: Trend[];
  coverageDays: { covered: number; total: number };
  checkInPrompt: string | null;
}

const mean = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};
const r1 = (x: number) => Math.round(x * 10) / 10;

export function weeklySummary(sc: Scenario, consent: ConsentState, _sensors: Record<SensorId, SensorStatus>): WeeklySummary {
  const shared = canSeeData(consent) ? consent.shared : [];
  const trends: Trend[] = CATEGORIES.filter((c) => shared.includes(c.id)).map((c) => {
    const series = sc.series[c.id].slice(-7);
    const daysWithData = series.filter((x) => x !== null).length;
    const earlier = mean(series.slice(0, 4));
    const recent = mean(series.slice(4));
    let direction: Trend['direction'] = 'unknown';
    if (daysWithData >= MIN_DAYS_WITH_DATA && earlier !== null && recent !== null) {
      const diff = recent - earlier;
      const big = Math.abs(diff) >= CHANGE_ABS && Math.abs(diff) / Math.max(earlier, 1) >= CHANGE_RATIO;
      direction = big ? (diff > 0 ? 'more' : 'less') : 'same';
    }
    const sentence =
      direction === 'unknown' ? `Data on only ${daysWithData} of 7 days, too few to compare.`
      : direction === 'same' ? `Similar across the week (about ${r1(earlier!)} a day).`
      : `${direction === 'more' ? 'More' : 'Fewer'} ${c.unit} in the last 3 days (about ${r1(recent!)} a day) than the first 4 (about ${r1(earlier!)}).`;
    return { id: c.id, label: c.label, series, daysWithData, earlier, recent, direction, sentence };
  });
  const covered = trends.filter((t) => t.daysWithData >= MIN_DAYS_WITH_DATA).length;
  const coverageDays = { covered, total: trends.length };
  const base = { trends, coverageDays };

  if (!canSeeData(consent)) {
    return { ...base, state: 'locked', headline: consent.status === 'revoked' ? 'Sharing has been turned off' : 'Waiting for consent', body: 'There is no weekly summary without active consent.', checkInPrompt: null };
  }
  if (sc.daysElapsed < 7) {
    return { ...base, state: 'forming', headline: `Day ${sc.daysElapsed} of 7: the weekly picture is still forming`, body: 'A weekly summary needs 7 days so each day can be compared with the others.', checkInPrompt: null };
  }
  if (trends.length === 0 || covered / trends.length < 0.6) {
    return { ...base, state: 'insufficient', headline: 'Not enough coverage this week to compare', body: `Only ${covered} of ${trends.length} shared areas had data on at least ${MIN_DAYS_WITH_DATA} days. This is a data gap, not a sign that nothing changed.`, checkInPrompt: 'Check the sensors with them, or just ask how the week went.' };
  }
  const changed = trends.filter((t) => t.direction === 'more' || t.direction === 'less');
  if (changed.length) {
    return {
      ...base,
      state: 'changed',
      headline: `${changed.length} part${changed.length === 1 ? '' : 's'} of the routine look${changed.length === 1 ? 's' : ''} different this week`,
      body: 'Routines change for lots of ordinary reasons: weather, visitors, a cold, a new TV series. Sensors cannot tell you why.',
      checkInPrompt: `A relaxed check-in is a good next step, for example "How's your week been?" rather than asking about the data.`,
    };
  }
  return { ...base, state: 'stable', headline: 'A similar pattern across the week', body: 'Shared areas looked much the same from day to day. This describes routine only, not wellbeing.', checkInPrompt: null };
}

export const FREQUENCIES: { id: Frequency; label: string; detail: string }[] = [
  { id: 'weekly', label: 'Weekly digest', detail: 'One summary on Sunday evening. Recommended to start.' },
  { id: 'changes', label: 'Only when something looks different', detail: 'At most one note a day, and only if a shared area looks different from earlier days.' },
  { id: 'daily', label: 'Daily digest', detail: 'A short note each morning, including when data is missing.' },
  { id: 'off', label: 'Off', detail: 'No notifications. Open the app when you want.' },
];
