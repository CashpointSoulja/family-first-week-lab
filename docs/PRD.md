# PRD: Family First-Week Lab

*Independent concept by Ayo Ahmed. Not affiliated with, endorsed by or built for Intelligent Lilli. No internal data, research or systems were used. Every number in the prototype is synthetic.*

## Problem
Lilli's public homepage invites families to a waiting list for a direct-to-family product ("We're working hard behind the scenes to make Lilli available directly to families"). I can't try that product, so I don't know how its onboarding performs. What I can reason about is the shape of the first week for any family buying home sensors for someone they love:

1. The person being monitored has to agree, and the family member usually starts the purchase. That is a trust problem before it is a funnel problem.
2. Setup is physical work (a hub and six sensors; Lilli's page says about 30 minutes on average) that has to happen before the product can show any value.
3. The first data is thin. A product that sounds confident on day one risks false reassurance or false alarm, and either can damage trust for good.

## Goal
Get a family from "bought it" to a **first useful insight** they understand and trust, without bypassing the monitored person's consent and without overstating what the data means.

## Users
- **Family member** (buyer, usually remote): wants reassurance and fewer worried calls, or to notice changes, or to coordinate with siblings.
- **Monitored person** (the user with rights): decides what is shared and can change their mind.
- Out of scope: people who can't consent for themselves (needs a separate legal and safeguarding design), professional carers and councils.

## Scope (prototype)
| # | Flow | Must |
|---|---|---|
| 1 | Choose household | Fictional households, relationship, goal; explain what's simulated |
| 2 | Consent | Invite → pending → monitored person accepts per category or declines; revoke per category or all; no family override |
| 3 | Setup | Checklist of hub + sensors needed for shared areas; ready/waiting/not paired/offline/low battery; missing ≠ fine |
| 4 | First insight | Routine observations, freshness, coverage, uncertainty; states: no consent, revoked, too early, stale, insufficient, ready |
| 5 | Weekly | Trend per area (days 1–4 vs 5–7), states: forming, stable, changed, insufficient; frequency choice; check-in |
| 6 | Lab | Hypotheses, copy variants A/B, live event preview, synthetic funnel |

## Requirements
- **R1 Consent gate.** No sensor data is read or shown unless `consent.status = accepted` and the category is shared. Only the monitored person can accept, decline, share or revoke (enforced in `src/engine/consent.ts`, unit tested).
- **R2 Honest gaps.** Categories are reporting, quiet, missing, stale or not shared. Missing and stale never count towards coverage or reassurance. Data older than 6 h is stale.
- **R3 First insight threshold.** Shown only after ≥24 h since setup and with ≥60% of shared sensors reporting; otherwise the reason is given.
- **R4 Weekly threshold.** Needs 7 days, and ≥60% of shared areas with data on ≥5 of 7 days. A change means |recent − earlier| ≥ 1.5 events/day **and** ≥40% relative.
- **R5 Language.** Observations, not interpretations: no diagnosis, medical advice, prediction or "all is well". Enforced by `src/engine/copy.ts` in unit tests.
- **R6 Calm notifications.** Weekly digest by default; no real-time alerts (Lilli publicly says it does not currently detect falls).
- **R7 Instrumentation.** Catalogued events only; forbidden properties (name, contact, address, raw events, free text) are rejected.
- **R8 Accessibility.** WCAG 2.2 AA; works at 390 px and 1366 px; keyboard-only completion.

## Success measures
See [METRICS.md](METRICS.md). The north-star for the first week is the **first useful insight reached** rate, guarded by revocation, unwanted-alert and misunderstanding measures.

## Non-goals
Fall detection, health inference, care-provider dashboards, payments, real device pairing, real notifications.

## Open questions
Listed in [ASSUMPTIONS.md](ASSUMPTIONS.md) and [DISCOVERY_GUIDE.md](DISCOVERY_GUIDE.md).
