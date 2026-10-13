# Build vs buy

*Independent concept by Ayo Ahmed. Not affiliated with, endorsed by or built for Intelligent Lilli. This is portfolio judgement from public sources and from what this repo actually contains. I have no access to Lilli's systems, contracts, roadmap or data, and I haven't evaluated any vendor.*

## My call
- **For real use, I'd use the sensing, care and consent systems that already exist and are approved.** Lilli's public pages describe care monitoring and a family waiting list ([SOURCES.md](SOURCES.md), [homepage](https://www.intelligentlilli.com/), [for families](https://www.intelligentlilli.com/for-families)). Hardware, data collection, consent records, identity and care workflows are the hard, regulated parts. A first-week onboarding idea doesn't justify rebuilding or replacing any of them.
- **I don't buy anything for this prototype either.** Buying a third-party sensing, consent or analytics product to test onboarding copy would answer a question nobody has asked yet and add cost, contracts and data-sharing risk. This repo spends nothing and integrates with nothing.
- **What I did build is narrow:** a synthetic first-week interaction and rules concept, built to make the onboarding questions in [ASSUMPTIONS.md](ASSUMPTIONS.md) and [DISCOVERY_GUIDE.md](DISCOVERY_GUIDE.md) concrete enough to test with people. It is a thinking tool, not a candidate production component.

## What each layer is here, and what it would be for real
| Layer | In this prototype | For real use |
|---|---|---|
| Sensors and hub | Simulated pairing and test events; fixture readings only | The existing approved hardware and pairing flow |
| Data pipeline | Synthetic events in one SQLite-backed Durable Object per visitor cookie ([BACKEND.md](BACKEND.md)) | The existing ingestion, storage and retention systems |
| Identity | None. "Demo role switch, not sign-in" | The existing verified accounts for the family member and the invited person |
| Consent | Server-enforced rules on synthetic state: invite, pending, accept per category, decline, revoke | The existing approved consent record and its legal basis |
| Derived outputs | First insight, weekly summary, coverage and export recomputed from current consent, with the thresholds in [PRD.md](PRD.md) (R3, R4) | Whatever insight layer exists today, informed by these rules only if they hold up |
| Notifications | Frequency choice stored; nothing is sent | The existing messaging and preference systems |
| Analytics | An event-catalogue preview and a synthetic funnel | The existing analytics pipeline, after privacy review |

## Why build the thin concept at all
- The open questions are about sequence, wording and honesty: what to explain before asking for setup effort, how per-area consent reads to the invited person, how missing or stale data should look, and what digest frequency families choose. A static document can't show pending, declined or revoked states; a clickable flow can.
- The rules are small enough to read and test. The repo has unit tests, API tests and a consent check that turns red when a rule is deliberately broken. That makes the concept's own claims checkable without claiming anything about a real system.
- It stays disposable. Nothing in it is designed to be lifted into production, which keeps the conversation on whether the ideas are right.

## Limitations
- I couldn't try the family product because it is waitlisted, so I don't know how its onboarding, consent or data behave today.
- No interviews or user research have been run. Every household, event, threshold result and funnel number is synthetic.
- The insight and weekly thresholds are tuned only on fixtures ([ASSUMPTIONS.md](ASSUMPTIONS.md), A6). They say nothing about real sensor data.
- The prototype has no identity, no rate limiting and no deletion schedule; history is only capped ([TRADEOFFS_AND_RISKS.md](TRADEOFFS_AND_RISKS.md)).
- No medical or clinical claims are made or implied.

## Consent and security burden of a real build
Building any of this for real would carry much more than the prototype does:
- A verified identity for the invited person, so a "yes" is provably theirs, plus a route for people who can't consent for themselves, which needs legal and safeguarding design first.
- A durable, auditable consent record whose revocation reaches every derived output, export, notification and analytics copy, including caches and backups.
- Retention and deletion rules, a data protection impact assessment, access controls and incident handling for very sensitive routine data, such as bathroom and night-time activity.
- Security review, abuse protection and availability commitments the prototype doesn't attempt.

A parallel consent or data store would duplicate all of that burden and create two sources of truth for who agreed to what. That alone is a strong reason to reuse what exists.

## Questions I'd ask the team that owns the real systems
1. Where does the consent record live, and can it hold per-category sharing and per-category revocation?
2. When sharing is revoked, what removes that area from summaries, exports, notifications and analytics, and how quickly?
3. Does the pipeline expose freshness and coverage per sensor, so the app can say "missing" or "stale" instead of implying all is well?
4. Can onboarding copy, its order and digest-frequency options be changed and A/B tested through configuration, or does each change need an app release?
5. How is the invited person identified and invited today, and on which device do they give consent?
6. What events can analytics capture without names, contact details, addresses, raw sensor events or free text?
7. Which parts are covered by existing clinical, legal or partner commitments that a new flow must not change?

## Evidence that would decide a real build-vs-buy choice
| Question | Evidence that would answer it | Leans reuse if | Leans build or buy if |
|---|---|---|---|
| Can existing consent express per-category share and revoke? | The data model and an end-to-end revoke test on a test account | It already does, or can with configuration | It can't, and the owning team agrees a change is needed |
| Can existing outputs show freshness, coverage and uncertainty? | Fields available from the pipeline today | They're present and only need surfacing | They're absent and can't be derived reliably |
| Is onboarding cheap to change and test? | How copy and order are deployed, and existing experiment tooling | Config or flags already exist | Every test needs a release, slowing learning |
| Do people actually struggle in week one? | Discovery sessions and existing funnel data, if any | Problems are about copy and order | Problems need new capability, such as a monitored person's own view |
| What does a change cost in consent and security review? | The owning team's review process and lead time | A UI-layer change avoids new data flows | Any option needs new data flows either way |

My default is reuse. I'd consider building a thin layer on top only where the evidence shows the existing system can't express a needed rule, and only with the owning team. I'd consider buying only if both of those fail and a candidate passes the same consent, security and data-protection review. I haven't evaluated any vendors, so I name none and quote no prices.
