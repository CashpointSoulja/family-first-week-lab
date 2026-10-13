import { describe, expect, it } from 'vitest';
import { accept, ConsentError, decline, initialConsent, revoke, sendInvite, share, canSeeData } from '../../src/engine/consent';
import { firstInsight, STALE_AFTER_MINS } from '../../src/engine/insight';
import { weeklySummary } from '../../src/engine/weekly';
import { SCENARIOS, CATEGORIES } from '../../src/engine/fixtures';
import { findBanned } from '../../src/engine/copy';
import { makeEvent, EVENT_CATALOGUE } from '../../src/engine/events';
import { SYNTHETIC_FUNNEL } from '../../src/engine/lab';
import type { CategoryId, ScenarioId } from '../../src/engine/types';

const ALL = CATEGORIES.map((c) => c.id) as CategoryId[];
const accepted = (cats: CategoryId[] = ALL) => accept(sendInvite(initialConsent(), 'family'), 'monitored', cats);

describe('consent: no bypass', () => {
  it('starts with nothing shared', () => {
    expect(canSeeData(initialConsent())).toBe(false);
  });
  it('pending invitation shares nothing', () => {
    const c = sendInvite(initialConsent(), 'family');
    expect(c.status).toBe('pending');
    expect(canSeeData(c)).toBe(false);
  });
  it('family member cannot accept, decline or revoke on their behalf', () => {
    const p = sendInvite(initialConsent(), 'family');
    expect(() => accept(p, 'family', ALL)).toThrow(ConsentError);
    expect(() => decline(p, 'family')).toThrow(ConsentError);
    expect(() => revoke(accepted(), 'family')).toThrow(ConsentError);
    expect(() => share(accepted(['drinks']), 'family', 'meals')).toThrow(ConsentError);
  });
  it('monitored person cannot send an invite to themselves', () => {
    expect(() => sendInvite(initialConsent(), 'monitored')).toThrow(ConsentError);
  });
  it('cannot accept without an invitation, or with nothing chosen', () => {
    expect(() => accept(initialConsent(), 'monitored', ALL)).toThrow(ConsentError);
    expect(() => accept(sendInvite(initialConsent(), 'family'), 'monitored', [])).toThrow(/at least one/);
  });
  it('accepts granular categories only', () => {
    const c = accepted(['drinks', 'meals', 'drinks']);
    expect(c.shared).toEqual(['drinks', 'meals']);
  });
  it('decline shares nothing and can only be re-asked, not overridden', () => {
    const d = decline(sendInvite(initialConsent(), 'family'), 'monitored');
    expect(d.status).toBe('declined');
    expect(canSeeData(d)).toBe(false);
    const again = sendInvite(d, 'family');
    expect(again.status).toBe('pending');
    expect(canSeeData(again)).toBe(false);
  });
  it('cannot send a second invite while one is pending or accepted', () => {
    expect(() => sendInvite(sendInvite(initialConsent(), 'family'), 'family')).toThrow(ConsentError);
    expect(() => sendInvite(accepted(), 'family')).toThrow(ConsentError);
  });
  it('revoking one category removes it; revoking the last turns sharing off', () => {
    let c = accepted(['drinks', 'meals']);
    c = revoke(c, 'monitored', 'drinks');
    expect(c.status).toBe('accepted');
    expect(c.shared).toEqual(['meals']);
    c = revoke(c, 'monitored', 'meals');
    expect(c.status).toBe('revoked');
    expect(canSeeData(c)).toBe(false);
  });
  it('revoke all, then history records who did what', () => {
    const c = revoke(accepted(), 'monitored');
    expect(c.status).toBe('revoked');
    expect(c.history.map((h) => `${h.actor}:${h.action}`)).toEqual(['family:invite_sent', 'monitored:accepted', 'monitored:all_revoked']);
  });
});

describe('first useful insight', () => {
  const sc = (id: ScenarioId) => SCENARIOS[id];
  it('no consent: nothing shown', () => {
    const i = firstInsight(sc('stable'), initialConsent(), sc('stable').sensors);
    expect(i.status).toBe('noConsent');
    expect(i.readings.every((r) => r.state === 'notShared')).toBe(true);
  });
  it('revoked: nothing shown', () => {
    const i = firstInsight(sc('stable'), revoke(accepted(), 'monitored'), sc('stable').sensors);
    expect(i.status).toBe('revoked');
  });
  it('day 0: too early, even though some sensors report', () => {
    const i = firstInsight(sc('day0'), accepted(), sc('day0').sensors);
    expect(i.status).toBe('tooEarly');
  });
  it('stable: ready with full coverage and freshness', () => {
    const i = firstInsight(sc('stable'), accepted(), sc('stable').sensors);
    expect(i.status).toBe('ready');
    expect(i.coverage).toEqual({ reporting: 6, shared: 6, pct: 100 });
    expect(i.freshness).toMatch(/min ago/);
    expect(i.uncertainty.length).toBeGreaterThanOrEqual(3);
  });
  it('stale hub: never reassures', () => {
    const i = firstInsight(sc('stale'), accepted(), sc('stale').sensors);
    expect(i.status).toBe('stale');
    expect(i.readings.filter((r) => r.state === 'reporting')).toHaveLength(0);
    expect(i.readings.every((r) => r.state === 'stale' || r.state === 'missing')).toBe(true);
    expect(sc('stale').hubLastSeenHours * 60).toBeGreaterThan(STALE_AFTER_MINS);
  });
  it('patchy coverage: missing shown as missing, not fine', () => {
    const i = firstInsight(sc('gaps'), accepted(), sc('gaps').sensors);
    const missing = i.readings.filter((r) => r.state === 'missing').map((r) => r.id);
    expect(missing).toEqual(expect.arrayContaining(['drinks', 'bathroom']));
    for (const r of i.readings.filter((x) => x.state === 'missing')) expect(r.sentence).toMatch(/unknown/);
    expect(i.status === 'insufficient' || /incomplete/.test(i.body)).toBe(true);
  });
  it('insufficient when most shared sensors are missing', () => {
    const i = firstInsight(sc('gaps'), accepted(['drinks', 'bathroom', 'night']), sc('gaps').sensors);
    expect(i.status).toBe('insufficient');
  });
  it('unshared categories are never described', () => {
    const i = firstInsight(sc('stable'), accepted(['drinks']), sc('stable').sensors);
    const others = i.readings.filter((r) => r.id !== 'drinks');
    expect(others.every((r) => r.state === 'notShared' && r.lastEventMins === null)).toBe(true);
    expect(i.coverage.shared).toBe(1);
  });
});

describe('weekly summary', () => {
  const run = (id: ScenarioId, c = accepted()) => weeklySummary(SCENARIOS[id], c, SCENARIOS[id].sensors);
  it('stable pattern', () => expect(run('stable').state).toBe('stable'));
  it('changed pattern names the areas that differ', () => {
    const w = run('changed');
    expect(w.state).toBe('changed');
    const changed = w.trends.filter((t) => t.direction !== 'same').map((t) => t.id);
    expect(changed).toEqual(expect.arrayContaining(['drinks', 'outside']));
    expect(w.checkInPrompt).toBeTruthy();
  });
  it('insufficient coverage is a data gap, not stable', () => {
    const w = run('gaps');
    expect(w.state).toBe('insufficient');
    expect(w.body).toMatch(/data gap/);
  });
  it('baseline forming before 7 days', () => {
    expect(run('day0').state).toBe('forming');
    expect(run('stale').state).toBe('forming');
  });
  it('locked without consent or after revoke', () => {
    expect(run('stable', initialConsent()).state).toBe('locked');
    expect(run('stable', revoke(accepted(), 'monitored')).state).toBe('locked');
  });
});

describe('copy guardrails', () => {
  it('no diagnosis, medical advice, prediction or false reassurance in any generated text', () => {
    for (const id of Object.keys(SCENARIOS) as ScenarioId[]) {
      for (const cats of [ALL, ['drinks'] as CategoryId[], ['bathroom', 'night'] as CategoryId[]]) {
        const sc = SCENARIOS[id];
        const i = firstInsight(sc, accepted(cats), sc.sensors);
        const w = weeklySummary(sc, accepted(cats), sc.sensors);
        const text = [i.headline, i.body, ...i.readings.map((r) => r.sentence), ...i.uncertainty, w.headline, w.body, w.checkInPrompt ?? '', ...w.trends.map((t) => t.sentence)].join(' ');
        expect(findBanned(text), `${id}`).toEqual([]);
      }
    }
  });
  it('guard catches banned phrases', () => {
    expect(findBanned('Grace may have dementia')).not.toEqual([]);
    expect(findBanned('Everything is fine')).not.toEqual([]);
  });
});

describe('events', () => {
  it('marks every event synthetic and rejects identifying props', () => {
    const e = makeEvent('invite_sent', { invite_attempt: 1 }, { household_id: 'hh-x' });
    expect(e.props.synthetic).toBe(true);
    expect(() => makeEvent('invite_sent', { email: 'x' }, {})).toThrow(/Forbidden/);
    expect(() => makeEvent('not_an_event', {}, {})).toThrow(/Unknown/);
  });
  it('catalogue covers the four metrics and the safety guardrails', () => {
    const names = EVENT_CATALOGUE.map((e) => e.name);
    for (const n of ['consent_accepted', 'setup_ready', 'first_insight_viewed', 'weekly_summary_viewed', 'sharing_revoked', 'notification_frequency_set', 'insight_feedback']) expect(names).toContain(n);
  });
  it('synthetic funnel is monotonic and states a denominator per step', () => {
    for (let i = 1; i < SYNTHETIC_FUNNEL.length; i++) expect(SYNTHETIC_FUNNEL[i].count).toBeLessThanOrEqual(SYNTHETIC_FUNNEL[i - 1].count);
    expect(SYNTHETIC_FUNNEL.every((f) => f.denominator.length > 0)).toBe(true);
  });
});
