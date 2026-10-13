# Assumptions register

None of these are validated. "Evidence" means public sources only. Risk = impact if wrong × uncertainty.

| ID | Assumption | Evidence today | Risk | How I'd test it |
|---|---|---|---|---|
| A1 | The family member, not the monitored person, usually starts the purchase. | Lilli's family page addresses "your loved one", which suggests a family buyer. | High | Discovery Q1/Q2; waitlist sign-up source question |
| A2 | Per-category consent is understood and not overwhelming. | None | High | Moderated usability test of step 2 with monitored people |
| A3 | Families will wait 24 h for a first insight if told why. | None | Medium | Experiment 1 secondary: day-1 return |
| A4 | Showing gaps honestly does not reduce return visits. | None | Medium | H3; compare weekly return across coverage states (observational) |
| A5 | Weekly digest is a better default than daily for trust and return. | None | Medium | Experiment 2 |
| A6 | Days 1–4 vs 5–7 thresholds (≥1.5/day and ≥40%) produce few false "looks different" flags. | Synthetic only | High | Retrospective check against pilot data with family-labelled "was this useful?" |
| A7 | Six sensor categories map to the routines families care about. | Lilli's public kit list | Low | Discovery Q3/Q4 |
| A8 | A check-in suggestion is welcome and not patronising. | None | Medium | `insight_feedback` + qualitative follow-up |
| A9 | Monitored people will revoke at a low but non-zero rate, and revocation is a healthy signal, not churn to fight. | None | Medium | Monitor `sharing_revoked` as a guardrail, never as a target |
| A10 | Setup takes around 30 minutes. | Lilli's family page says an average of 30 minutes | Low | `setup_ready.minutes_from_accept` |
| A11 | Families won't mistake the product for an emergency service. | Lilli publicly says it does not currently detect falls | High | Comprehension check in onboarding; guardrail metric M-G3 |
