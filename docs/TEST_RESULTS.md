# Test results

Actual output from the `audit-fix/worker-backend` branch, run locally on 2026-10-13 (Node 24, Chromium from Playwright, `wrangler dev` with the real local workerd runtime and SQLite Durable Object storage). Absolute paths are shortened to `<repo>`. CI runs the same commands ([ci.yml](../.github/workflows/ci.yml)).

## Summary

| Check | Command | Result |
|---|---|---|
| Type check (browser, Worker, tests) | `npm run typecheck` | passed (no linter is configured) |
| Unit tests: engine and command reducer | `npm test` | 37 of 37 passed |
| Consent eval, real rules | `npm run eval` | 14 of 14 cases match expected |
| Consent eval, deliberately broken rule | `npm run eval:broken` | turned red as required: 2 of 14 cases fail (C1, C2) |
| API tests against a local Worker + SQLite Durable Object | `npm run test:api` | 37 of 37 passed |
| Browser tests against the same Worker | `npm run e2e` | 48 of 48 passed: 24 tests, each at 390 px and 1366 px |
| Cloudflare Workers Free dry run | `npm run cf:dryrun` | passed; bindings are `VISITOR` (Durable Object) and `ASSETS`. Not deployed |
| Publication audit | `npm run audit:publish` | passed: 130 tracked files and git history clean |

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
Playwright builds the app, then starts `wrangler dev` on port 4174 with fresh Durable Object storage. Each test uses a new browser context, and so a new visitor cookie and Durable Object.

When a test deliberately aborts or intercepts a request, the local workerd runtime logs `disconnected: write(): Broken pipe`. That is a server log line, not a test failure, so it is left out of the excerpt below.
```text
Running 48 tests using 2 workers
  ✓  1 [mobile-390] › flows.spec.ts:29:1 › 1 start: fictional household, relationship, goal, simulated-data explainer (661ms)
  ✓  2 [desktop-1366] › flows.spec.ts:29:1 › 1 start: fictional household, relationship, goal, simulated-data explainer (669ms)
  ✓  3 [mobile-390] › flows.spec.ts:42:1 › 2 consent: pending blocks data; no bypass via direct routes (721ms)
  ✓  4 [desktop-1366] › flows.spec.ts:42:1 › 2 consent: pending blocks data; no bypass via direct routes (831ms)
  ✓  5 [mobile-390] › flows.spec.ts:57:1 › 2 consent: accept needs a choice, granular sharing respected (1.1s)
  ✓  6 [desktop-1366] › flows.spec.ts:57:1 › 2 consent: accept needs a choice, granular sharing respected (1.1s)
  ✓  7 [mobile-390] › flows.spec.ts:72:1 › 2 consent: decline shares nothing; ask again returns to pending (916ms)
  ✓  8 [desktop-1366] › flows.spec.ts:72:1 › 2 consent: decline shares nothing; ask again returns to pending (921ms)
  ✓  9 [mobile-390] › flows.spec.ts:85:1 › 2 consent: revoke one area then everything; insights disappear (1.0s)
  ✓  10 [desktop-1366] › flows.spec.ts:85:1 › 2 consent: revoke one area then everything; insights disappear (1.0s)
  ✓  11 [mobile-390] › flows.spec.ts:104:1 › 3 setup: readiness counts only shared sensors; pairing simulated (1.4s)
  ✓  12 [desktop-1366] › flows.spec.ts:104:1 › 3 setup: readiness counts only shared sensors; pairing simulated (1.6s)
  ✓  13 [mobile-390] › flows.spec.ts:127:3 › 4 insight: stable -> ready (1.2s)
  ✓  14 [desktop-1366] › flows.spec.ts:127:3 › 4 insight: stable -> ready (1.2s)
  ✓  15 [mobile-390] › flows.spec.ts:127:3 › 4 insight: stale -> stale (1.1s)
  ✓  16 [desktop-1366] › flows.spec.ts:127:3 › 4 insight: stale -> stale (1.2s)
  ✓  17 [mobile-390] › flows.spec.ts:127:3 › 4 insight: gaps -> ready (1.2s)
  ✓  18 [desktop-1366] › flows.spec.ts:127:3 › 4 insight: gaps -> ready (1.2s)
  ✓  19 [mobile-390] › flows.spec.ts:127:3 › 4 insight: day0 -> tooEarly (1.2s)
  ✓  20 [desktop-1366] › flows.spec.ts:127:3 › 4 insight: day0 -> tooEarly (1.2s)
  ✓  21 [mobile-390] › flows.spec.ts:149:3 › 5 weekly: stable -> stable (1.4s)
  ✓  22 [desktop-1366] › flows.spec.ts:149:3 › 5 weekly: stable -> stable (1.5s)
  ✓  23 [mobile-390] › flows.spec.ts:149:3 › 5 weekly: changed -> changed (1.4s)
  ✓  24 [desktop-1366] › flows.spec.ts:149:3 › 5 weekly: changed -> changed (1.5s)
  ✓  25 [mobile-390] › flows.spec.ts:149:3 › 5 weekly: gaps -> insufficient (1.4s)
  ✓  26 [desktop-1366] › flows.spec.ts:149:3 › 5 weekly: gaps -> insufficient (1.5s)
  ✓  27 [mobile-390] › flows.spec.ts:149:3 › 5 weekly: stale -> forming (1.4s)
  ✓  28 [desktop-1366] › flows.spec.ts:149:3 › 5 weekly: stale -> forming (1.5s)
  ✓  29 [mobile-390] › flows.spec.ts:165:1 › 6 lab: synthetic labels, copy variant changes start screen, events recorded (776ms)
  ✓  31 [mobile-390] › flows.spec.ts:179:1 › keyboard: complete invite and consent with keyboard only (305ms)
  ✓  32 [mobile-390] › flows.spec.ts:199:1 › keyboard: skip link and visible focus ring (109ms)
  ✓  30 [desktop-1366] › flows.spec.ts:165:1 › 6 lab: synthetic labels, copy variant changes start screen, events recorded (980ms)
  ✓  34 [desktop-1366] › flows.spec.ts:179:1 › keyboard: complete invite and consent with keyboard only (297ms)
  ✓  33 [mobile-390] › flows.spec.ts:210:1 › responsive: no horizontal overflow on any screen (736ms)
  ✓  35 [desktop-1366] › flows.spec.ts:199:1 › keyboard: skip link and visible focus ring (131ms)
  ✓  36 [mobile-390] › flows.spec.ts:222:1 › brand guide page passes axe (471ms)
  ✓  37 [desktop-1366] › flows.spec.ts:210:1 › responsive: no horizontal overflow on any screen (709ms)
  ✓  38 [mobile-390] › flows.spec.ts:230:1 › backend: reload keeps the saved synthetic state (605ms)
  ✓  39 [desktop-1366] › flows.spec.ts:222:1 › brand guide page passes axe (466ms)
  ✓  41 [desktop-1366] › flows.spec.ts:230:1 › backend: reload keeps the saved synthetic state (707ms)
  ✓  40 [mobile-390] › flows.spec.ts:244:1 › backend: a second tab revoking consent is not overwritten by a stale first tab (1.0s)
  ✓  42 [desktop-1366] › flows.spec.ts:244:1 › backend: a second tab revoking consent is not overwritten by a stale first tab (918ms)
  ✓  43 [mobile-390] › flows.spec.ts:259:1 › backend: export follows current consent after a category revoke (849ms)
  ✓  45 [mobile-390] › flows.spec.ts:270:1 › backend: a failed write shows an error and changes nothing (289ms)
  ✓  44 [desktop-1366] › flows.spec.ts:259:1 › backend: export follows current consent after a category revoke (830ms)
  ✓  46 [mobile-390] › flows.spec.ts:282:1 › backend: if saved state cannot load, nothing is shown (551ms)
  ✓  47 [desktop-1366] › flows.spec.ts:270:1 › backend: a failed write shows an error and changes nothing (373ms)
  ✓  48 [desktop-1366] › flows.spec.ts:282:1 › backend: if saved state cannot load, nothing is shown (552ms)
  48 passed (25.2s)
```
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

That inspection caught one problem. While the server was down, the rail still showed placeholder household and consent values. It now says "Not loaded yet", and an e2e assertion covers it. The other screenshots are from the earlier build. Apart from the desktop rail's new "Server revision" line, those screens are unchanged. axe passes on every screen, including the offline one.

## Not tested
- Real screen readers (only axe and keyboard checks were automated).
- Real devices and browsers other than Chromium.
- A live Cloudflare deployment, which hasn't been done by design.
- Any real user. No usability sessions were run.
- Durable Objects on real Cloudflare infrastructure. Everything ran in the local workerd runtime via `wrangler dev`, and nothing was deployed.
- Load or abuse beyond the tested limits. There is no rate limiting, so a real deployment should add Cloudflare's free rate-limiting rules.
- Real identity. The role switch is a synthetic demo role, so these tests prove role rules, not who consented.
