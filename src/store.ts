import { HOUSEHOLDS, SCENARIOS, CATEGORIES } from './engine/fixtures';
import { initialConsent } from './engine/consent';
import { makeEvent } from './engine/events';
import type { CategoryId, ConsentState, CopyVariant, Frequency, Household, ScenarioId, SensorId, SensorStatus, TrackedEvent } from './engine/types';

export type Route = 'start' | 'consent' | 'setup' | 'today' | 'week' | 'lab';
export const ROUTES: { id: Route; label: string; step?: number }[] = [
  { id: 'start', label: 'Start', step: 1 },
  { id: 'consent', label: 'Consent', step: 2 },
  { id: 'setup', label: 'Setup', step: 3 },
  { id: 'today', label: 'Today', step: 4 },
  { id: 'week', label: 'Week', step: 5 },
  { id: 'lab', label: 'Lab' },
];

export interface AppState {
  route: Route;
  householdId: string;
  relationship: string;
  goal: string;
  scenarioId: ScenarioId;
  consent: ConsentState;
  sensors: Record<SensorId, SensorStatus>;
  frequency: Frequency;
  variant: CopyVariant;
  view: 'family' | 'monitored';
  draftShare: CategoryId[];
  inviteAttempts: number;
  checkIns: string[];
  feedback: string | null;
  notice: string | null;
  error: string | null;
  events: TrackedEvent[];
  clock: number;
}

export function freshState(): AppState {
  const hh = HOUSEHOLDS[0];
  return {
    route: 'start',
    householdId: hh.id,
    relationship: hh.defaultRelationship,
    goal: hh.defaultGoal,
    scenarioId: hh.defaultScenario,
    consent: initialConsent(),
    sensors: { ...SCENARIOS[hh.defaultScenario].sensors },
    frequency: 'weekly',
    variant: 'benefitFirst',
    view: 'family',
    draftShare: [],
    inviteAttempts: 0,
    checkIns: [],
    feedback: null,
    notice: null,
    error: null,
    events: [],
    clock: 0,
  };
}

export const household = (s: AppState): Household => HOUSEHOLDS.find((h) => h.id === s.householdId)!;
export const scenario = (s: AppState) => SCENARIOS[s.scenarioId];

export function track(s: AppState, name: string, props: Record<string, string | number | boolean> = {}) {
  s.clock += 1;
  s.events.push(makeEvent(name, props, { household_id: s.householdId, actor_role: s.view, variant: s.variant, seq: s.clock }));
}

/** Sensors that matter for setup: the hub plus one per shared category. */
export function requiredSensors(s: AppState): SensorId[] {
  const shared = s.consent.status === 'accepted' ? s.consent.shared : [];
  return ['hub', ...CATEGORIES.filter((c) => shared.includes(c.id)).map((c) => c.sensor)];
}

export function readiness(s: AppState) {
  const req = requiredSensors(s);
  const ready = req.filter((id) => s.sensors[id] === 'ready' || s.sensors[id] === 'lowBattery').length;
  return { ready, total: req.length, complete: s.consent.status === 'accepted' && ready === req.length };
}
