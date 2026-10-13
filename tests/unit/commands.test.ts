import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyCommand, COMMAND_TYPES, parseEnvelope } from '../../src/server/commands';
import { derive, exportView, freshLabState, isValidLabState, LIMITS, type LabState } from '../../src/server/model';

const ALL = ['drinks', 'meals', 'outside', 'wake', 'night', 'bathroom'];
const env = (type: string, payload: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({ commandId: 'abcdefgh-1', expectedRevision: 0, type, payload, ...extra });
function run(s: LabState, ...steps: [string, Record<string, unknown>?][]) {
  for (const [type, payload = {}] of steps) {
    const p = parseEnvelope(env(type, payload));
    if (!p.ok) throw new Error(p.message);
    const r = applyCommand(s, p.cmd);
    if (!r.ok) throw new Error(r.message);
    s = r.state;
  }
  return s;
}
const accepted = (cats = ALL) => run(freshLabState(), ['sendInvite'], ['switchActor', { actor: 'monitored' }], ['accept', { categories: cats }]);

describe('command schema', () => {
  it('allowlists commands and rejects anything else', () => {
    expect(COMMAND_TYPES).not.toContain('setState');
    for (const t of ['setState', 'toString', '__proto__', 'hasOwnProperty']) expect(parseEnvelope(env(t))).toMatchObject({ ok: false, code: 'unknown_command' });
  });
  it('rejects unknown keys at the top level and in payloads', () => {
    expect(parseEnvelope(env('reset', {}, { state: {} }))).toMatchObject({ ok: false, code: 'unknown_field' });
    expect(parseEnvelope(env('sendInvite', { at: 1 }))).toMatchObject({ ok: false, code: 'unknown_field' });
    expect(parseEnvelope(env('sendInvite', { timestamp: '2026-01-01' }))).toMatchObject({ ok: false, code: 'unknown_field' });
  });
  it('rejects unknown categories, scenarios, sensors and enum values', () => {
    expect(parseEnvelope(env('share', { category: 'gps' }))).toMatchObject({ ok: false, code: 'invalid_value' });
    expect(parseEnvelope(env('setScenario', { scenarioId: 'great' }))).toMatchObject({ ok: false, code: 'invalid_value' });
    expect(parseEnvelope(env('pairSensor', { sensor: 'camera' }))).toMatchObject({ ok: false, code: 'invalid_value' });
    expect(parseEnvelope(env('accept', { categories: 'drinks' }))).toMatchObject({ ok: false, code: 'invalid_value' });
    expect(parseEnvelope(env('accept', { categories: [...ALL, 'drinks'] }))).toMatchObject({ ok: false, code: 'invalid_value' });
  });
});

describe('applyCommand', () => {
  it('is pure: the previous state is never mutated', () => {
    const s = freshLabState();
    const copy = structuredClone(s);
    applyCommand(s, { type: 'sendInvite', payload: {} });
    expect(s).toEqual(copy);
  });
  it('uses the stored demo role as the actor', () => {
    const s = run(freshLabState(), ['sendInvite']);
    expect(applyCommand(s, { type: 'accept', payload: { categories: ALL } })).toMatchObject({ ok: false, status: 422 });
  });
  it('produces states that pass storage validation and caps history', () => {
    let s = accepted();
    for (let i = 0; i < LIMITS.events + 30; i++) s = run(s, ['viewed', { surface: 'start' }]);
    expect(s.events).toHaveLength(LIMITS.events);
    expect(isValidLabState(s)).toBe(true);
  });
});

describe('derived outputs follow current consent', () => {
  it('unshared areas carry no timing or trend, in the snapshot or the export', () => {
    const s = accepted(['meals']);
    const d = derive(s);
    expect(d.insight.readings.filter((r) => r.state !== 'notShared').map((r) => r.id)).toEqual(['meals']);
    expect(d.insight.readings.filter((r) => r.state === 'notShared').every((r) => r.lastEventMins === null)).toBe(true);
    expect(d.weekly.trends.map((t) => t.id)).toEqual(['meals']);
    const ex = exportView(s, 3);
    expect(ex.firstInsight.readings.map((r) => r.id)).toEqual(['meals']);
    expect(JSON.stringify(ex)).not.toMatch(/drinks|bathroom|night/);
  });
});

describe('stored state validation', () => {
  it('rejects tampered or unknown values', () => {
    const good = accepted();
    expect(isValidLabState(good)).toBe(true);
    expect(isValidLabState({ ...good, scenarioId: 'great' })).toBe(false);
    expect(isValidLabState({ ...good, consent: { ...good.consent, shared: ['gps'] } })).toBe(false);
    expect(isValidLabState({ ...good, consent: { ...good.consent, status: 'declined' } })).toBe(false);
    expect(isValidLabState({ ...good, view: 'admin' })).toBe(false);
    expect(isValidLabState(null)).toBe(false);
  });
});

describe('deploy config', () => {
  it('never enables fault injection and declares a SQLite Durable Object', () => {
    const cfg = readFileSync('wrangler.jsonc', 'utf8');
    expect(cfg).not.toMatch(/FAULT_INJECTION|"vars"/);
    expect(cfg).toMatch(/"new_sqlite_classes": \["VisitorLab"\]/);
  });
});
