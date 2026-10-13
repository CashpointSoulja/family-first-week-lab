import * as realRules from '../engine/consent';
import { ConsentError, canSeeData } from '../engine/consent';
import { HOUSEHOLDS, SCENARIOS } from '../engine/fixtures';
import { ageBucket, makeEvent } from '../engine/events';
import type { CategoryId, ConsentState, ScenarioId, SensorId } from '../engine/types';
import { derive, freshLabState, householdOf, IDS, LIMITS, readiness, requiredSensors, scenarioOf, type LabState } from './model';

/* ---------- allowlisted commands and their exact payload shapes ---------- */

type Check = (v: unknown) => boolean;
const oneOf = (list: readonly unknown[]): Check => (v) => list.includes(v);
const uniqueListOf = (list: readonly unknown[], max: number): Check => (v) =>
  Array.isArray(v) && v.length <= max && new Set(v).size === v.length && v.every((x) => list.includes(x));

interface Field { check: Check; optional?: boolean }
const f = (check: Check, optional = false): Field => ({ check, optional });

export const COMMANDS = {
  selectHousehold: { householdId: f(oneOf(IDS.households)) },
  setRelationship: { relationship: f(oneOf(IDS.relationships)) },
  setGoal: { goal: f(oneOf(IDS.goals)) },
  confirmStart: {},
  setScenario: { scenarioId: f(oneOf(IDS.scenarios)) },
  setVariant: { variant: f(oneOf(IDS.variants)) },
  switchActor: { actor: f(oneOf(IDS.actors)) },
  sendInvite: {},
  accept: { categories: f(uniqueListOf(IDS.categories, IDS.categories.length)) },
  decline: {},
  revoke: { category: f(oneOf(IDS.categories), true) },
  share: { category: f(oneOf(IDS.categories)) },
  pairSensor: { sensor: f(oneOf(IDS.sensors)) },
  testSensor: { sensor: f(oneOf(IDS.sensors)) },
  setFrequency: { frequency: f(oneOf(IDS.frequencies)) },
  feedback: { answer: f(oneOf(IDS.feedback)) },
  checkIn: { channel: f(oneOf(IDS.checkIns)) },
  viewed: { surface: f(oneOf(IDS.surfaces)) },
  reset: {},
} satisfies Record<string, Record<string, Field>>;

export type CommandType = keyof typeof COMMANDS;
export const COMMAND_TYPES = Object.keys(COMMANDS) as CommandType[];

export interface Envelope {
  commandId: string;
  expectedRevision: number;
  type: CommandType;
  payload: Record<string, unknown>;
}

export type Rejection = { ok: false; status: 400 | 422; code: string; message: string };
const bad = (code: string, message: string): Rejection => ({ ok: false, status: 400, code, message });

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const ENVELOPE_KEYS = ['commandId', 'expectedRevision', 'type', 'payload'];
const COMMAND_ID = /^[A-Za-z0-9_-]{8,64}$/;

/** Strict schema check. Unknown keys anywhere (including timestamps or a whole-state blob) are rejected, never ignored. */
export function parseEnvelope(raw: unknown): { ok: true; cmd: Envelope } | Rejection {
  if (!isObj(raw)) return bad('bad_shape', 'Body must be a JSON object');
  const extra = Object.keys(raw).filter((k) => !ENVELOPE_KEYS.includes(k));
  if (extra.length) return bad('unknown_field', `Unknown field: ${extra[0]}`);
  const { commandId, expectedRevision, type, payload } = raw;
  if (typeof commandId !== 'string' || !COMMAND_ID.test(commandId)) return bad('bad_command_id', 'commandId must be 8-64 letters, digits, _ or -');
  if (!Number.isInteger(expectedRevision) || (expectedRevision as number) < 0 || (expectedRevision as number) > 1e9) return bad('bad_revision', 'expectedRevision must be a non-negative integer');
  if (typeof type !== 'string' || !Object.hasOwn(COMMANDS, type)) return bad('unknown_command', 'Unknown command');
  if (!isObj(payload)) return bad('bad_payload', 'payload must be an object');
  const spec: Record<string, Field> = COMMANDS[type as CommandType];
  const unknown = Object.keys(payload).filter((k) => !Object.hasOwn(spec, k));
  if (unknown.length) return bad('unknown_field', `Unknown payload field: ${unknown[0]}`);
  for (const [k, field] of Object.entries(spec)) {
    if (!Object.hasOwn(payload, k)) {
      if (field.optional) continue;
      return bad('missing_field', `Missing payload field: ${k}`);
    }
    if (!field.check(payload[k])) return bad('invalid_value', `Invalid value for ${k}`);
  }
  return { ok: true, cmd: { commandId, expectedRevision: expectedRevision as number, type: type as CommandType, payload } };
}

/* ---------- applying a command ---------- */

/** The consent transition functions the reducer delegates to. Swappable only so the eval can prove a broken rule is caught. */
export interface ConsentRules {
  sendInvite: typeof realRules.sendInvite;
  accept: typeof realRules.accept;
  decline: typeof realRules.decline;
  revoke: typeof realRules.revoke;
  share: typeof realRules.share;
}
export const CONSENT_RULES: ConsentRules = realRules;

export type ApplyResult = { ok: true; state: LabState } | Rejection;
const invalid = (message: string): Rejection => ({ ok: false, status: 422, code: 'invalid_transition', message });

function track(s: LabState, name: string, props: Record<string, string | number | boolean> = {}) {
  s.clock += 1;
  s.events.push(makeEvent(name, props, { household_id: s.householdId, actor_role: s.view, variant: s.variant, seq: s.clock }));
  if (s.events.length > LIMITS.events) s.events = s.events.slice(-LIMITS.events);
}
const bounded = (c: ConsentState): ConsentState => (c.history.length > LIMITS.consentHistory ? { ...c, history: c.history.slice(-LIMITS.consentHistory) } : c);

/** Pure: never mutates `prev`. The actor for consent changes is always the stored demo role, never a caller-supplied value. */
export function applyCommand(prev: LabState, cmd: Pick<Envelope, 'type' | 'payload'>, rules: ConsentRules = CONSENT_RULES): ApplyResult {
  const s: LabState = structuredClone(prev);
  const p = cmd.payload;
  const actor = s.view;
  try {
    switch (cmd.type) {
      case 'selectHousehold': {
        const hh = HOUSEHOLDS.find((h) => h.id === p.householdId)!;
        const fresh = freshLabState();
        return { ok: true, state: { ...fresh, variant: s.variant, events: s.events, clock: s.clock, householdId: hh.id, relationship: hh.defaultRelationship, goal: hh.defaultGoal, scenarioId: hh.defaultScenario, sensors: { ...SCENARIOS[hh.defaultScenario].sensors } } };
      }
      case 'setRelationship': s.relationship = p.relationship as string; break;
      case 'setGoal': s.goal = p.goal as string; break;
      case 'confirmStart': track(s, 'household_selected', { relationship: s.relationship, goal: s.goal }); break;
      case 'setScenario': {
        const id = p.scenarioId as ScenarioId;
        s.scenarioId = id;
        s.sensors = { ...SCENARIOS[id].sensors };
        break;
      }
      case 'setVariant': s.variant = p.variant as LabState['variant']; break;
      case 'switchActor':
        s.view = p.actor as LabState['view'];
        if (s.view === 'monitored' && s.consent.status === 'pending') track(s, 'consent_viewed');
        break;
      case 'sendInvite':
        s.consent = bounded(rules.sendInvite(s.consent, actor, s.clock));
        s.inviteAttempts += 1;
        track(s, 'invite_sent', { invite_attempt: s.inviteAttempts });
        break;
      case 'accept':
        s.consent = bounded(rules.accept(s.consent, actor, p.categories as CategoryId[], s.clock));
        track(s, 'consent_accepted', { categories_count: s.consent.shared.length, categories: s.consent.shared.join('|') });
        s.view = 'family';
        break;
      case 'decline':
        s.consent = bounded(rules.decline(s.consent, actor, s.clock));
        track(s, 'consent_declined', { invite_attempt: s.inviteAttempts });
        s.view = 'family';
        break;
      case 'revoke': {
        const category = p.category as CategoryId | undefined;
        if (category && s.consent.status === 'accepted' && !s.consent.shared.includes(category)) return invalid('That area is not being shared');
        s.consent = bounded(rules.revoke(s.consent, actor, category, s.clock));
        track(s, 'sharing_revoked', { scope: category ? 'category' : 'all', categories_remaining: s.consent.shared.length, days_since_accept: scenarioOf(s).daysElapsed });
        if (s.consent.status === 'revoked') { s.view = 'family'; s.feedback = null; }
        break;
      }
      case 'share':
        s.consent = bounded(rules.share(s.consent, actor, p.category as CategoryId, s.clock));
        break;
      case 'pairSensor':
      case 'testSensor': {
        const sid = p.sensor as SensorId;
        if (s.consent.status !== 'accepted') return invalid('Sensors stay paused until consent is given');
        if (!requiredSensors(s).includes(sid)) return invalid('That sensor is not needed for what has been shared');
        const from = s.sensors[sid];
        const need = cmd.type === 'pairSensor' ? 'notPaired' : 'waiting';
        if (from !== need) return invalid(`That sensor is ${from}, so it cannot be ${cmd.type === 'pairSensor' ? 'paired' : 'tested'}`);
        s.sensors[sid] = cmd.type === 'pairSensor' ? 'waiting' : 'ready';
        track(s, 'sensor_status_changed', { sensor: sid, from, to: s.sensors[sid] });
        const r = readiness(s);
        if (r.complete) track(s, 'setup_ready', { ready_count: r.ready, shared_count: r.total, minutes_from_accept: 0 });
        break;
      }
      case 'setFrequency': {
        const previous = s.frequency;
        s.frequency = p.frequency as LabState['frequency'];
        track(s, 'notification_frequency_set', { frequency: s.frequency, previous });
        break;
      }
      case 'feedback':
        if (!canSeeData(s.consent)) return invalid('There is no insight to give feedback on');
        s.feedback = p.answer as LabState['feedback'];
        track(s, 'insight_feedback', { answer: s.feedback!, status: derive(s).insight.status });
        break;
      case 'checkIn':
        if (!canSeeData(s.consent)) return invalid('There is no weekly summary to act on');
        s.checkIns = [...s.checkIns, p.channel as string].slice(-LIMITS.checkIns);
        track(s, 'check_in_started', { channel: (p.channel as string).toLowerCase().replace(/\s+/g, '_'), weekly_state: derive(s).weekly.state });
        break;
      case 'viewed': {
        const surface = p.surface as string;
        if (surface === 'today' && canSeeData(s.consent)) {
          const ins = derive(s).insight;
          const fresh = Math.min(...ins.readings.filter((x) => x.state !== 'notShared').map((x) => x.lastEventMins ?? Infinity));
          track(s, 'first_insight_viewed', { status: ins.status, coverage_pct: ins.coverage.pct, data_age_bucket: ageBucket(Number.isFinite(fresh) ? fresh : null) });
        } else if (surface === 'week' && canSeeData(s.consent)) {
          const w = derive(s).weekly;
          track(s, 'weekly_summary_viewed', { state: w.state, covered_areas: w.coverageDays.covered, shared_areas: w.coverageDays.total });
        } else if (surface === 'start' || surface === 'consent') track(s, 'copy_variant_exposed', { surface });
        break;
      }
      case 'reset': return { ok: true, state: freshLabState() };
      default: {
        const never: never = cmd.type;
        return bad('unknown_command', `Unknown command ${String(never)}`);
      }
    }
  } catch (e) {
    if (e instanceof ConsentError) return invalid(e.message);
    throw e;
  }
  return { ok: true, state: s };
}

export const personOf = (s: LabState) => householdOf(s).person;
