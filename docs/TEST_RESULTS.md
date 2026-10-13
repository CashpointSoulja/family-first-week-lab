# Test results

Actual output from the runs on 13 October 2026 (Ubuntu, Node 24, Chromium via Playwright), commit `build/first-week-lab`. Nothing here has been edited by hand beyond trimming.

## Summary
| Check | Command | Result |
|---|---|---|
| Type check | `npm run typecheck` | exit 0 |
| Unit (engine) | `npm test` | **28 / 28 passed** |
| Build | `npm run build` | exit 0 |
| Browser e2e + axe | `npx playwright test` | **38 / 38 passed** (19 tests × 2 viewports: 390×844 mobile, 1366×900 desktop) |
| Cloudflare Workers Free | `wrangler deploy --dry-run` | exit 0; static assets only, no bindings, **not deployed** |
| Publication audit | `npm run audit:publish` | see below |
| Lint | n/a | No linter is configured. `tsc` runs in strict mode with `noUnusedLocals` |

## Unit
```
 ✓ tests/unit/engine.test.ts (28 tests) 21ms
 Test Files  1 passed (1)
      Tests  28 passed (28)
   Start at  15:54:12
   Duration  348ms (transform 100ms, setup 0ms, collect 128ms, tests 21ms, environment 0ms, prepare 47ms)
exit 0
```

## Browser tests (e2e)
Each test also runs axe-core (WCAG 2.0/2.1/2.2 A and AA, contrast included) on the states it reaches and fails on any violation.

| Viewport | Test | Time |
|---|---|---|
| desktop-1366 | 1 start: fictional household, relationship, goal, simulated-data explainer | 1.3s |
| desktop-1366 | 2 consent: accept needs a choice, granular sharing respected | 1.4s |
| desktop-1366 | 2 consent: decline shares nothing; ask again returns to pending | 1.3s |
| desktop-1366 | 2 consent: pending blocks data; no bypass via direct routes | 1.2s |
| desktop-1366 | 2 consent: revoke one area then everything; insights disappear | 1.0s |
| desktop-1366 | 3 setup: readiness counts only shared sensors; pairing simulated | 2.2s |
| desktop-1366 | 4 insight: day0 -> tooEarly | 1.7s |
| desktop-1366 | 4 insight: gaps -> ready | 1.8s |
| desktop-1366 | 4 insight: stable -> ready | 1.7s |
| desktop-1366 | 4 insight: stale -> stale | 1.8s |
| desktop-1366 | 5 weekly: changed -> changed | 1.9s |
| desktop-1366 | 5 weekly: gaps -> insufficient | 1.9s |
| desktop-1366 | 5 weekly: stable -> stable | 1.6s |
| desktop-1366 | 5 weekly: stale -> forming | 2.0s |
| desktop-1366 | 6 lab: synthetic labels, copy variant changes start screen, events recorded | 1.6s |
| desktop-1366 | brand guide page passes axe | 746ms |
| desktop-1366 | keyboard: complete invite and consent with keyboard only | 199ms |
| desktop-1366 | keyboard: skip link and visible focus ring | 205ms |
| desktop-1366 | responsive: no horizontal overflow on any screen | 900ms |
| mobile-390 | 1 start: fictional household, relationship, goal, simulated-data explainer | 1.2s |
| mobile-390 | 2 consent: accept needs a choice, granular sharing respected | 1.3s |
| mobile-390 | 2 consent: decline shares nothing; ask again returns to pending | 1.2s |
| mobile-390 | 2 consent: pending blocks data; no bypass via direct routes | 1.0s |
| mobile-390 | 2 consent: revoke one area then everything; insights disappear | 1.1s |
| mobile-390 | 3 setup: readiness counts only shared sensors; pairing simulated | 2.0s |
| mobile-390 | 4 insight: day0 -> tooEarly | 1.6s |
| mobile-390 | 4 insight: gaps -> ready | 1.7s |
| mobile-390 | 4 insight: stable -> ready | 1.6s |
| mobile-390 | 4 insight: stale -> stale | 1.7s |
| mobile-390 | 5 weekly: changed -> changed | 1.9s |
| mobile-390 | 5 weekly: gaps -> insufficient | 1.9s |
| mobile-390 | 5 weekly: stable -> stable | 2.0s |
| mobile-390 | 5 weekly: stale -> forming | 1.8s |
| mobile-390 | 6 lab: synthetic labels, copy variant changes start screen, events recorded | 1.4s |
| mobile-390 | brand guide page passes axe | 869ms |
| mobile-390 | keyboard: complete invite and consent with keyboard only | 228ms |
| mobile-390 | keyboard: skip link and visible focus ring | 243ms |
| mobile-390 | responsive: no horizontal overflow on any screen | 874ms |

```
  38 passed (28.6s)
exit 0
```

## Coverage against the brief
| Requirement | Covered by |
|---|---|
| Every state: pending, no-choice, accepted, declined, re-invite, revoke-one, revoke-all, setup ready/not ready, too early, stale, insufficient, ready, weekly stable/changed/insufficient/forming/locked | unit + e2e tests above |
| Keyboard use | keyboard-only consent test, skip link and focus-ring test |
| Contrast | axe on every reached state (both viewports) and the brand guide |
| Responsiveness | overflow test on every route at 390 and 1366; screenshots in [screenshots/](screenshots/) |
| Missing/stale data | stale and gaps scenarios (unit + e2e); "missing is never fine" engine tests |
| Declined consent and revocation | decline/re-invite, category revoke, full revoke (unit + e2e) |

## Cloudflare dry run
```
--------------------
✨ Read 39 files from the assets directory <repo>/dist
Total Upload: 0.31 KiB / gzip: 0.22 KiB
No bindings found.
--dry-run: exiting now.
exit 0
```

## Visual inspection
I looked at the screenshots of every screen at 390 px and 1366 px ([screenshots/](screenshots/)), plus frames taken at caption times from a local rehearsal render of the walkthrough flow (not published). The only problem found earlier was low eyebrow contrast on blush/lemon bands. axe caught it, I fixed it, and it now passes.

## Not tested
- Real screen readers (only axe and keyboard checks were automated).
- Real devices and browsers other than Chromium.
- A live Cloudflare deployment, which hasn't been done by design.
- Any real user. No usability sessions were run.
