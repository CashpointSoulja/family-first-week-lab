import { CATEGORIES, GOALS, HOUSEHOLDS, RELATIONSHIPS, SCENARIOS, SENSORS } from '../engine/fixtures';
import { canSeeData, initialConsent } from '../engine/consent';
import { firstInsight, type Insight } from '../engine/insight';
import { weeklySummary, type WeeklySummary } from '../engine/weekly';
import type { Actor, CategoryId, ConsentState, CopyVariant, Frequency, Household, ScenarioId, SensorId, SensorStatus, TrackedEvent } from '../engine/types';

/** Hard caps so a visitor's stored history can never grow without bound. */
export const LIMITS = {
  bodyBytes: 2048,
  events: 200,
  checkIns: 20,
  consentHistory: 100,
  commandLog: 200,
  auditLog: 500,
} as const;

export const IDS = {
  households: HOUSEHOLDS.map((h) => h.id),
  relationships: RELATIONSHIPS.map((r) => r.id),
  goals: GOALS.map((g) => g.id),
  scenarios: Object.keys(SCENARIOS) as ScenarioId[],
  categories: CATEGORIES.map((c) => c.id) as CategoryId[],
  sensors: SENSORS.map((s) => s.id) as SensorId[],
  sensorStatus: ['ready', 'waiting', 'notPaired', 'offline', 'lowBattery'] as SensorStatus[],
  consentStatus: ['notInvited', 'pending', 'accepted', 'declined', 'revoked'],
  actors: ['family', 'monitored'] as Actor[],
  frequencies: ['off', 'weekly', 'daily', 'changes'] as Frequency[],
  variants: ['setupFirst', 'benefitFirst'] as CopyVariant[],
  feedback: ['clear', 'unclear'] as const,
  checkIns: ['Call', 'Send a message', 'Mark as checked in'] as const,
  surfaces: ['start', 'consent', 'today', 'week'] as const,
};

/** Everything the server persists for one visitor. The actor is a synthetic demo role, not an authenticated identity. */
export interface LabState {
  householdId: string;
  relationship: string;
  goal: string;
  scenarioId: ScenarioId;
  consent: ConsentState;
  sensors: Record<SensorId, SensorStatus>;
  frequency: Frequency;
  variant: CopyVariant;
  view: Actor;
  inviteAttempts: number;
  checkIns: string[];
  feedback: 'clear' | 'unclear' | null;
  events: TrackedEvent[];
  clock: number;
}

export function freshLabState(): LabState {
  const hh = HOUSEHOLDS[0];
  return {
    householdId: hh.id,
    relationship: hh.defaultRelationship,
    goal: hh.defaultGoal,
    scenarioId: hh.defaultScenario,
    consent: initialConsent(),
    sensors: { ...SCENARIOS[hh.defaultScenario].sensors },
    frequency: 'weekly',
    variant: 'benefitFirst',
    view: 'family',
    inviteAttempts: 0,
    checkIns: [],
    feedback: null,
    events: [],
    clock: 0,
  };
}

export const householdOf = (s: Pick<LabState, 'householdId'>): Household => HOUSEHOLDS.find((h) => h.id === s.householdId)!;
export const scenarioOf = (s: Pick<LabState, 'scenarioId'>) => SCENARIOS[s.scenarioId];

/** Sensors that matter for setup: the hub plus one per shared category. */
export function requiredSensors(s: Pick<LabState, 'consent'>): SensorId[] {
  const shared = s.consent.status === 'accepted' ? s.consent.shared : [];
  return ['hub', ...CATEGORIES.filter((c) => shared.includes(c.id)).map((c) => c.sensor)];
}

export function readiness(s: Pick<LabState, 'consent' | 'sensors'>) {
  const req = requiredSensors(s);
  const ready = req.filter((id) => s.sensors[id] === 'ready' || s.sensors[id] === 'lowBattery').length;
  return { ready, total: req.length, complete: s.consent.status === 'accepted' && ready === req.length };
}

export interface Derived {
  insight: Insight;
  weekly: WeeklySummary;
  readiness: ReturnType<typeof readiness>;
  requiredSensors: SensorId[];
}

/**
 * Everything the family-facing screens show is derived here, from current consent only.
 * Unshared categories carry no timing, reading or trend; nothing is cached between revisions.
 */
export function derive(s: LabState): Derived {
  const sc = scenarioOf(s);
  const insight = firstInsight(sc, s.consent, s.sensors);
  const shared = canSeeData(s.consent) ? s.consent.shared : [];
  insight.readings = insight.readings.map((r) => (shared.includes(r.id) ? r : { ...r, state: 'notShared', lastEventMins: null, sentence: 'Not shared. Only the person being invited can turn this on.' }));
  const weekly = weeklySummary(sc, s.consent, s.sensors);
  weekly.trends = weekly.trends.filter((t) => shared.includes(t.id));
  return { insight, weekly, readiness: readiness(s), requiredSensors: requiredSensors(s) };
}

/** What a family member could take away from the lab: only currently shared areas, never history from revoked ones. */
export function exportView(s: LabState, revision: number) {
  const d = derive(s);
  const hh = householdOf(s);
  return {
    synthetic: true,
    notice: 'Synthetic export from an independent concept. Not Lilli data, not a medical record.',
    revision,
    household: hh.label,
    consent: { status: s.consent.status, shared: canSeeData(s.consent) ? [...s.consent.shared] : [] },
    firstInsight: {
      status: d.insight.status,
      headline: d.insight.headline,
      coverage: d.insight.coverage,
      freshness: canSeeData(s.consent) ? d.insight.freshness : null,
      readings: d.insight.readings.filter((r) => r.state !== 'notShared'),
    },
    weekly: { state: d.weekly.state, headline: d.weekly.headline, coverageDays: d.weekly.coverageDays, trends: d.weekly.trends },
  };
}

/* ---------- validation of what comes back out of storage ---------- */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown, max = 1e9) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max;
const inList = (list: readonly unknown[], v: unknown) => list.includes(v);

/** Stored state is re-validated on every load; anything unexpected is treated as a storage fault, never repaired silently. */
export function isValidLabState(v: unknown): v is LabState {
  if (!isObj(v)) return false;
  const c = v.consent;
  if (!isObj(c) || !inList(IDS.consentStatus, c.status) || !Array.isArray(c.shared) || !Array.isArray(c.history)) return false;
  if (!c.shared.every((x) => inList(IDS.categories, x)) || c.history.length > LIMITS.consentHistory) return false;
  if (c.status !== 'accepted' && c.shared.length > 0) return false;
  if (!isObj(v.sensors) || !IDS.sensors.every((id) => inList(IDS.sensorStatus, (v.sensors as Record<string, unknown>)[id]))) return false;
  return (
    inList(IDS.households, v.householdId) && inList(IDS.relationships, v.relationship) && inList(IDS.goals, v.goal) &&
    inList(IDS.scenarios, v.scenarioId) && inList(IDS.frequencies, v.frequency) && inList(IDS.variants, v.variant) &&
    inList(IDS.actors, v.view) && isInt(v.inviteAttempts) && isInt(v.clock) &&
    (v.feedback === null || inList(IDS.feedback, v.feedback)) &&
    Array.isArray(v.checkIns) && v.checkIns.length <= LIMITS.checkIns &&
    Array.isArray(v.events) && v.events.length <= LIMITS.events
  );
}
