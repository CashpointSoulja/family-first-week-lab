# Test plan

| Area | What is checked | Where |
|---|---|---|
| Consent engine | No family override for accept/decline/share/revoke; accept needs ≥1 category; decline/revoke share nothing; re-ask returns to pending; history records actors | `tests/unit/engine.test.ts` |
| First insight | noConsent, revoked, tooEarly, stale, insufficient, ready; missing ≠ fine; unshared never described; coverage and freshness | unit + `tests/e2e/flows.spec.ts` |
| Weekly | stable, changed (names areas), insufficient (data-gap wording), forming, locked | unit + e2e |
| Copy guardrails | No diagnosis/medical/prediction/false-reassurance phrases across all scenarios × sharing sets | unit + e2e page text |
| Events | Synthetic flag, forbidden properties rejected, catalogue covers metrics and guardrails | unit + e2e Lab table |
| Flows 1–6 | Every screen and state rendered in a real browser at 390 px and 1366 px | e2e (two projects) |
| Bypass | Direct navigation to Today/Week/Setup while pending shows locked states | e2e |
| Keyboard | Full invite → consent with keyboard only; skip link; visible focus ring; focus moves to the heading on route change | e2e |
| Contrast and a11y | axe-core WCAG 2.0/2.1/2.2 A+AA on every screen and state, including the brand guide | e2e |
| Responsive | No horizontal overflow on any route at 390 and 1366 | e2e |
| Visual | Screenshots of each screen at 390 and 1366, inspected by eye | `docs/screenshots/` |
| Backend: identity and isolation | Random HttpOnly SameSite=Strict cookie; visitors never see each other's state; malformed cookies are replaced | `tests/api` |
| Backend: hostile payloads | Whole-state blobs, caller timestamps or actors, unknown categories, scenarios, sensors and commands, oversize, wrong content type, cross-origin, missing cookie: all refused with state unchanged | `tests/api`, `tests/unit/commands.test.ts` |
| Backend: consent transitions | Role-restricted accept, decline, share, revoke and invite; invalid transitions are 422 | `tests/api`, `npm run eval` |
| Backend: revocation | Category and full revoke remove the area from the first insight, coverage, weekly trends and export | `tests/api`, eval C10 and C11, e2e |
| Backend: replay and concurrency | Same commandId replays without re-applying; different body conflicts; stale revision is 409; 5 concurrent writes on one revision give exactly one winner; a second tab can't overwrite | `tests/api`, e2e |
| Backend: fail-closed | Injected write and read faults return 503 and roll back; the UI shows an error or "Nothing to show" | `tests/api`, e2e |
| Backend: reset, reload and bounds | Reload keeps state; reset keeps revisions increasing; caps on events, audit rows and the replay window | `tests/api`, e2e |
| Eval sensitivity | A deliberately broken consent rule must turn the eval red | `npm run eval:broken` |
| Build and deploy | `tsc`, `vite build`, `wrangler deploy --dry-run` (no deploy) | npm scripts |
| Publication | No tool/agent bylines or machine paths in files, the built site or the git log | `npm run audit:publish` |

Results: [TEST_RESULTS.md](TEST_RESULTS.md).
