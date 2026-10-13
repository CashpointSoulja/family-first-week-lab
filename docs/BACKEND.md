# Backend: Cloudflare Worker + SQLite Durable Object per visitor

The prototype keeps its synthetic scenario state on the server, not in the browser. Each visitor gets a private SQLite-backed Durable Object. The browser only renders the latest snapshot the server returns, and a reload shows the same saved state.

**This is not production consent security.** The family/invited-person switch is a synthetic demo role. Anyone using the prototype can switch roles, so it does not prove who gave consent. The server does enforce which *role* may make each consent choice, and that is what is tested. Real consent would need the invited person's own verified account, plus legal and safeguarding review. All data is synthetic. Nothing is Lilli data.

## Layout

| Path | What it does |
|---|---|
| `src/worker/index.ts` | Worker entry point. Handles `/api/*`: visitor cookie, same-origin check, body size and content-type checks. Holds the `VisitorLab` Durable Object class, which owns SQLite storage, revisions, idempotency, bounded logs and fail-closed handling. Everything else is served from `dist/` as static assets. |
| `src/server/commands.ts` | Strict command schema (`parseEnvelope`) and a pure reducer (`applyCommand`) that delegates consent transitions to `src/engine/consent.ts`. |
| `src/server/model.ts` | Stored state shape, limits, re-validation of stored state on every load (`isValidLabState`), and server-derived outputs (`derive`, `exportView`). |
| `src/api.ts` | Browser client: `GET /api/state` and `POST /api/command`. |
| `wrangler.jsonc` | Static assets plus one Durable Object binding (`VISITOR` -> `VisitorLab`) with a `new_sqlite_classes` migration. No vars, no secrets, no other bindings. |

## API

| Route | Method | Purpose |
|---|---|---|
| `/api/state` | GET | Snapshot: `{ revision, state, derived, limits }`. Issues a visitor cookie if there is none. |
| `/api/command` | POST | Applies one allowlisted command. Returns the new snapshot. |
| `/api/export` | GET | What a family member could take away. Covers currently shared areas only. |
| `/api/audit` | GET | The 50 newest audit rows and the retained count. |

Every API response has `Cache-Control: no-store`, `X-Content-Type-Options: nosniff` and a JSON body, errors included.

### Command envelope

```json
{ "commandId": "b6c1a3f0-…", "expectedRevision": 7, "type": "revoke", "payload": { "category": "drinks" } }
```

- **Exact keys only.** Any extra top-level or payload key is a `400`. That includes a whole `state` blob, `at`/`timestamp` fields and a caller-supplied `actor`. The server keeps its own simulated clock, and the actor is always the stored demo role.
- **Allowlisted `type`:** `selectHousehold`, `setRelationship`, `setGoal`, `confirmStart`, `setScenario`, `setVariant`, `switchActor`, `sendInvite`, `accept`, `decline`, `revoke`, `share`, `pairSensor`, `testSensor`, `setFrequency`, `feedback`, `checkIn`, `viewed`, `reset`.
- **Enumerated values:** households, relationships, goals, scenarios, categories, sensors, frequencies, copy variants, feedback answers and check-in channels must each be one of the fixture IDs. Category lists must be unique.
- `commandId` must be 8-64 characters from `[A-Za-z0-9_-]`. `expectedRevision` must be a non-negative integer.

### Status codes

| Code | Meaning | State changed? |
|---|---|---|
| 200 | Applied; new snapshot returned | Yes, revision +1 |
| 400 | Schema violation (`unknown_field`, `invalid_value`, `unknown_command`, `bad_json` …) | No, and not logged |
| 403 | `cross_origin` (Origin header is not this site, or there is no Origin and no `Sec-Fetch-Site: same-origin`) or `no_visitor` (write without a valid cookie) | No |
| 409 | `stale_revision` (latest snapshot attached) or `idempotency_conflict` (same commandId, different body) | No |
| 413 | Body over 2,048 bytes (declared or actual) | No |
| 415 | Content-Type is not `application/json` | No |
| 422 | `invalid_transition`: a consent rule or sensor rule refused it (for example, the family role trying to accept) | No; the rejection is logged |
| 503 | `storage_unavailable`: read or write failed, or stored state failed validation | No; the transaction rolled back |

## Rules enforced on the server

- **Consent.** Only the family role may invite. Only the invited-person role may accept, decline, share or revoke. Accept needs a pending invite and at least one area. Revoking an area that is not shared is refused. A full revoke, or revoking the last area, sets the status to `revoked`.
- **Sensors.** Pairing and testing are refused before consent, for sensors not needed by the shared areas, and from the wrong status (pair needs `notPaired`; test needs `waiting`).
- **Feedback and check-ins** are refused when nothing is shared.
- **Derived outputs follow current consent.** The first insight, coverage, weekly trends, coverage days and the export are recomputed from the stored state on every request. Unshared areas carry no timing, reading or trend. The export omits them entirely. Nothing derived is cached between revisions.

## Browser client: one command at a time

At real network latency a button drawn from the last snapshot can be out of date before the server answers. An earlier build let a second click go out against that old screen: after "Pair", a quick "Send test event" landed on the sensor that was already being tested, so setup stopped at 6 of 7. The client now works like this:

- A user command is single-flight. On click, the screen controls are paused before the request leaves: buttons get `aria-disabled="true"` and stay focusable, and form fields are disabled. A "… Buttons are paused until the lab server answers." status banner appears, and `main` gets `aria-busy="true"`. The banner sticks below the header, so it stays in view next to the control that was used.
- A click, tap or Enter on a paused control is dropped, not queued. Nothing is sent for it.
- When the server answers, the screen is redrawn from the returned snapshot and the controls come back. A rejected or failed command shows the server's message in a sticky alert, and the screen keeps the last saved state. A stale revision reloads the latest state and says the action was not applied.
- Page-view events run in the background and never pause the screen. Every request still goes through one queue and carries the newest revision the client has seen.
- After pairing, keyboard focus moves to that sensor's "Send test event" button.

The server still checks every command's revision and transition, so a stale or duplicate command that reached it would be refused anyway. The client change stops the user's click from being spent on that.

## Storage

The Durable Object has three SQLite tables:

| Table | Holds | Limit |
|---|---|---|
| `lab_state` | One row: `revision` and the JSON state | 1 row. Events are capped at 200, check-ins at 20, consent history at 100. |
| `command_log` | `commandId`, a body fingerprint, the status and the stored reply, for idempotent replay | Newest 200. Older commandIds can no longer be replayed and fall through to the revision check. |
| `audit_log` | commandId, type, demo role, outcome and revision before/after | Newest 500 |

A command's state write, command-log row, audit row and pruning all happen in one `transactionSync`. If anything throws, all of it rolls back and the client gets a `503`. Stored state is re-validated on every load. If it fails validation, that is also a `503`; it is never silently reset or repaired. The browser treats any failure as "nothing changed". If the first load fails, it shows a "Nothing to show" screen rather than default or stale readings.

Requests to one visitor's Durable Object are processed one at a time, and the SQL calls are synchronous. When several concurrent commands carry the same `expectedRevision`, exactly one wins and the others get `409`. The API tests check this.

## Visitor identity

`ffwl_vid` is 128 random bits from `crypto.getRandomValues`, hex-encoded. It is set `HttpOnly; SameSite=Strict; Path=/; Max-Age=30 days`, plus `Secure` over HTTPS. A cookie that doesn't match `^[a-f0-9]{32}$` is ignored and a new identity is issued. The Durable Object ID is `idFromName(visitorId)`. This separates synthetic sessions from each other; it is not authentication.

## Fault injection (tests only)

`tests/api/server.ts` starts `wrangler dev --var FAULT_INJECTION:1`. Only then does the Worker honour an `X-Lab-Fault: read|write` header, which makes storage throw inside the transaction. `wrangler.jsonc` declares no vars, and a unit test fails if `FAULT_INJECTION` ever appears there.

## Free plan fit

The only billable-type resources are Workers requests and SQLite-backed Durable Objects, and SQLite-backed Durable Objects are available on the Workers Free plan. No KV, D1, R2, Queues, secrets or paid features are used. Nothing has been deployed.
