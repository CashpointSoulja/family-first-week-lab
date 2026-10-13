/**
 * Expected/actual eval for the server-side consent rules.
 *   EVAL_RULES=real   (default) every case must match; exits 1 on any mismatch.
 *   EVAL_RULES=broken swaps in a deliberately broken rule (family can accept on the
 *                     invited person's behalf). Run with EVAL_EXPECT=red to assert the
 *                     eval catches it: exits 0 only if at least one case turns red.
 */
import { applyCommand, CONSENT_RULES, type CommandType, type ConsentRules } from '../src/server/commands';
import { exportView, freshLabState, type LabState } from '../src/server/model';
import * as real from '../src/engine/consent';

const BROKEN: ConsentRules = {
  ...CONSENT_RULES,
  accept: (c, _actor, categories, at) => real.accept(c, 'monitored', categories, at),
};

type Step = [CommandType, Record<string, unknown>?];
interface Case {
  id: string;
  rule: string;
  steps: Step[];
  expect: 'applied' | 'rejected';
  /** Optional disclosure check on the export after the last step. */
  disclosed?: (ex: ReturnType<typeof exportView>) => string;
  expectDisclosed?: string;
}

const ALL = ['drinks', 'meals', 'outside', 'wake', 'night', 'bathroom'];
const invite: Step[] = [['sendInvite']];
const asMonitored: Step = ['switchActor', { actor: 'monitored' }];
const acceptAll: Step[] = [...invite, asMonitored, ['accept', { categories: ALL }]];
const shared = (ex: ReturnType<typeof exportView>) => `readings=${ex.firstInsight.readings.length} trends=${ex.weekly.trends.length}`;

const CASES: Case[] = [
  { id: 'C1', rule: 'Family role cannot accept on the invited person\'s behalf', steps: [...invite, ['accept', { categories: ALL }]], expect: 'rejected' },
  { id: 'C2', rule: 'Pending invite discloses nothing, even after a family accept attempt', steps: [...invite, ['accept', { categories: ALL }]], expect: 'rejected', disclosed: shared, expectDisclosed: 'readings=0 trends=0' },
  { id: 'C3', rule: 'Invited person can accept a subset', steps: [...invite, asMonitored, ['accept', { categories: ['drinks', 'meals'] }]], expect: 'applied', disclosed: shared, expectDisclosed: 'readings=2 trends=2' },
  { id: 'C4', rule: 'Accept needs at least one area', steps: [...invite, asMonitored, ['accept', { categories: [] }]], expect: 'rejected' },
  { id: 'C5', rule: 'Cannot accept without a pending invite', steps: [asMonitored, ['accept', { categories: ['drinks'] }]], expect: 'rejected' },
  { id: 'C6', rule: 'Family role cannot decline for them', steps: [...invite, ['decline']], expect: 'rejected' },
  { id: 'C7', rule: 'Invited person can decline; nothing disclosed', steps: [...invite, asMonitored, ['decline']], expect: 'applied', disclosed: shared, expectDisclosed: 'readings=0 trends=0' },
  { id: 'C8', rule: 'Invited person cannot send the family invite', steps: [asMonitored, ['sendInvite']], expect: 'rejected' },
  { id: 'C9', rule: 'Family role cannot revoke or re-share', steps: [...acceptAll, ['switchActor', { actor: 'family' }], ['revoke', { category: 'drinks' }]], expect: 'rejected' },
  { id: 'C10', rule: 'Category revoke removes it from the export', steps: [...acceptAll, asMonitored, ['revoke', { category: 'drinks' }]], expect: 'applied', disclosed: (ex) => `drinks=${JSON.stringify(ex).includes('drinks')}`, expectDisclosed: 'drinks=false' },
  { id: 'C11', rule: 'Full revoke discloses nothing', steps: [...acceptAll, asMonitored, ['revoke', {}]], expect: 'applied', disclosed: shared, expectDisclosed: 'readings=0 trends=0' },
  { id: 'C12', rule: 'Cannot revoke an area that is not shared', steps: [...invite, asMonitored, ['accept', { categories: ['meals'] }], asMonitored, ['revoke', { category: 'drinks' }]], expect: 'rejected' },
  { id: 'C13', rule: 'Re-invite after decline goes back to pending, still nothing shared', steps: [...invite, asMonitored, ['decline'], ['sendInvite']], expect: 'applied', disclosed: (ex) => `${ex.consent.status} ${shared(ex)}`, expectDisclosed: 'pending readings=0 trends=0' },
  { id: 'C14', rule: 'Sensors stay paused before consent', steps: [...invite, ['pairSensor', { sensor: 'kettle' }]], expect: 'rejected' },
];

const mode = process.env.EVAL_RULES === 'broken' ? 'broken' : 'real';
const rules = mode === 'broken' ? BROKEN : CONSENT_RULES;

const rows = CASES.map((c) => {
  let s: LabState = freshLabState();
  let last: 'applied' | 'rejected' = 'applied';
  let reason = '';
  for (const [type, payload = {}] of c.steps) {
    const r = applyCommand(s, { type, payload }, rules);
    if (r.ok) { s = r.state; last = 'applied'; reason = ''; }
    else { last = 'rejected'; reason = r.message; }
  }
  const disclosed = c.disclosed ? c.disclosed(exportView(s, 0)) : '';
  const expected = c.expectDisclosed ? `${c.expect}; ${c.expectDisclosed}` : c.expect;
  const actual = c.disclosed ? `${last}; ${disclosed}` : last;
  return { ...c, expected, actual, pass: expected === actual, reason };
});

const failed = rows.filter((r) => !r.pass);
console.log(`Consent eval, rules = ${mode}${mode === 'broken' ? ' (family role may accept on their behalf)' : ''}\n`);
console.log('| Case | Rule | Expected | Actual | Result |');
console.log('|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.id} | ${r.rule} | ${r.expected} | ${r.actual} | ${r.pass ? 'PASS' : 'FAIL'} |`);
console.log(`\n${rows.length - failed.length}/${rows.length} cases match.`);

if (process.env.EVAL_EXPECT === 'red') {
  if (failed.length === 0) {
    console.log('RED CHECK FAILED: the broken rule was not caught.');
    process.exit(1);
  }
  console.log(`RED CHECK PASSED: the broken rule turned ${failed.length} case(s) red (${failed.map((r) => r.id).join(', ')}).`);
  process.exit(0);
}
process.exit(failed.length ? 1 : 0);
