# Design: Lilli Family First-Week Lab

Independent concept by Ayo Ahmed. Not affiliated with, endorsed by or built for Intelligent Lilli. All households, sensors, events and numbers in this prototype are synthetic.

## 1. What I looked at (research before design)

| Source | What I took from it |
|---|---|
| [Product Manager role](https://apply.workable.com/lilli/j/4CEB76F630/) | The role owns the Family product area: proposition, onboarding, activation, engagement and retention, with a "trust is essential" bar. |
| [intelligentlilli.com](https://www.intelligentlilli.com/) | "Lilli for your loved ones – join the waiting list. We're working hard behind the scenes to make Lilli available directly to families." |
| [For Families page](https://www.intelligentlilli.com/for-families) | Hero "Built for independence. Designed for peace of mind."; no cameras, microphones or wearables; a hub plus 6 sensors (kettle plug, fridge door, front door, bedroom motion, hallway motion, bathroom sensor with temperature); self-setup "taking an average of 30 minutes"; Lilli "does not currently detect falls"; multi-resident homes "can affect insights". |
| [About us](https://www.intelligentlilli.com/about-us) | Purpose ("the future of independent living"), values (authentic, fearless, joyful, purpose-driven), founded 2020. |
| Public product imagery on the For Families page | App mockups: a "Sensors" status pill, a large pale-teal circle with a house icon and the person's name, "In the bedroom / 5 mins ago", three small stat circles, a warm date band ("Today 6AM–10PM"), white rounded cards (Kitchen: Fridge 3 opens, Smart plug 1 use), an hourly activity chart with per-sensor dot rows, and a Today / Settings bottom bar. |

**Limitation:** the family product is waitlisted. I could not install, try or observe the real family app, so nothing here describes real field usage, real onboarding steps or real metrics. The flows are my proposal, informed only by the public pages above.

## 2. Design principles

1. **Consent before collection.** The monitored person accepts, declines or revokes. Family members can't consent for them, and there is no bypass path in the state engine.
2. **Missing is not fine.** Each data category is in one of five states: *reporting*, *quiet* (reporting, with fewer events than usual), *missing* (no data), *stale* (old data) or *not shared*. Missing and stale data never count towards a reassuring summary.
3. **Observe, don't diagnose.** Copy describes routines ("the kettle was first used around 7:40 on 5 of 6 mornings"). It never infers health, gives medical advice or predicts events.
4. **Show the evidence beside the claim.** Every insight shows freshness (last event), coverage (sensors × days) and an uncertainty line.
5. **Calm by default.** Notification choice is explicit; the default is a weekly digest, not real-time alerts.
6. **Recognisably Lilli.** Real logo, sampled palette, the site's serif-plus-script headline pairing, and app cards modelled on Lilli's public mockups.

## 3. Information architecture

- `#/` Start: pick a fictional household, relationship and goal, plus a "What's simulated" explainer.
- `#/consent`: invitation preview → pending → the monitored person's view (accept with granular sharing, or decline) → revoke at any time.
- `#/setup`: hub and sensor checklist with simulated readiness states.
- `#/today`: first useful insight (or an honest "not yet").
- `#/week`: weekly family summary, notification frequency, check-in action.
- `#/lab`: product lab (hypotheses, alternative copy, event preview, synthetic funnel).
- A persistent footer: "Independent concept by Ayo Ahmed. Not affiliated with Lilli. Synthetic data."

Mobile (390 px) is the primary layout: one column, a bottom step bar, 48 px tap targets. Desktop (≥1024 px) shows the phone-width flow beside a context rail (the "why" and the data being simulated) and keeps the lab available.

## 4. States the UI must render

| Area | States |
|---|---|
| Consent | not invited, pending, accepted (with categories), declined, revoked, capacity/third-party route (out of scope, stop) |
| Sensor | ready, waiting for first event, not paired, offline/stale, low battery |
| Insight | ready, too early (<24 h), insufficient coverage, stale data, sharing revoked |
| Weekly | baseline forming (week 1), stable, changed, insufficient coverage |
| Notifications | off, changes only, weekly digest, daily digest |

## 5. Accessibility

WCAG 2.2 AA target: body text ≥4.5:1 (dark teal #1e303a on white/cream), visible 3 px focus ring in Lilli's focus blue #2d62ff, real buttons/radios/checkboxes, `aria-live` for status changes, no colour-only state (every state has a text label and icon shape), and reduced-motion respected.

## 6. Visual system

See [docs/brand/BRAND_GUIDE.md](docs/brand/BRAND_GUIDE.md) and the rendered [brand guide page](docs/brand/brand-guide.html).
