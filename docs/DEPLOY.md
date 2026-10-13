# Deploy (prepared, not deployed)

The site is static (`dist/`) and served by a **static-assets-only Cloudflare Worker**: no bindings, KV, D1, R2, Durable Objects or paid features, so it fits the Workers Free plan.

Config: [`wrangler.jsonc`](../wrangler.jsonc). It uses `assets.directory = ./dist`, `not_found_handling = single-page-application`, `workers_dev = true` and preview URLs off.

## Dry run (no account needed)
```bash
npm ci
npm run cf:dryrun   # = vite build + wrangler deploy --dry-run --outdir .wrangler-dryrun
```
Results are recorded in [TEST_RESULTS.md](TEST_RESULTS.md).

## Deploy (for the owner, when ready)
```bash
npx wrangler login
npx wrangler deploy
```
This gives `https://family-first-week-lab.<account-subdomain>.workers.dev`.

## Fallback: GitHub Pages
Only needed if Workers isn't available. The build uses relative hash routes and root-absolute asset paths, so for a project page build with `npx vite build --base=/family-first-week-lab/` and publish `dist/`. This hasn't been needed or tested yet.
