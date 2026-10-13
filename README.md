# Lilli Family First-Week Lab

**An independent product concept by Ayo Ahmed, made for my application to Lilli's Product Manager role.** It is not affiliated with, endorsed by or built for Intelligent Lilli, and it is not a Lilli product. The Lilli name and logo belong to their owner and appear only to show the concept in context. Every person, home, sensor event and number is synthetic. This is not a medical or safety service.

## The idea
Lilli's homepage currently invites families to join a waiting list. Whatever the real onboarding looks like, a family product has to get two people through the first week: the family member who buys it, and the person being monitored, who has the right to say no. This prototype is my take on that first week:

1. **Choose** a fictional household, relationship and goal, with a plain explanation of what is simulated.
2. **Consent first.** The monitored person accepts per category, declines, or revokes later. There is no family override, and it is enforced in the engine.
3. **Setup** checklist with simulated sensor readiness. Missing is shown as missing, never as "fine".
4. **First useful insight** after a full day: routine observations, freshness, coverage and uncertainty. No diagnosis or prediction.
5. **Weekly summary** in stable, changed and insufficient-coverage states, with notification frequency and a relaxed check-in.
6. **Product lab**: hypotheses, A/B onboarding copy, a live event preview and a funnel that is clearly labelled synthetic.

## PM package
| Doc | |
|---|---|
| [design.md](design.md) · [Brand guide](docs/brand/BRAND_GUIDE.md) | Research, principles, IA, states, visual system |
| [PRD](docs/PRD.md) · [ELI5](docs/ELI5.md) · [5 Whys](docs/FIVE_WHYS.md) · [JTBD](docs/JTBD.md) | Problem and requirements |
| [Decision log](docs/DECISION_LOG.md) | First-person product calls and what would change my mind |
| [Discovery guide](docs/DISCOVERY_GUIDE.md) · [Assumptions](docs/ASSUMPTIONS.md) | Five neutral questions; no interviews have been run |
| [Metrics](docs/METRICS.md) · [Experiments](docs/EXPERIMENTS.md) | Denominators, event properties, exclusions, guardrails; two pre-registered tests, no lift claimed |
| [Trade-offs and risks](docs/TRADEOFFS_AND_RISKS.md) · [Role viability](docs/ROLE_VIABILITY.md) · [V2 roadmap](docs/ROADMAP_V2.md) | |
| [Test plan](docs/TEST_PLAN.md) · [Test results](docs/TEST_RESULTS.md) | Actual command output |
| [Sources and limitations](docs/SOURCES.md) · [Deploy](docs/DEPLOY.md) · [Video](video/README.md) | |

## Run it
```bash
npm ci
npm run dev          # http://localhost:5173
npm test             # engine unit tests
npm run build && npm run e2e   # browser tests (390 px and 1366 px, axe, keyboard)
npm run cf:dryrun    # Cloudflare Workers Free dry run (does not deploy)
```

Stack: TypeScript, Vite, plain DOM (no framework), Vitest, Playwright and axe-core. It is a static-assets Worker on Cloudflare.

## Licence
Code is MIT. Fonts (DM Serif Display, Epilogue, Oooh Baby) are under the SIL Open Font License via @fontsource. The Lilli logo and brand are not covered by this licence.

Independent concept by Ayo Ahmed.
