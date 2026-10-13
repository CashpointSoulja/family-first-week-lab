import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';

export const PORT = 8798;
const STATE_DIR = '.wrangler/api-test-state';

/** Starts a real local Worker + SQLite Durable Object runtime. FAULT_INJECTION is only ever set here, for the failed-write tests. */
export default async function setup() {
  if (!existsSync('dist/index.html')) throw new Error('Run `npx vite build` first: the Worker serves dist/ as static assets.');
  rmSync(STATE_DIR, { recursive: true, force: true });
  const child: ChildProcess = spawn('npx', ['wrangler', 'dev', '--port', String(PORT), '--ip', '127.0.0.1', '--var', 'FAULT_INJECTION:1', '--persist-to', STATE_DIR, '--log-level', 'warn'], { detached: true, stdio: 'ignore' });
  const deadline = Date.now() + 60_000;
  for (;;) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/api/state`);
      if (r.status === 200) break;
    } catch {
      /* not up yet */
    }
    if (Date.now() > deadline) throw new Error('wrangler dev did not start');
    await new Promise((r) => setTimeout(r, 300));
  }
  return () => {
    try {
      process.kill(-child.pid!, 'SIGTERM');
    } catch {
      /* already gone */
    }
  };
}
