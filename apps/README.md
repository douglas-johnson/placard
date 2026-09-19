# apps/

Three user-facing surfaces. Only one is being built now.

| Directory | What | Phase | Stack | Status |
|---|---|---|---|---|
| `learner/` | iOS capture + curriculum app | **A1 — current** | Expo + React Native | scaffolded |
| `backoffice/` | Canon curation, review queues | B1 | Next.js, web only | not started |
| `public-site/` | Server-rendered calendar + markup | B3 | Next.js, static/ISR | not started |

They are separate applications, not screens in one app. PLANNING.md §8 is explicit
that the back office is a different product with different deployment, auth, and users
— and §8.5 requires that it have **no read path to learner data at all.** Keeping them
as separate deployments with separate database credentials is how that boundary is
enforced in infrastructure rather than in code review.

`public-site/` must be server-rendered (§9.2). Many crawlers don't execute JavaScript,
and the entire point of that surface is being machine-readable, so a client-rendered
calendar is invisible to its own audience.
