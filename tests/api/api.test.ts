import { describe, expect, it } from 'vitest';
import { PORT } from './server';

const BASE = `http://127.0.0.1:${PORT}`;
const ALL = ['drinks', 'meals', 'outside', 'wake', 'night', 'bathroom'];
let seq = 0;
const newId = () => `cmd-${Date.now().toString(36)}-${(seq++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

interface Res { status: number; body: any; headers: Headers; text: string }

class Visitor {
  cookie = '';
  rev = 0;
  setCookie: string | null = null;

  async req(path: string, init: RequestInit = {}): Promise<Res> {
    const headers = new Headers(init.headers);
    if (this.cookie && !headers.has('Cookie')) headers.set('Cookie', this.cookie);
    const res = await fetch(BASE + path, { ...init, headers });
    const sc = res.headers.get('set-cookie');
    if (sc) {
      this.setCookie = sc;
      this.cookie = sc.split(';')[0];
    }
    const text = await res.text();
    let body: any = null;
    try { body = JSON.parse(text); } catch { /* not json */ }
    if (body && typeof body.revision === 'number' && body.state) this.rev = body.revision;
    return { status: res.status, body, headers: res.headers, text };
  }
  async load() {
    const r = await this.req('/api/state');
    expect(r.status).toBe(200);
    return r;
  }
  post(body: unknown, headers: Record<string, string> = {}) {
    return this.req('/api/command', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: BASE, ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  }
  cmd(type: string, payload: Record<string, unknown> = {}, o: { rev?: number; id?: string; headers?: Record<string, string> } = {}) {
    return this.post({ commandId: o.id ?? newId(), expectedRevision: o.rev ?? this.rev, type, payload }, o.headers);
  }
  async ok(type: string, payload: Record<string, unknown> = {}) {
    const r = await this.cmd(type, payload);
    expect(r.status, `${type}: ${r.text.slice(0, 200)}`).toBe(200);
    return r;
  }
  async accepted(cats = ALL) {
    await this.load();
    await this.ok('sendInvite');
    await this.ok('switchActor', { actor: 'monitored' });
    return this.ok('accept', { categories: cats });
  }
  state() { return this.load().then((r) => r.body); }
  exportView() { return this.req('/api/export').then((r) => r.body); }
}

describe('visitor identity and isolation', () => {
  it('issues a random HttpOnly SameSite=Strict cookie, different per visitor', async () => {
    const a = new Visitor(); const b = new Visitor();
    await a.load(); await b.load();
    expect(a.setCookie).toMatch(/^ffwl_vid=[a-f0-9]{32}; Path=\/; HttpOnly; SameSite=Strict; Max-Age=\d+$/);
    expect(a.cookie).not.toBe(b.cookie);
  });

  it('keeps each visitor in its own Durable Object', async () => {
    const a = new Visitor(); const b = new Visitor();
    await a.accepted(['drinks', 'meals']);
    await b.load();
    expect((await a.state()).state.consent.status).toBe('accepted');
    expect((await b.state()).state.consent.status).toBe('notInvited');
    expect((await b.exportView()).firstInsight.readings).toEqual([]);
    const r = await b.cmd('revoke', {});
    expect(r.status).toBe(422);
    expect((await a.state()).state.consent.shared).toEqual(['drinks', 'meals']);
  });

  it('replaces a malformed cookie with a new identity instead of trusting it', async () => {
    const v = new Visitor();
    v.cookie = 'ffwl_vid=../../other-visitor';
    const r = await v.req('/api/state');
    expect(r.status).toBe(200);
    expect(r.body.revision).toBe(0);
    expect(v.cookie).toMatch(/^ffwl_vid=[a-f0-9]{32}$/);
  });

  it('refuses writes with no visitor cookie', async () => {
    const v = new Visitor();
    const r = await v.cmd('sendInvite', {}, { rev: 0 });
    expect(r.status).toBe(403);
    expect(r.body.error).toBe('no_visitor');
  });
});

describe('edge checks: origin, size, content type, routes', () => {
  it('rejects cross-origin and origin-less writes', async () => {
    const v = new Visitor(); await v.load();
    expect((await v.cmd('sendInvite', {}, { headers: { Origin: 'https://evil.example' } })).status).toBe(403);
    const noOrigin = await v.req('/api/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ commandId: newId(), expectedRevision: 0, type: 'sendInvite', payload: {} }) });
    expect(noOrigin.status).toBe(403);
    expect(noOrigin.body.error).toBe('cross_origin');
    expect((await v.state()).revision).toBe(0);
  });

  it('rejects bodies over 2048 bytes, non-JSON content types and broken JSON', async () => {
    const v = new Visitor(); await v.load();
    const big = await v.post({ commandId: newId(), expectedRevision: 0, type: 'setGoal', payload: { goal: 'x'.repeat(3000) } });
    expect(big.status).toBe(413);
    expect((await v.req('/api/command', { method: 'POST', headers: { 'Content-Type': 'text/plain', Origin: BASE }, body: '{}' })).status).toBe(415);
    const broken = await v.post('{"commandId": "abcdefgh", ');
    expect(broken.status).toBe(400);
    expect(broken.body.error).toBe('bad_json');
    expect((await v.state()).revision).toBe(0);
  });

  it('answers unknown routes and wrong methods with JSON errors, never cached', async () => {
    const v = new Visitor();
    const nf = await v.req('/api/nope');
    expect(nf.status).toBe(404);
    expect((await v.req('/api/command')).status).toBe(405);
    expect((await v.req('/api/state', { method: 'POST', headers: { Origin: BASE } })).status).toBe(405);
    const s = await v.load();
    expect(s.headers.get('cache-control')).toBe('no-store');
    expect(nf.headers.get('cache-control')).toBe('no-store');
  });
});

describe('hostile payloads never change state', () => {
  const hostile: [string, unknown][] = [
    ['array body', []],
    ['whole-state blob', { commandId: 'abcdefgh-1', expectedRevision: 0, type: 'reset', payload: {}, state: { consent: { status: 'accepted', shared: ALL } } }],
    ['state as a command', { commandId: 'abcdefgh-2', expectedRevision: 0, type: 'setState', payload: { consent: { status: 'accepted' } } }],
    ['caller timestamp', { commandId: 'abcdefgh-3', expectedRevision: 0, type: 'sendInvite', payload: { at: 1700000000000 } }],
    ['caller actor', { commandId: 'abcdefgh-4', expectedRevision: 0, type: 'accept', payload: { categories: ['drinks'], actor: 'monitored' } }],
    ['unknown category', { commandId: 'abcdefgh-5', expectedRevision: 0, type: 'share', payload: { category: 'location' } }],
    ['unknown scenario', { commandId: 'abcdefgh-6', expectedRevision: 0, type: 'setScenario', payload: { scenarioId: 'perfect' } }],
    ['duplicate categories', { commandId: 'abcdefgh-7', expectedRevision: 0, type: 'accept', payload: { categories: ['drinks', 'drinks'] } }],
    ['prototype key', JSON.parse('{"commandId":"abcdefgh-8","expectedRevision":0,"type":"setGoal","payload":{"goal":"fewerCalls","__proto__":{"x":1}}}')],
    ['bad command id', { commandId: 'x', expectedRevision: 0, type: 'sendInvite', payload: {} }],
    ['negative revision', { commandId: 'abcdefgh-9', expectedRevision: -1, type: 'sendInvite', payload: {} }],
    ['string revision', { commandId: 'abcdefgh-10', expectedRevision: '0', type: 'sendInvite', payload: {} }],
    ['payload array', { commandId: 'abcdefgh-11', expectedRevision: 0, type: 'sendInvite', payload: [] }],
    ['missing field', { commandId: 'abcdefgh-12', expectedRevision: 0, type: 'setFrequency', payload: {} }],
    ['unknown sensor status', { commandId: 'abcdefgh-13', expectedRevision: 0, type: 'pairSensor', payload: { sensor: 'camera' } }],
    ['free-text check-in', { commandId: 'abcdefgh-14', expectedRevision: 0, type: 'checkIn', payload: { channel: 'Email Mum the readings' } }],
    ['inherited command name', { commandId: 'abcdefgh-15', expectedRevision: 0, type: 'constructor', payload: {} }],
  ];
  it.each(hostile)('%s -> 400', async (_label, body) => {
    const v = new Visitor(); await v.load();
    const r = await v.post(body);
    expect(r.status).toBe(400);
    expect(r.body.state).toBeUndefined();
    const after = await v.state();
    expect(after.revision).toBe(0);
    expect(after.state.consent.status).toBe('notInvited');
  });
});

describe('server-side consent transitions', () => {
  it('only the monitored demo role can accept, decline, share or revoke; only family can invite', async () => {
    const v = new Visitor(); await v.load();
    expect((await v.cmd('accept', { categories: ['drinks'] })).status).toBe(422);
    await v.ok('sendInvite');
    const fam = await v.cmd('accept', { categories: ALL });
    expect(fam.status).toBe(422);
    expect(fam.body.message).toMatch(/only be done by the person being invited/);
    expect((await v.cmd('decline')).status).toBe(422);
    await v.ok('switchActor', { actor: 'monitored' });
    expect((await v.cmd('sendInvite')).status).toBe(422);
    expect((await v.cmd('accept', { categories: [] })).status).toBe(422);
    await v.ok('accept', { categories: ['drinks'] });
    expect((await v.cmd('accept', { categories: ['meals'] })).status).toBe(422);
    const s = await v.state();
    expect(s.state.consent).toMatchObject({ status: 'accepted', shared: ['drinks'] });
  });

  it('rejects revoking an unshared area and impossible sensor changes', async () => {
    const v = new Visitor(); await v.load();
    expect((await v.cmd('pairSensor', { sensor: 'kettle' })).status).toBe(422);
    await v.ok('setScenario', { scenarioId: 'day0' });
    await v.accepted(['drinks']);
    await v.ok('switchActor', { actor: 'monitored' });
    expect((await v.cmd('revoke', { category: 'meals' })).status).toBe(422);
    expect((await v.cmd('pairSensor', { sensor: 'fridge' })).status).toBe(422);
    const st = (await v.state()).state.sensors.kettle;
    expect((await v.cmd(st === 'notPaired' ? 'testSensor' : 'pairSensor', { sensor: 'kettle' })).status).toBe(422);
  });

  it('decline shares nothing and a re-invite returns to pending', async () => {
    const v = new Visitor(); await v.load();
    await v.ok('sendInvite');
    await v.ok('switchActor', { actor: 'monitored' });
    const d = await v.ok('decline');
    expect(d.body.state.consent).toMatchObject({ status: 'declined', shared: [] });
    expect(d.body.derived.insight.status).toBe('noConsent');
    expect(d.body.derived.weekly.state).toBe('locked');
    await v.ok('sendInvite');
    expect((await v.state()).state.consent.status).toBe('pending');
  });
});

describe('revocation removes access from every derived output and the export', () => {
  it('category revoke, then full revoke, with no stale disclosure', async () => {
    const v = new Visitor();
    await v.accepted(ALL);
    let ex = await v.exportView();
    expect(ex.firstInsight.readings.map((r: any) => r.id).sort()).toEqual([...ALL].sort());
    expect(ex.weekly.trends).toHaveLength(6);

    await v.ok('switchActor', { actor: 'monitored' });
    const r = await v.ok('revoke', { category: 'drinks' });
    const ins = r.body.derived.insight;
    expect(ins.coverage.shared).toBe(5);
    const drinks = ins.readings.find((x: any) => x.id === 'drinks');
    expect(drinks).toMatchObject({ state: 'notShared', lastEventMins: null });
    expect(r.body.derived.weekly.trends.map((t: any) => t.id)).not.toContain('drinks');
    expect(r.body.derived.weekly.coverageDays.total).toBe(5);
    ex = await v.exportView();
    expect(JSON.stringify(ex)).not.toContain('drinks');
    expect(ex.consent.shared).toHaveLength(5);

    const all = await v.ok('revoke', {});
    expect(all.body.derived.insight.status).toBe('revoked');
    expect(all.body.derived.insight.readings.every((x: any) => x.state === 'notShared' && x.lastEventMins === null)).toBe(true);
    expect(all.body.derived.weekly).toMatchObject({ state: 'locked', trends: [] });
    ex = await v.exportView();
    expect(ex).toMatchObject({ synthetic: true, consent: { status: 'revoked', shared: [] }, firstInsight: { status: 'revoked', readings: [], freshness: null }, weekly: { state: 'locked', trends: [] } });
    expect((await v.cmd('checkIn', { channel: 'Call' })).status).toBe(422);
  });
});

describe('revisions, replay and concurrency', () => {
  it('a stale revision is refused with the latest snapshot and changes nothing', async () => {
    const v = new Visitor(); await v.load();
    await v.ok('sendInvite');
    const r = await v.cmd('setFrequency', { frequency: 'daily' }, { rev: 0 });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe('stale_revision');
    expect(r.body.revision).toBe(1);
    expect((await v.state()).state.frequency).toBe('weekly');
  });

  it('replaying the same command returns the stored reply without applying twice', async () => {
    const v = new Visitor(); await v.load();
    const id = newId();
    const first = await v.cmd('sendInvite', {}, { id, rev: 0 });
    expect(first.status).toBe(200);
    const again = await v.cmd('sendInvite', {}, { id, rev: 0 });
    expect(again.status).toBe(200);
    expect(again.headers.get('idempotent-replay')).toBe('true');
    expect(again.text).toBe(first.text);
    const s = await v.state();
    expect(s.revision).toBe(1);
    expect(s.state.inviteAttempts).toBe(1);
    expect(s.state.events.filter((e: any) => e.name === 'invite_sent')).toHaveLength(1);
  });

  it('a reused commandId with a different body is a conflict', async () => {
    const v = new Visitor(); await v.load();
    const id = newId();
    await v.cmd('setFrequency', { frequency: 'daily' }, { id, rev: 0 });
    const r = await v.cmd('setFrequency', { frequency: 'off' }, { id, rev: 0 });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe('idempotency_conflict');
    expect((await v.state()).state.frequency).toBe('daily');
  });

  it('a replayed rejection stays rejected', async () => {
    const v = new Visitor(); await v.load();
    await v.ok('sendInvite');
    const id = newId();
    const a = await v.cmd('accept', { categories: ['drinks'] }, { id });
    const b = await v.cmd('accept', { categories: ['drinks'] }, { id });
    expect([a.status, b.status]).toEqual([422, 422]);
    expect(b.headers.get('idempotent-replay')).toBe('true');
  });

  it('concurrent consent changes on one revision: exactly one wins', async () => {
    const v = new Visitor();
    await v.accepted(ALL);
    await v.ok('switchActor', { actor: 'monitored' });
    const rev = v.rev;
    const tabs = await Promise.all([
      v.cmd('revoke', { category: 'drinks' }, { rev }),
      v.cmd('revoke', {}, { rev }),
      v.cmd('revoke', { category: 'night' }, { rev }),
      v.cmd('switchActor', { actor: 'family' }, { rev }),
      v.cmd('share', { category: 'drinks' }, { rev }),
    ]);
    const codes = tabs.map((t) => t.status).sort();
    expect(codes.filter((c) => c === 200)).toHaveLength(1);
    expect(codes.filter((c) => c === 409)).toHaveLength(4);
    expect((await v.state()).revision).toBe(rev + 1);
  });
});

describe('fail-closed storage', () => {
  it('a failed write rolls back state, command log and audit, and reports 503', async () => {
    const v = new Visitor(); await v.load();
    const id = newId();
    const r = await v.cmd('sendInvite', {}, { id, rev: 0, headers: { 'X-Lab-Fault': 'write' } });
    expect(r.status).toBe(503);
    expect(r.body.error).toBe('storage_unavailable');
    expect(r.body.state).toBeUndefined();
    const s = await v.state();
    expect(s.revision).toBe(0);
    expect(s.state.consent.status).toBe('notInvited');
    expect((await v.req('/api/audit')).body.retained).toBe(0);
    const retry = await v.cmd('sendInvite', {}, { id, rev: 0 });
    expect(retry.status).toBe(200);
    expect(retry.headers.get('idempotent-replay')).toBeNull();
  });

  it('a failed read shows nothing rather than a default state', async () => {
    const v = new Visitor();
    await v.accepted(['drinks']);
    for (const path of ['/api/state', '/api/export']) {
      const r = await v.req(path, { headers: { 'X-Lab-Fault': 'read' } });
      expect(r.status).toBe(503);
      expect(r.body).toEqual({ error: 'storage_unavailable', message: expect.any(String) });
    }
    expect((await v.cmd('setFrequency', { frequency: 'off' }, { headers: { 'X-Lab-Fault': 'read' } })).status).toBe(503);
    expect((await v.state()).state.frequency).toBe('weekly');
  });
});

describe('reset, reload and bounded history', () => {
  it('reload returns the same saved state; reset starts over without reusing revisions', async () => {
    const v = new Visitor();
    await v.accepted(['meals', 'wake']);
    await v.ok('setScenario', { scenarioId: 'changed' });
    const one = await v.state();
    const two = await v.state();
    expect(two).toEqual(one);
    expect(two.state).toMatchObject({ scenarioId: 'changed', consent: { status: 'accepted', shared: ['meals', 'wake'] } });
    const before = v.rev;
    const r = await v.ok('reset');
    expect(r.body.revision).toBe(before + 1);
    expect(r.body.state).toMatchObject({ scenarioId: 'stable', consent: { status: 'notInvited', shared: [] }, events: [] });
    expect((await v.req('/api/audit')).body.entries[0]).toMatchObject({ type: 'reset', outcome: 'applied' });
  });

  it('caps events, audit rows and the replay window', async () => {
    const v = new Visitor(); await v.load();
    const firstId = newId();
    await v.cmd('viewed', { surface: 'start' }, { id: firstId });
    for (let i = 0; i < 520; i++) await v.ok('viewed', { surface: i % 2 ? 'start' : 'consent' });
    const s = await v.state();
    expect(s.state.events).toHaveLength(200);
    expect(s.state.events.at(-1).props.seq).toBe(521);
    const audit = (await v.req('/api/audit')).body;
    expect(audit.retained).toBe(500);
    expect(audit.entries).toHaveLength(50);
    const old = await v.cmd('viewed', { surface: 'start' }, { id: firstId, rev: 0 });
    expect(old.status).toBe(409);
    expect(old.body.error).toBe('stale_revision');
  });
});
