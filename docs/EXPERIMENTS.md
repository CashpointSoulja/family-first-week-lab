# Experiments

Two pre-registered designs. **Neither has been run and there is no observed lift.** Sample sizes depend on baseline rates I don't have, so they're written as a method, not a number.

## E1: Explain the benefit before asking for setup effort

- **Variants:** A `setupFirst` (control): "Let's get your kit set up". B `benefitFirst`: "See what your first week could tell you", plus a one-line preview of the first insight for the goal they picked. Both are switchable in the Lab.
- **Randomisation unit:** household, at the start screen; sticky across sessions and shown to the family member only. The monitored person's consent screen is **identical in both arms**.
- **Hypothesis (H1):** B increases consent completion because the family member can explain a concrete benefit when asking, without increasing declines or pressure.
- **Primary measure:** M1 consent completion (7 days).
- **Secondary:** M2 setup readiness, M3 first useful insight.
- **Guardrails:** consent decline rate; M1b re-ask rate (a pressure signal); G2 revocation within 14 days; G3 misunderstanding (B must not over-promise).
- **Stopping criteria:** pre-register the minimum detectable effect and sample size once a real baseline exists; fixed horizon with no peeking at the primary. Stop early only on guardrail harm: G3 worse than control, or G2 revocation clearly worse at the interim safety check. Stop for futility at the planned horizon. Ship B only if the primary improves and no guardrail is worse.

## E2: Compare digest frequency choices

- **Variants (default selection only; every option stays available):** A weekly digest (current default), B daily digest, C "only when something looks different".
- **Randomisation unit:** household, at first visit to the weekly screen.
- **Hypothesis (H2):** a weekly default gives higher week-2 return (M4) with fewer opt-outs (G1) than daily, and C gives fewer messages without reducing M4.
- **Primary measure:** M4 weekly return / summary use in days 8–14.
- **Guardrails:** G1 unwanted alerts (opt-out to "off"); G2 revocation, because monitored people can see the family's chosen frequency; G3 misunderstanding (C must not be read as an alarm service); message volume per household.
- **Stopping criteria:** fixed horizon set from a real M4 baseline. Stop an arm early if G1 opt-out or G2 revocation is clearly worse than the weekly arm at the interim check. No winner is declared unless the primary difference clears the pre-registered threshold. Otherwise keep the weekly default (calmest option).

## What I won't do
Report a lift from the synthetic funnel, optimise revocation down, or run either test on the monitored person's consent wording without a separate ethics review.
