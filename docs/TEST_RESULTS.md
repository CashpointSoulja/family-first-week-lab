# Test results

> **Historical, pre-release.** This describes the state before publication. The current release record is [LIVE_RELEASE.md](LIVE_RELEASE.md), which supersedes the deployment and video claims here.

Actual output from the `audit-fix/worker-backend` branch, run locally on 2026-10-13 (Node 24, Chromium from Playwright, `wrangler dev` with the real local workerd runtime and SQLite Durable Object storage). Absolute paths are shortened to `<repo>`. CI runs the same commands ([ci.yml](../.github/workflows/ci.yml)).

## Summary

| Check | Command | Result |
|---|---|---|
| Type check (browser, Worker, tests) | `npm run typecheck` | passed (no linter is configured) |
| Unit tests: engine and command reducer | `npm test` | 37 of 37 passed |
| Consent eval, real rules | `npm run eval` | 14 of 14 cases match expected |
| Consent eval, deliberately broken rule | `npm run eval:broken` | turned red as required: 2 of 14 cases fail (C1, C2) |
| API tests against a local Worker + SQLite Durable Object | `npm run test:api` | 37 of 37 passed |
| Browser tests against the same Worker | `npm run e2e` | 84 of 84 passed: 28 tests in three projects (390 px, 1366 px, and 390 px with every `/api` call held 450 ms) |
| Cloudflare Workers Free dry run | `npm run cf:dryrun` | passed; bindings are `VISITOR` (Durable Object) and `ASSETS`. Not deployed |
| Publication audit | `npm run audit:publish` | passed: 134 tracked files and git history clean |

## What the backend tests prove

| Audit requirement | Where it is tested |
|---|---|
| Visitor isolation; random cookie identity | API, visitor identity and isolation: "issues a random HttpOnly SameSite=Strict cookie, different per visitor", "keeps each visitor in its own Durable Object", "replaces a malformed cookie with a new identity instead of trusting it", "refuses writes with no visitor cookie" |
| Strict size and schema checks; no whole-state blob | API: "rejects bodies over 2048 bytes, non-JSON content types and broken JSON"; 17 hostile-payload cases (array body, whole-state blob, state as a command, caller timestamp, caller actor, unknown category, unknown scenario, duplicate categories, prototype key, bad command id, negative revision, string revision, payload array, missing field, unknown sensor status, free-text check-in, inherited command name), each returning 400 with state unchanged. Unit: `commands.test.ts` |
| Same-origin writes | API: "rejects cross-origin and origin-less writes" |
| Server-side consent transitions | API: "only the monitored demo role can accept, decline, share or revoke; only family can invite", "rejects revoking an unshared area and impossible sensor changes", "decline shares nothing and a re-invite returns to pending". Eval: C1-C14 |
| Revocation reaches insight, weekly, coverage and export | API: "category revoke, then full revoke, with no stale disclosure". Eval: C10, C11. e2e: "export follows current consent after a category revoke" |
| Revision checks; concurrent consent changes | API: "a stale revision is refused with the latest snapshot and changes nothing"; "concurrent consent changes on one revision: exactly one wins" (five commands, mixing category revoke, full revoke, share and a role switch, sent at once on one revision: one 200, four 409s, revision +1). e2e: "a second tab revoking consent is not overwritten by a stale first tab" |
| Idempotent replay | API: "replaying the same command returns the stored reply without applying twice", "a reused commandId with a different body is a conflict", "a replayed rejection stays rejected" |
| Fail-closed storage | API: "a failed write rolls back state, command log and audit, and reports 503", "a failed read shows nothing rather than a default state". e2e: "a failed write shows an error and changes nothing", "if saved state cannot load, nothing is shown" |
| Reset and reload | API: "reload returns the same saved state; reset starts over without reusing revisions". e2e: "reload keeps the saved synthetic state" |
| Bounded history | API: "caps events, audit rows and the replay window" (521 events sent, 200 kept; 500 audit rows kept) |
| Commands at real network latency: no stale clicks, pending and error feedback | e2e project `mobile-390-latency` runs the whole suite with 450 ms on every `/api` call. e2e: "the audit click sequence completes with 800 ms per command", "clicks on paused controls are dropped, not sent against stale state", "a slow failed command shows the error, unpauses, and changes nothing", "keyboard user keeps focus while pending and lands on the next step" |
| Eval turns red with a broken rule | `npm run eval:broken` exits 0 only if at least one case is red |

## Type check
```text
> family-first-week-lab@0.1.0 typecheck
> tsc --noEmit && tsc -p tsconfig.worker.json && tsc -p tsconfig.node.json
```

## Unit tests
```text
 ✓ tests/unit/engine.test.ts > consent: no bypass > starts with nothing shared
 ✓ tests/unit/engine.test.ts > consent: no bypass > pending invitation shares nothing
 ✓ tests/unit/engine.test.ts > consent: no bypass > family member cannot accept, decline or revoke on their behalf
 ✓ tests/unit/engine.test.ts > consent: no bypass > monitored person cannot send an invite to themselves
 ✓ tests/unit/engine.test.ts > consent: no bypass > cannot accept without an invitation, or with nothing chosen
 ✓ tests/unit/engine.test.ts > consent: no bypass > accepts granular categories only
 ✓ tests/unit/engine.test.ts > consent: no bypass > decline shares nothing and can only be re-asked, not overridden
 ✓ tests/unit/engine.test.ts > consent: no bypass > cannot send a second invite while one is pending or accepted
 ✓ tests/unit/engine.test.ts > consent: no bypass > revoking one category removes it; revoking the last turns sharing off
 ✓ tests/unit/engine.test.ts > consent: no bypass > revoke all, then history records who did what
 ✓ tests/unit/engine.test.ts > first useful insight > no consent: nothing shown
 ✓ tests/unit/engine.test.ts > first useful insight > revoked: nothing shown
 ✓ tests/unit/engine.test.ts > first useful insight > day 0: too early, even though some sensors report
 ✓ tests/unit/engine.test.ts > first useful insight > stable: ready with full coverage and freshness
 ✓ tests/unit/engine.test.ts > first useful insight > stale hub: never reassures
 ✓ tests/unit/engine.test.ts > first useful insight > patchy coverage: missing shown as missing, not fine
 ✓ tests/unit/engine.test.ts > first useful insight > insufficient when most shared sensors are missing
 ✓ tests/unit/engine.test.ts > first useful insight > unshared categories are never described
 ✓ tests/unit/engine.test.ts > weekly summary > stable pattern
 ✓ tests/unit/engine.test.ts > weekly summary > changed pattern names the areas that differ
 ✓ tests/unit/engine.test.ts > weekly summary > insufficient coverage is a data gap, not stable
 ✓ tests/unit/engine.test.ts > weekly summary > baseline forming before 7 days
 ✓ tests/unit/engine.test.ts > weekly summary > locked without consent or after revoke
 ✓ tests/unit/engine.test.ts > copy guardrails > no diagnosis, medical advice, prediction or false reassurance in any generated text
 ✓ tests/unit/engine.test.ts > copy guardrails > guard catches banned phrases
 ✓ tests/unit/engine.test.ts > events > marks every event synthetic and rejects identifying props
 ✓ tests/unit/engine.test.ts > events > catalogue covers the four metrics and the safety guardrails
 ✓ tests/unit/engine.test.ts > events > synthetic funnel is monotonic and states a denominator per step
 ✓ tests/unit/commands.test.ts > command schema > allowlists commands and rejects anything else
 ✓ tests/unit/commands.test.ts > command schema > rejects unknown keys at the top level and in payloads
 ✓ tests/unit/commands.test.ts > command schema > rejects unknown categories, scenarios, sensors and enum values
 ✓ tests/unit/commands.test.ts > applyCommand > is pure: the previous state is never mutated
 ✓ tests/unit/commands.test.ts > applyCommand > uses the stored demo role as the actor
 ✓ tests/unit/commands.test.ts > applyCommand > produces states that pass storage validation and caps history
 ✓ tests/unit/commands.test.ts > derived outputs follow current consent > unshared areas carry no timing or trend, in the snapshot or the export
 ✓ tests/unit/commands.test.ts > stored state validation > rejects tampered or unknown values
 ✓ tests/unit/commands.test.ts > deploy config > never enables fault injection and declares a SQLite Durable Object
 Test Files  2 passed (2)
      Tests  37 passed (37)
```

## Consent eval: real rules
Consent eval, rules = real

| Case | Rule | Expected | Actual | Result |
|---|---|---|---|---|
| C1 | Family role cannot accept on the invited person's behalf | rejected | rejected | PASS |
| C2 | Pending invite discloses nothing, even after a family accept attempt | rejected; readings=0 trends=0 | rejected; readings=0 trends=0 | PASS |
| C3 | Invited person can accept a subset | applied; readings=2 trends=2 | applied; readings=2 trends=2 | PASS |
| C4 | Accept needs at least one area | rejected | rejected | PASS |
| C5 | Cannot accept without a pending invite | rejected | rejected | PASS |
| C6 | Family role cannot decline for them | rejected | rejected | PASS |
| C7 | Invited person can decline; nothing disclosed | applied; readings=0 trends=0 | applied; readings=0 trends=0 | PASS |
| C8 | Invited person cannot send the family invite | rejected | rejected | PASS |
| C9 | Family role cannot revoke or re-share | rejected | rejected | PASS |
| C10 | Category revoke removes it from the export | applied; drinks=false | applied; drinks=false | PASS |
| C11 | Full revoke discloses nothing | applied; readings=0 trends=0 | applied; readings=0 trends=0 | PASS |
| C12 | Cannot revoke an area that is not shared | rejected | rejected | PASS |
| C13 | Re-invite after decline goes back to pending, still nothing shared | applied; pending readings=0 trends=0 | applied; pending readings=0 trends=0 | PASS |
| C14 | Sensors stay paused before consent | rejected | rejected | PASS |

14/14 cases match.

## Consent eval: deliberately broken rule
The broken rule ignores the stored demo role when accepting, so the family role can say yes on the invited person's behalf.

Consent eval, rules = broken (family role may accept on their behalf)

| Case | Rule | Expected | Actual | Result |
|---|---|---|---|---|
| C1 | Family role cannot accept on the invited person's behalf | rejected | applied | FAIL |
| C2 | Pending invite discloses nothing, even after a family accept attempt | rejected; readings=0 trends=0 | applied; readings=6 trends=6 | FAIL |
| C3 | Invited person can accept a subset | applied; readings=2 trends=2 | applied; readings=2 trends=2 | PASS |
| C4 | Accept needs at least one area | rejected | rejected | PASS |
| C5 | Cannot accept without a pending invite | rejected | rejected | PASS |
| C6 | Family role cannot decline for them | rejected | rejected | PASS |
| C7 | Invited person can decline; nothing disclosed | applied; readings=0 trends=0 | applied; readings=0 trends=0 | PASS |
| C8 | Invited person cannot send the family invite | rejected | rejected | PASS |
| C9 | Family role cannot revoke or re-share | rejected | rejected | PASS |
| C10 | Category revoke removes it from the export | applied; drinks=false | applied; drinks=false | PASS |
| C11 | Full revoke discloses nothing | applied; readings=0 trends=0 | applied; readings=0 trends=0 | PASS |
| C12 | Cannot revoke an area that is not shared | rejected | rejected | PASS |
| C13 | Re-invite after decline goes back to pending, still nothing shared | applied; pending readings=0 trends=0 | applied; pending readings=0 trends=0 | PASS |
| C14 | Sensors stay paused before consent | rejected | rejected | PASS |

12/14 cases match.
RED CHECK PASSED: the broken rule turned 2 case(s) red (C1, C2).

## API tests
`tests/api/server.ts` starts its own `wrangler dev` on port 8798 with a fresh `.wrangler/api-test-state` and `FAULT_INJECTION=1`. Faults are only honoured in this mode.
```text
 ✓ tests/api/api.test.ts > visitor identity and isolation > issues a random HttpOnly SameSite=Strict cookie, different per visitor
 ✓ tests/api/api.test.ts > visitor identity and isolation > keeps each visitor in its own Durable Object
 ✓ tests/api/api.test.ts > visitor identity and isolation > replaces a malformed cookie with a new identity instead of trusting it
 ✓ tests/api/api.test.ts > visitor identity and isolation > refuses writes with no visitor cookie
 ✓ tests/api/api.test.ts > edge checks: origin, size, content type, routes > rejects cross-origin and origin-less writes
 ✓ tests/api/api.test.ts > edge checks: origin, size, content type, routes > rejects bodies over 2048 bytes, non-JSON content types and broken JSON
 ✓ tests/api/api.test.ts > edge checks: origin, size, content type, routes > answers unknown routes and wrong methods with JSON errors, never cached
 ✓ tests/api/api.test.ts > hostile payloads never change state > array body -> 400
 ✓ tests/api/api.test.ts > hostile payloads never change state > whole-state blob -> 400
 ✓ tests/api/api.test.ts > hostile payloads never change state > state as a command -> 400
 ✓ tests/api/api.test.ts > hostile payloads never change state > caller timestamp -> 400
 ✓ tests/api/api.test.ts > hostile payloads never change state > caller actor -> 400
 ✓ tests/api/api.test.ts > hostile payloads never change state > unknown category -> 400
 ✓ tests/api/api.test.ts > hostile payloads never change state > unknown scenario -> 400
 ✓ tests/api/api.test.ts > hostile payloads never change state > duplicate categories -> 400
 ✓ tests/api/api.test.ts > hostile payloads never change state > prototype key -> 400
 ✓ tests/api/api.test.ts > hostile payloads never change state > bad command id -> 400
 ✓ tests/api/api.test.ts > hostile payloads never change state > negative revision -> 400
 ✓ tests/api/api.test.ts > hostile payloads never change state > string revision -> 400
 ✓ tests/api/api.test.ts > hostile payloads never change state > payload array -> 400
 ✓ tests/api/api.test.ts > hostile payloads never change state > missing field -> 400
 ✓ tests/api/api.test.ts > hostile payloads never change state > unknown sensor status -> 400
 ✓ tests/api/api.test.ts > hostile payloads never change state > free-text check-in -> 400
 ✓ tests/api/api.test.ts > hostile payloads never change state > inherited command name -> 400
 ✓ tests/api/api.test.ts > server-side consent transitions > only the monitored demo role can accept, decline, share or revoke; only family can invite
 ✓ tests/api/api.test.ts > server-side consent transitions > rejects revoking an unshared area and impossible sensor changes
 ✓ tests/api/api.test.ts > server-side consent transitions > decline shares nothing and a re-invite returns to pending
 ✓ tests/api/api.test.ts > revocation removes access from every derived output and the export > category revoke, then full revoke, with no stale disclosure
 ✓ tests/api/api.test.ts > revisions, replay and concurrency > a stale revision is refused with the latest snapshot and changes nothing
 ✓ tests/api/api.test.ts > revisions, replay and concurrency > replaying the same command returns the stored reply without applying twice
 ✓ tests/api/api.test.ts > revisions, replay and concurrency > a reused commandId with a different body is a conflict
 ✓ tests/api/api.test.ts > revisions, replay and concurrency > a replayed rejection stays rejected
 ✓ tests/api/api.test.ts > revisions, replay and concurrency > concurrent consent changes on one revision: exactly one wins
 ✓ tests/api/api.test.ts > fail-closed storage > a failed write rolls back state, command log and audit, and reports 503
 ✓ tests/api/api.test.ts > fail-closed storage > a failed read shows nothing rather than a default state
 ✓ tests/api/api.test.ts > reset, reload and bounded history > reload returns the same saved state; reset starts over without reusing revisions
 ✓ tests/api/api.test.ts > reset, reload and bounded history > caps events, audit rows and the replay window 3670ms
 Test Files  1 passed (1)
      Tests  37 passed (37)
```

## Browser tests (e2e)
Playwright builds the app, then starts `wrangler dev` on port 4174 with fresh Durable Object storage. Each test uses a new browser context, and so a new visitor cookie and Durable Object. The `mobile-390-latency` project runs the same tests with every `/api` request held for 450 ms before it reaches the Worker, so clicks land while a command is still pending.

When a test deliberately aborts or intercepts a request, the local workerd runtime logs `disconnected: write(): Broken pipe`. That is a server log line, not a test failure, so it is left out of the excerpt below.
```text
Running 84 tests using 3 workers
  ✓  2 [mobile-390] › flows.spec.ts:43:1 › 1 start: fictional household, relationship, goal, simulated-data explainer (754ms)
  ✓  3 [desktop-1366] › flows.spec.ts:43:1 › 1 start: fictional household, relationship, goal, simulated-data explainer (757ms)
  ✓  4 [mobile-390] › flows.spec.ts:56:1 › 2 consent: pending blocks data; no bypass via direct routes (634ms)
  ✓  5 [desktop-1366] › flows.spec.ts:56:1 › 2 consent: pending blocks data; no bypass via direct routes (838ms)
  ✓  1 [mobile-390-latency] › flows.spec.ts:43:1 › 1 start: fictional household, relationship, goal, simulated-data explainer (2.2s)
  ✓  6 [mobile-390] › flows.spec.ts:71:1 › 2 consent: accept needs a choice, granular sharing respected (1.2s)
  ✓  7 [desktop-1366] › flows.spec.ts:71:1 › 2 consent: accept needs a choice, granular sharing respected (1.3s)
  ✓  9 [mobile-390] › flows.spec.ts:86:1 › 2 consent: decline shares nothing; ask again returns to pending (1.0s)
  ✓  10 [desktop-1366] › flows.spec.ts:86:1 › 2 consent: decline shares nothing; ask again returns to pending (1.1s)
  ✓  11 [mobile-390] › flows.spec.ts:99:1 › 2 consent: revoke one area then everything; insights disappear (1.1s)
  ✓  12 [desktop-1366] › flows.spec.ts:99:1 › 2 consent: revoke one area then everything; insights disappear (1.2s)
  ✓  8 [mobile-390-latency] › flows.spec.ts:56:1 › 2 consent: pending blocks data; no bypass via direct routes (3.0s)
  ✓  13 [mobile-390] › flows.spec.ts:118:1 › 3 setup: readiness counts only shared sensors; pairing simulated (1.9s)
  ✓  14 [desktop-1366] › flows.spec.ts:118:1 › 3 setup: readiness counts only shared sensors; pairing simulated (1.9s)
  ✓  16 [mobile-390] › flows.spec.ts:148:3 › 4 insight: stable -> ready (1.5s)
  ✓  17 [desktop-1366] › flows.spec.ts:148:3 › 4 insight: stable -> ready (1.5s)
  ✓  18 [mobile-390] › flows.spec.ts:148:3 › 4 insight: stale -> stale (1.5s)
  ✓  19 [desktop-1366] › flows.spec.ts:148:3 › 4 insight: stale -> stale (1.4s)
  ✓  15 [mobile-390-latency] › flows.spec.ts:71:1 › 2 consent: accept needs a choice, granular sharing respected (5.8s)
  ✓  20 [mobile-390] › flows.spec.ts:148:3 › 4 insight: gaps -> ready (1.4s)
  ✓  21 [desktop-1366] › flows.spec.ts:148:3 › 4 insight: gaps -> ready (1.5s)
  ✓  23 [mobile-390] › flows.spec.ts:148:3 › 4 insight: day0 -> tooEarly (1.4s)
  ✓  24 [desktop-1366] › flows.spec.ts:148:3 › 4 insight: day0 -> tooEarly (1.6s)
  ✓  25 [mobile-390] › flows.spec.ts:170:3 › 5 weekly: stable -> stable (1.6s)
  ✓  26 [desktop-1366] › flows.spec.ts:170:3 › 5 weekly: stable -> stable (1.6s)
  ✓  27 [mobile-390] › flows.spec.ts:170:3 › 5 weekly: changed -> changed (1.6s)
  ✓  28 [desktop-1366] › flows.spec.ts:170:3 › 5 weekly: changed -> changed (1.6s)
  ✓  29 [mobile-390] › flows.spec.ts:170:3 › 5 weekly: gaps -> insufficient (1.6s)
  ✓  22 [mobile-390-latency] › flows.spec.ts:86:1 › 2 consent: decline shares nothing; ask again returns to pending (6.5s)
  ✓  30 [desktop-1366] › flows.spec.ts:170:3 › 5 weekly: gaps -> insufficient (1.7s)
  ✓  31 [mobile-390] › flows.spec.ts:170:3 › 5 weekly: stale -> forming (1.6s)
  ✓  33 [desktop-1366] › flows.spec.ts:170:3 › 5 weekly: stale -> forming (1.7s)
  ✓  34 [mobile-390] › flows.spec.ts:186:1 › 6 lab: synthetic labels, copy variant changes start screen, events recorded (909ms)
  ✓  36 [mobile-390] › flows.spec.ts:200:1 › keyboard: complete invite and consent with keyboard only (429ms)
  ✓  37 [mobile-390] › flows.spec.ts:220:1 › keyboard: skip link and visible focus ring (140ms)
  ✓  35 [desktop-1366] › flows.spec.ts:186:1 › 6 lab: synthetic labels, copy variant changes start screen, events recorded (1.1s)
  ✓  38 [mobile-390] › flows.spec.ts:231:1 › responsive: no horizontal overflow on any screen (840ms)
  ✓  39 [desktop-1366] › flows.spec.ts:200:1 › keyboard: complete invite and consent with keyboard only (387ms)
  ✓  41 [desktop-1366] › flows.spec.ts:220:1 › keyboard: skip link and visible focus ring (145ms)
  ✓  40 [mobile-390] › flows.spec.ts:243:1 › brand guide page passes axe (565ms)
  ✓  42 [desktop-1366] › flows.spec.ts:231:1 › responsive: no horizontal overflow on any screen (967ms)
  ✓  43 [mobile-390] › flows.spec.ts:251:1 › backend: reload keeps the saved synthetic state (647ms)
  ✓  44 [desktop-1366] › flows.spec.ts:243:1 › brand guide page passes axe (543ms)
  ✓  45 [mobile-390] › flows.spec.ts:265:1 › backend: a second tab revoking consent is not overwritten by a stale first tab (1.1s)
  ✓  46 [desktop-1366] › flows.spec.ts:251:1 › backend: reload keeps the saved synthetic state (684ms)
  ✓  47 [mobile-390] › flows.spec.ts:280:1 › backend: export follows current consent after a category revoke (1.0s)
  ✓  48 [desktop-1366] › flows.spec.ts:265:1 › backend: a second tab revoking consent is not overwritten by a stale first tab (1.2s)
  ✓  49 [mobile-390] › flows.spec.ts:291:1 › backend: a failed write shows an error and changes nothing (301ms)
  ✓  51 [mobile-390] › flows.spec.ts:303:1 › backend: if saved state cannot load, nothing is shown (553ms)
  ✓  50 [desktop-1366] › flows.spec.ts:280:1 › backend: export follows current consent after a category revoke (1.0s)
  ✓  53 [desktop-1366] › flows.spec.ts:291:1 › backend: a failed write shows an error and changes nothing (473ms)
  ✓  32 [mobile-390-latency] › flows.spec.ts:99:1 › 2 consent: revoke one area then everything; insights disappear (9.3s)
  ✓  54 [desktop-1366] › flows.spec.ts:303:1 › backend: if saved state cannot load, nothing is shown (560ms)
  ✓  52 [mobile-390] › flows.spec.ts:344:1 › latency: the audit click sequence completes with 800 ms per command (3.7s)
  ✓  56 [desktop-1366] › flows.spec.ts:344:1 › latency: the audit click sequence completes with 800 ms per command (3.7s)
  ✓  57 [mobile-390] › flows.spec.ts:356:1 › latency: clicks on paused controls are dropped, not sent against stale state (1.7s)
  ✓  58 [desktop-1366] › flows.spec.ts:356:1 › latency: clicks on paused controls are dropped, not sent against stale state (1.7s)
  ✓  59 [mobile-390] › flows.spec.ts:383:1 › latency: a slow failed command shows the error, unpauses, and changes nothing (1.7s)
  ✓  61 [mobile-390] › flows.spec.ts:404:1 › latency: keyboard user keeps focus while pending and lands on the next step (1.2s)
  ✓  60 [desktop-1366] › flows.spec.ts:383:1 › latency: a slow failed command shows the error, unpauses, and changes nothing (1.5s)
  ✓  62 [desktop-1366] › flows.spec.ts:404:1 › latency: keyboard user keeps focus while pending and lands on the next step (1.2s)
  ✓  55 [mobile-390-latency] › flows.spec.ts:118:1 › 3 setup: readiness counts only shared sensors; pairing simulated (9.2s)
  ✓  63 [mobile-390-latency] › flows.spec.ts:148:3 › 4 insight: stable -> ready (6.5s)
  ✓  64 [mobile-390-latency] › flows.spec.ts:148:3 › 4 insight: stale -> stale (6.5s)
  ✓  65 [mobile-390-latency] › flows.spec.ts:148:3 › 4 insight: gaps -> ready (6.5s)
  ✓  66 [mobile-390-latency] › flows.spec.ts:148:3 › 4 insight: day0 -> tooEarly (6.6s)
  ✓  67 [mobile-390-latency] › flows.spec.ts:170:3 › 5 weekly: stable -> stable (8.9s)
  ✓  68 [mobile-390-latency] › flows.spec.ts:170:3 › 5 weekly: changed -> changed (8.9s)
  ✓  69 [mobile-390-latency] › flows.spec.ts:170:3 › 5 weekly: gaps -> insufficient (8.9s)
  ✓  70 [mobile-390-latency] › flows.spec.ts:170:3 › 5 weekly: stale -> forming (8.9s)
  ✓  71 [mobile-390-latency] › flows.spec.ts:186:1 › 6 lab: synthetic labels, copy variant changes start screen, events recorded (4.0s)
  ✓  72 [mobile-390-latency] › flows.spec.ts:200:1 › keyboard: complete invite and consent with keyboard only (4.2s)
  ✓  73 [mobile-390-latency] › flows.spec.ts:220:1 › keyboard: skip link and visible focus ring (875ms)
  ✓  74 [mobile-390-latency] › flows.spec.ts:231:1 › responsive: no horizontal overflow on any screen (4.7s)
  ✓  75 [mobile-390-latency] › flows.spec.ts:243:1 › brand guide page passes axe (530ms)
  ✓  76 [mobile-390-latency] › flows.spec.ts:251:1 › backend: reload keeps the saved synthetic state (6.0s)
  ✓  77 [mobile-390-latency] › flows.spec.ts:265:1 › backend: a second tab revoking consent is not overwritten by a stale first tab (5.8s)
  ✓  78 [mobile-390-latency] › flows.spec.ts:280:1 › backend: export follows current consent after a category revoke (6.3s)
  ✓  79 [mobile-390-latency] › flows.spec.ts:291:1 › backend: a failed write shows an error and changes nothing (3.4s)
  ✓  80 [mobile-390-latency] › flows.spec.ts:303:1 › backend: if saved state cannot load, nothing is shown (1.3s)
  ✓  81 [mobile-390-latency] › flows.spec.ts:344:1 › latency: the audit click sequence completes with 800 ms per command (11.8s)
  ✓  82 [mobile-390-latency] › flows.spec.ts:356:1 › latency: clicks on paused controls are dropped, not sent against stale state (7.5s)
  ✓  83 [mobile-390-latency] › flows.spec.ts:383:1 › latency: a slow failed command shows the error, unpauses, and changes nothing (7.4s)
  ✓  84 [mobile-390-latency] › flows.spec.ts:404:1 › latency: keyboard user keeps focus while pending and lands on the next step (7.8s)
  84 passed (2.9m)
```

### Latency regression: reproduced, then fixed
The setup step failed on the live deployment after "Pair", then two quick "Send test event" clicks. Locally it passed because `wrangler dev` answers in a few milliseconds.

The cause: a command did not pause the screen while it waited. The second "Send test event" click hit the old screen, where the first visible button was still the sensor being tested. That sent a second test for the same sensor, which the server refused, and the newly paired sensor was never tested. Setup stopped at 6 of 7.

Reproduced on the previous client (`src/main.ts` from `3304e6b`) with injected latency. The new 800 ms audit-sequence test, which keeps the original three back-to-back clicks, failed at 390 px with and without the 450 ms project latency. Two more failures in that run came from the updated setup test, which reads a `data-sensor-status` attribute the old client lacks. They are not counted as reproductions:
```text
    Error: Timed out 5000ms waiting for expect(locator).toBeVisible()
    > 350 |   await expect(page.getByRole('heading', { name: '7 of 7 needed sensors reporting' })).toBeVisible();
  4 failed
```
Before any client change, the original setup test (unchanged) also failed under the 450 ms project at the same assertion: `7 of 7 needed sensors reporting`, element not found.

The fix is in the client, not in test timeouts. Details are in [BACKEND.md](BACKEND.md#browser-client-one-command-at-a-time). Expected outcomes are unchanged, and no timeout was raised. The tests now wait for observable server-confirmed state between steps: the pending banner is gone and the sensor row's `data-sensor-status` has changed. Helpers do the same after invite, accept and scenario changes. The 800 ms test keeps the original three back-to-back clicks. It passes because paused buttons are `aria-disabled`, so Playwright, like a person, can't use them until the server has answered. The "dropped" test proves the user-side behaviour. While a pair command is held, the stale "Send test event" button is hit three ways: a real mouse click at its coordinates, a forced click, and Enter. Exactly one command (`pairSensor`) reaches the server, and that sensor stays `waiting`.

## Cloudflare dry run
```text
⛅️ wrangler 4.150.0
────────────────────
✨ Read 39 files from the assets directory <repo>/dist
Total Upload: 46.00 KiB / gzip: 13.79 KiB
Your Worker has access to the following bindings:
Binding                       Resource            
env.VISITOR (VisitorLab)      Durable Object      
env.ASSETS                    Assets              

--dry-run: exiting now.
```

## Visual inspection
I inspected rendered screenshots of the changed screens at 390 px and 1366 px, and replaced them in [screenshots/](screenshots/):
- `3pending`: the pending invite with the demo-role note
- `8week`: the weekly summary with the export link and the desktop rail's "Server revision" line
- `10offline`: the "Nothing to show" screen when saved state can't load

For the latency fix I also inspected the setup screen while a pair command was held, and after a slow failed test event, at both widths: `6setup-pending` and `6setup-error`. The banners stay in view below the sticky header, beside the control that was used. The first capture showed the pending banner scrolled off the top of the page on mobile, so it is now sticky. axe passes in both states.

The earlier backend inspection caught one problem. While the server was down, the rail still showed placeholder household and consent values. It now says "Not loaded yet", and an e2e assertion covers it. The other screenshots are from the earlier build. Apart from the desktop rail's new "Server revision" line, those screens are unchanged. axe passes on every screen, including the offline one.

## Not tested
- Real screen readers (only axe and keyboard checks were automated).
- Real devices and browsers other than Chromium.
- A live Cloudflare deployment, which hasn't been done by design.
- Any real user. No usability sessions were run.
- Durable Objects on real Cloudflare infrastructure. Everything ran in the local workerd runtime via `wrangler dev`, and nothing was deployed.
- Load or abuse beyond the tested limits. There is no rate limiting, so a real deployment should add Cloudflare's free rate-limiting rules.
- Real network conditions other than a fixed injected delay: no packet loss, reordering or very slow (multi-second) links. The client retries once on a network error, with the same command id.
- The fix against the live deployment. It has not been redeployed, by design.
- Real identity. The role switch is a synthetic demo role, so these tests prove role rules, not who consented.
