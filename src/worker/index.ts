import { DurableObject } from 'cloudflare:workers';
import { applyCommand, parseEnvelope, type Envelope } from '../server/commands';
import { derive, exportView, freshLabState, isValidLabState, LIMITS, type LabState } from '../server/model';

export interface Env {
  ASSETS: Fetcher;
  VISITOR: DurableObjectNamespace<VisitorLab>;
  /** Set only by the local API test runner. Never set in wrangler.jsonc. */
  FAULT_INJECTION?: string;
}

type Fault = 'read' | 'write' | null;
interface Reply { status: number; body: unknown; replayed?: boolean }
/** What crosses the RPC boundary: plain, already-serialised JSON. */
export interface Wire { status: number; text: string; replayed: boolean }
const wire = (r: Reply): Wire => ({ status: r.status, text: JSON.stringify(r.body), replayed: !!r.replayed });

const COOKIE = 'ffwl_vid';
const VISITOR_ID = /^[a-f0-9]{32}$/;

class StorageFault extends Error {}

/** One SQLite-backed Durable Object per visitor cookie. All state lives here; the browser only renders what this returns. */
export class VisitorLab extends DurableObject<Env> {
  private sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS lab_state (id INTEGER PRIMARY KEY CHECK (id = 1), revision INTEGER NOT NULL, body TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS command_log (seq INTEGER PRIMARY KEY AUTOINCREMENT, command_id TEXT NOT NULL UNIQUE, body_hash TEXT NOT NULL, status INTEGER NOT NULL, response TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS audit_log (seq INTEGER PRIMARY KEY AUTOINCREMENT, command_id TEXT NOT NULL, type TEXT NOT NULL, actor TEXT NOT NULL, outcome TEXT NOT NULL, revision_before INTEGER NOT NULL, revision_after INTEGER NOT NULL);
    `);
  }

  private load(fault: Fault): { revision: number; state: LabState } {
    try {
      if (fault === 'read') throw new StorageFault('injected read fault');
      const row = this.sql.exec<{ revision: number; body: string }>('SELECT revision, body FROM lab_state WHERE id = 1').toArray()[0];
      if (!row) return { revision: 0, state: freshLabState() };
      const state: unknown = JSON.parse(row.body);
      if (!Number.isInteger(row.revision) || !isValidLabState(state)) throw new StorageFault('stored state failed validation');
      return { revision: row.revision, state };
    } catch (e) {
      throw e instanceof StorageFault ? e : new StorageFault(String(e));
    }
  }

  private snapshot(revision: number, state: LabState) {
    return { revision, state, derived: derive(state), limits: LIMITS };
  }

  async getSnapshot(fault: Fault = null): Promise<Wire> {
    return wire(this.snapshotReply(fault));
  }
  async getExport(fault: Fault = null): Promise<Wire> {
    return wire(this.exportReply(fault));
  }
  async getAudit(): Promise<Wire> {
    return wire(this.auditReply());
  }
  async command(cmd: Envelope, fault: Fault = null): Promise<Wire> {
    return wire(this.commandReply(cmd, fault));
  }

  private snapshotReply(fault: Fault): Reply {
    try {
      const { revision, state } = this.load(fault);
      return { status: 200, body: this.snapshot(revision, state) };
    } catch {
      return storageDown();
    }
  }

  private exportReply(fault: Fault): Reply {
    try {
      const { revision, state } = this.load(fault);
      return { status: 200, body: exportView(state, revision) };
    } catch {
      return storageDown();
    }
  }

  private auditReply(): Reply {
    try {
      const rows = this.sql.exec('SELECT seq, command_id, type, actor, outcome, revision_before, revision_after FROM audit_log ORDER BY seq DESC LIMIT 50').toArray();
      const total = this.sql.exec<{ n: number }>('SELECT COUNT(*) AS n FROM audit_log').one().n;
      return { status: 200, body: { synthetic: true, retained: total, cap: LIMITS.auditLog, entries: rows } };
    } catch {
      return storageDown();
    }
  }

  /** Validated envelope in, one atomic SQLite transaction out. Any storage error rolls everything back and reports 503. */
  private commandReply(cmd: Envelope, fault: Fault): Reply {
    const hash = bodyHash(cmd);
    let prior: { body_hash: string; status: number; response: string } | undefined;
    let current: { revision: number; state: LabState };
    try {
      if (fault === 'read') throw new StorageFault('injected read fault');
      prior = this.sql.exec<{ body_hash: string; status: number; response: string }>('SELECT body_hash, status, response FROM command_log WHERE command_id = ?', cmd.commandId).toArray()[0];
      if (!prior) current = this.load(null);
    } catch {
      return storageDown();
    }
    if (prior) {
      if (prior.body_hash !== hash) return { status: 409, body: { error: 'idempotency_conflict', message: 'This commandId was already used for a different command' } };
      return { status: prior.status, body: JSON.parse(prior.response), replayed: true };
    }
    const { revision, state } = current!;
    if (cmd.expectedRevision !== revision) {
      return { status: 409, body: { error: 'stale_revision', message: 'The lab changed since you last loaded it. Showing the latest state.', ...this.snapshot(revision, state) } };
    }

    const result = applyCommand(state, cmd);
    const next = result.ok ? result.state : state;
    const nextRevision = result.ok ? revision + 1 : revision;
    const status = result.ok ? 200 : result.status;
    const body = result.ok
      ? this.snapshot(nextRevision, next)
      : { error: result.code, message: result.message, ...this.snapshot(revision, state) };
    if (!result.ok && result.status === 400) return { status, body };

    try {
      this.ctx.storage.transactionSync(() => {
        if (result.ok) {
          this.sql.exec('INSERT INTO lab_state (id, revision, body) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET revision = excluded.revision, body = excluded.body', nextRevision, JSON.stringify(next));
        }
        this.sql.exec('INSERT INTO command_log (command_id, body_hash, status, response) VALUES (?, ?, ?, ?)', cmd.commandId, hash, status, JSON.stringify(body));
        this.sql.exec('INSERT INTO audit_log (command_id, type, actor, outcome, revision_before, revision_after) VALUES (?, ?, ?, ?, ?, ?)', cmd.commandId, cmd.type, state.view, result.ok ? 'applied' : result.code, revision, nextRevision);
        this.sql.exec('DELETE FROM command_log WHERE seq <= (SELECT MAX(seq) FROM command_log) - ?', LIMITS.commandLog);
        this.sql.exec('DELETE FROM audit_log WHERE seq <= (SELECT MAX(seq) FROM audit_log) - ?', LIMITS.auditLog);
        if (fault === 'write') throw new StorageFault('injected write fault');
      });
    } catch {
      return storageDown();
    }
    return { status, body };
  }
}

const storageDown = (): Reply => ({ status: 503, body: { error: 'storage_unavailable', message: 'Lab storage is unavailable. Nothing was changed and nothing is shown rather than showing stale data.' } });

/** Small non-cryptographic fingerprint; only used to detect commandId reuse with a different body. */
function bodyHash(cmd: Envelope): string {
  const s = JSON.stringify([cmd.type, cmd.expectedRevision, cmd.payload]);
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    h1 = Math.imul(h1 ^ s.charCodeAt(i), 16777619);
    h2 = Math.imul(h2 ^ s.charCodeAt(i), 2246822519);
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

/* ---------- edge: identity, origin, size and content checks ---------- */

const raw = (status: number, text: string, extra: Record<string, string> = {}) =>
  new Response(text, {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', ...extra },
  });
const json = (status: number, body: unknown, extra: Record<string, string> = {}) => raw(status, JSON.stringify(body), extra);
const fail = (status: number, error: string, message: string, extra?: Record<string, string>) => json(status, { error, message }, extra);

function readVisitor(req: Request): string | null {
  const raw = req.headers.get('Cookie') ?? '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) {
      const id = v.join('=');
      return VISITOR_ID.test(id) ? id : null;
    }
  }
  return null;
}
function newVisitorId(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}
const setCookie = (id: string, url: URL) =>
  `${COOKIE}=${id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000${url.protocol === 'https:' ? '; Secure' : ''}`;

function sameOrigin(req: Request, url: URL): boolean {
  const origin = req.headers.get('Origin');
  if (origin !== null) return origin === url.origin;
  return req.headers.get('Sec-Fetch-Site') === 'same-origin';
}

async function readBounded(req: Request, max: number): Promise<string | null> {
  const declared = req.headers.get('Content-Length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > max)) return null;
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let o = 0;
  for (const c of chunks) { all.set(c, o); o += c.byteLength; }
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(all);
}

function faultFrom(req: Request, env: Env): Fault {
  if (env.FAULT_INJECTION !== '1') return null;
  const f = req.headers.get('X-Lab-Fault');
  return f === 'read' || f === 'write' ? f : null;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);

    const route = url.pathname;
    const known = ['/api/state', '/api/command', '/api/export', '/api/audit'];
    if (!known.includes(route)) return fail(404, 'not_found', 'Unknown API route');
    const method = route === '/api/command' ? 'POST' : 'GET';
    if (req.method !== method) return fail(405, 'method_not_allowed', `Use ${method}`, { Allow: method });

    let visitor = readVisitor(req);
    const fault = faultFrom(req, env);

    if (method === 'GET') {
      let cookie: Record<string, string> = {};
      if (!visitor) {
        visitor = newVisitorId();
        cookie = { 'Set-Cookie': setCookie(visitor, url) };
      }
      const stub = env.VISITOR.get(env.VISITOR.idFromName(visitor));
      const r = route === '/api/state' ? await stub.getSnapshot(fault) : route === '/api/export' ? await stub.getExport(fault) : await stub.getAudit();
      return raw(r.status, r.text, cookie);
    }

    if (!sameOrigin(req, url)) return fail(403, 'cross_origin', 'Writes must come from this site');
    if (!visitor) return fail(403, 'no_visitor', 'Load the lab first to get a visitor session');
    const ct = (req.headers.get('Content-Type') ?? '').split(';')[0].trim().toLowerCase();
    if (ct !== 'application/json') return fail(415, 'unsupported_media_type', 'Send application/json');
    let text: string | null;
    try {
      text = await readBounded(req, LIMITS.bodyBytes);
    } catch {
      return fail(400, 'bad_body', 'Body could not be read as UTF-8');
    }
    if (text === null) return fail(413, 'body_too_large', `Body must be at most ${LIMITS.bodyBytes} bytes`);
    let input: unknown;
    try {
      input = JSON.parse(text);
    } catch {
      return fail(400, 'bad_json', 'Body is not valid JSON');
    }
    const parsed = parseEnvelope(input);
    if (!parsed.ok) return fail(parsed.status, parsed.code, parsed.message);
    const stub = env.VISITOR.get(env.VISITOR.idFromName(visitor));
    const r = await stub.command(parsed.cmd, fault);
    return raw(r.status, r.text, r.replayed ? { 'Idempotent-Replay': 'true' } : {});
  },
} satisfies ExportedHandler<Env>;
