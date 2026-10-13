# Metrics

All definitions are proposals. The prototype records these events in the visitor's own server-side lab session (capped at 200; see the Lab). Nothing goes to an analytics service. **No values are reported here because no real data exists.** The Lab funnel uses a synthetic cohort only to illustrate denominators.

## Common event properties
`household_id` (pseudonymous), `actor_role` (`family` | `monitored`), `variant` (`setupFirst` | `benefitFirst`), `seq`, `synthetic` (always `true` in this prototype).
**Forbidden on any event:** name, email, phone, address, postcode, coordinates, raw sensor events, free text (enforced by `makeEvent`).

## Global exclusions
Internal/test households; households created by staff or demo accounts; households where the monitored person cannot consent (out-of-scope route); duplicate invitations to the same person within 24 h are counted once; devices returned within the cooling-off period are reported separately.

## Primary metrics

| ID | Metric | Numerator | Denominator | Window | Events and properties | Exclusions |
|---|---|---|---|---|---|---|
| M1 | **Consent completion** | Households with `consent_accepted` | Households with `invite_sent` (first attempt), excluding undeliverable invites | 7 days from invite | `invite_sent.invite_attempt`, `consent_accepted.categories_count`, `consent_accepted.categories` | Re-invites after decline are tracked as M1b, not mixed in |
| M1b | Accepted after re-ask | `consent_accepted` with `invite_attempt ≥ 2` | Households with `consent_declined` | 30 days | as above | Watch as a pressure signal, not a target |
| M2 | **Setup readiness** | Households with `setup_ready` | Households with `consent_accepted` | 72 h from accept | `setup_ready.ready_count`, `shared_count`, `minutes_from_accept`; `sensor_status_changed` | Households whose kit hasn't been delivered |
| M3 | **First useful insight reached** | Households with `first_insight_viewed` where `status = ready` **and** `coverage_pct ≥ 60` **and** `data_age_bucket ∈ {<1h, 1-6h}`, and no `insight_feedback.answer = unclear` in the same session | Households with `setup_ready` at least 24 h earlier | 7 days from setup ready | `first_insight_viewed.status`, `coverage_pct`, `data_age_bucket`; `insight_feedback.answer` | Views where status is `stale`, `insufficient`, `tooEarly` (counted in M3 diagnostics) |
| M4 | **Weekly return / summary use** | Households with ≥1 `weekly_summary_viewed` in days 8–14 | Households that reached M3 at least 7 days earlier and still have active consent | Week 2 | `weekly_summary_viewed.state`, `covered_areas`, `shared_areas` | Households that revoked in week 1 (reported in G2, not counted as churn) |

## Safety guardrails
Guardrails can stop an experiment or launch even if primaries improve.

| ID | Guardrail | Definition | Denominator | Alarm level (pre-registered) |
|---|---|---|---|---|
| G1 | **Unwanted alerts** | Households that set `notification_frequency_set.frequency = off` within 7 days of their first digest, or report "too many" in follow-up | Households that received ≥1 digest | Any arm worse than control by a pre-set margin; agree the margin before launch |
| G2 | **Sharing revocation** | Households with `sharing_revoked` (scope `all`, or any category) within 14 days of accept | Households with `consent_accepted` | Any increase versus control is reviewed with qualitative follow-up. Revocation is a right, never something to optimise down |
| G3 | **Misunderstanding** | `insight_feedback.answer = unclear`, plus comprehension-check failures ("Does this app alert you to falls?" answered yes) | Households that viewed an insight or completed the check | Any arm worse than control → stop |
| G4 | **Stale reassurance (must be zero)** | `first_insight_viewed` with `status = ready` while `data_age_bucket ∈ {6-24h, >24h}` | All `first_insight_viewed` | Any non-zero count is a bug and blocks release |

## Diagnostics (not targets)
Distribution of `first_insight_viewed.status`; `consent_accepted.categories_count`; time from `invite_sent` to `consent_accepted`; `check_in_started.channel` by `weekly_state`.
