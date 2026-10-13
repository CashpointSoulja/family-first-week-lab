# Deploy (prepared, not deployed)

One Cloudflare Worker serves the static build (`dist/`) and the `/api/*` routes. Each visitor gets one **SQLite-backed Durable Object** (`VisitorLab`). Nothing else is used: no KV, D1, R2, Queues, vars, secrets or paid features. SQLite-backed Durable Objects are available on the Workers Free plan. Design and API: [BACKEND.md](BACKEND.md).

Config: [`wrangler.jsonc`](../wrangler.jsonc):
- `main = src/worker/index.ts`
- assets from `./dist` with `binding = ASSETS`, `not_found_handling = single-page-application` and `run_worker_first = ["/api/*"]`
- Durable Object binding `VISITOR` -> `VisitorLab`, with migration `v1` declaring `new_sqlite_classes: ["VisitorLab"]`
- `workers_dev = true`, preview URLs off

## Dry run (no account needed)
```bash
npm ci
npm run cf:dryrun   # = typecheck + vite build + wrangler deploy --dry-run --outdir .wrangler-dryrun
```
Expected bindings: `env.VISITOR (VisitorLab) Durable Object` and `env.ASSETS`. Results are in [TEST_RESULTS.md](TEST_RESULTS.md).

## Deploy (for the owner, when ready)
```bash
npx wrangler login
npx wrangler deploy
```
This gives `https://family-first-week-lab.<account-subdomain>.workers.dev`. The first deploy applies migration `v1`. Never add `FAULT_INJECTION` to the deployed config; it exists only for the local API tests, and a unit test fails if it appears in `wrangler.jsonc`.

## No GitHub Pages fallback for the backend
GitHub Pages can only host the static files. Without the Worker, the app shows its "Nothing to show" screen, because it never falls back to browser-only state. If Workers isn't available, the honest fallback is to say that the backend is not running, not to publish a static copy.
