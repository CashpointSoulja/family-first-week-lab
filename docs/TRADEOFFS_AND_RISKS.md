# Trade-offs and privacy/safety risks

## Trade-offs I chose
| Trade-off | Chosen | Cost accepted |
|---|---|---|
| Speed to value vs honesty | Wait 24 h and 60% coverage for the first insight | Some families see "too early" on day 1 |
| Coverage vs consent | Nothing pre-ticked; per-area choice | Fewer areas shared, so thinner insights |
| Sensitivity vs false flags | Change needs both an absolute and a relative difference | Small real changes are missed in week 1 |
| Engagement vs calm | Weekly default, no real-time alerts | Fewer touchpoints, lower daily active use |
| Simplicity vs nuance | Days 1–4 vs 5–7 comparison | Ignores weekday/weekend rhythm until there is more data |
| Brand fidelity vs clarity of affiliation | Real logo and palette with a permanent "not Lilli" badge | Badge takes header space |

## Privacy and safety risks
| Risk | Example | Mitigation in this concept | Residual |
|---|---|---|---|
| Coercive consent | Family member pressures the person to accept | Consent only from the person's own view; decline is equal weight; re-ask tracked as a pressure signal (M1b); no family override | Can't detect coercion off-screen; needs discovery and safeguarding input |
| Lack of capacity | Person can't meaningfully consent | Explicitly out of scope with a stop message; no proxy flow | Needs a legal design (e.g. LPA) before any real launch |
| False reassurance | Hub offline but app looks calm | Stale after 6 h; stale/missing never count; G4 must be zero | Sensor misreads (e.g. a visitor using the kettle) |
| False alarm | Routine change flagged when they're on holiday | Thresholds, "Sensors can't tell you why", relaxed check-in copy | Some anxiety is unavoidable |
| Misread as emergency service | Family expects fall alerts | No real-time alerts; copy cites Lilli's public "does not currently detect falls" | Comprehension check needed (G3) |
| Sensitive inference | Bathroom or night data feels intimate | Counts only, "not what happens there"; per-category opt-in; revoke per area | Even counts are sensitive; may warrant extra friction |
| Data after revocation | Family still sees old insights | Revoking hides earlier insights too (prototype behaviour) | Real retention and deletion policy needed |
| Analytics leakage | Event properties include identity | Forbidden-property guard; pseudonymous IDs; no raw events | Real pipeline needs DPIA and access controls |
| Brand confusion | Viewer thinks this is Lilli's product | Badge, footer, README disclaimer, `noindex` | Screenshots can travel without context |
