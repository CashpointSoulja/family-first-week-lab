import type { CommandType } from './server/commands';
import type { Derived, LabState } from './server/model';

export interface Snapshot { revision: number; state: LabState; derived: Derived }

export class ApiError extends Error {
  status: number;
  code: string;
  snapshot?: Snapshot;
  constructor(status: number, code: string, message: string, snapshot?: Snapshot) {
    super(message);
    this.status = status;
    this.code = code;
    this.snapshot = snapshot;
  }
}

async function parse(res: Response): Promise<Snapshot> {
  let body: Record<string, unknown> = {};
  try {
    body = await res.json();
  } catch {
    throw new ApiError(res.status, 'bad_response', 'The lab server sent an unreadable reply. Nothing is shown rather than guessing.');
  }
  if (!res.ok) {
    const snap = typeof body.revision === 'number' && body.state && body.derived ? (body as unknown as Snapshot) : undefined;
    throw new ApiError(res.status, String(body.error ?? 'error'), String(body.message ?? 'Request failed'), snap);
  }
  return body as unknown as Snapshot;
}

export async function loadState(): Promise<Snapshot> {
  return parse(await fetch('/api/state', { credentials: 'same-origin', cache: 'no-store' }));
}

/** One attempt plus one retry on network failure, with the same commandId so the server applies it at most once. */
export async function postCommand(type: CommandType, payload: Record<string, unknown>, expectedRevision: number): Promise<Snapshot> {
  const body = JSON.stringify({ commandId: crypto.randomUUID(), expectedRevision, type, payload });
  const once = () => fetch('/api/command', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body });
  let res: Response;
  try {
    res = await once();
  } catch {
    res = await once();
  }
  return parse(res);
}
