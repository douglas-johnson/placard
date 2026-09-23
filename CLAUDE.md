# Placard

A curriculum planner and guide for art appreciation and self-study. A learner photographs works that genuinely interest them; the app grows a course of study outward from those encounters.

Solo project. Every architectural choice is also a learning-budget choice.

## Documents

| File | What it is | When to read it |
|---|---|---|
| `docs/PLANNING.md` | The strategy document — long, argued, load-bearing | Has its own section map at the top. **Use it.** Don't read end to end for a narrow question. |
| `DECISIONS.md` | Settled architectural calls, with reasoning | Before proposing an approach, and after settling one |
| `docs/capture-protocol.md` | Field procedure for collecting labels | Corpus work |
| `data/README.md` | Corpus layout and fixture format | Anything touching `data/` |
| `db/README.md` | Postgres schema decisions, decided in advance | Before creating any schema |

PLANNING.md §13 is open questions. When one gets answered, write it into `DECISIONS.md`
— an answer left in a chat transcript is an answer that gets re-litigated.

## Naming — easily confused

- **Placard** — this project. It was **Wall Text** until 2026-09-19 and **Art Book**
  before that (D31); a reference to either older name means this. The domain is
  `placard.pics`. The working directory on disk is still `walltext/`, and nothing
  derives from that.
- **"wall text"** (lowercase) — the museum term for the interpretive panel, as
  distinct from the **tombstone label**. §4 is mostly about the *label*. Keep the
  terms separate; they're different extraction problems. The term stays in the
  documents wherever it's used literally; only the project name changed.
- **Other people's sites.** The rename happened because existing exhibition guides
  already used the old name. PLANNING.md §12 argues from the category of existing
  aggregators and does not analyze any one of them — that analysis is kept out of
  this repository on purpose, and the rule for why is D32. Don't reintroduce it.

## Hard constraints

These override convenience. They come from PLANNING.md and they are the kind of thing
that is cheap to honor now and effectively impossible to retrofit.

**1. Privacy is a boundary, not a setting (§5, §8.5).** No learner ever sees another
learner's notes, photos, or interest profile. The back office has **no read path** to
the private layer — not permission-gated, *absent*. No query, no join, no export, no
debug view. Separate database credentials are the preferred way to enforce it, because
they hold when application code is wrong — but the mechanism is a means, not the
constraint. Propose a different one if it meets the goal as well or better.
When a debugging need seems to require crossing this line, that's the exact disguise
the leak always arrives in.

This constraint governs the **private layer** — learner notes, photos, interest
profiles. It does not govern the corpus (raw frames, manifests, fixtures), which is a
separate data class with its own consent and its own storage; `docs/field-beta.md` §1
says why. Don't borrow this constraint's authority for a decision it doesn't cover.

> **Don't overstate this.** Three separate rules get confused easily, and I already
> confused them once (D28): learners never see each other's material; personal material
> never *promotes* to the shared canon; and the service may process a learner's own photo
> **on opt-in** to expand their path. The third is a product decision, not a violation of
> the first two. The one genuine never-leaves-the-device rule is the eligibility profile
> (§9.6, D25).

**2. Nothing enters the graph as a bare fact (§4.7, §8.3).** Everything is a *claim*,
carrying source, confidence, timestamp, corroboration, verification, and supersession.
Wall labels are wrong more often than people expect. Nothing is ever hard-deleted —
claims are superseded and the superseded version stays queryable.

**3. Inference never launders into verified fact (§4.8, §8.2).** An inferred edge that
a verifier confirms becomes verified *with a citation*. One that merely goes
unchallenged stays inferred forever. The three claim classes — canonical fact, access
policy, display state — are verified by different mechanisms and must never be
presented to a user as the same kind of "verified."

**4. Voice: curious peer, not instructor (§1).** This is a tone constraint with teeth,
and it applies to UI copy, error messages, and suggestion text. Prefer *"Caravaggio was
painting in Rome around the same time — want to see what that looked like?"* over
*"Next lesson: Baroque tenebrism."* The app proposes; it never assigns.

**5. Never show a denominator (§6.5).** Works encountered, threads closed, connections
made — metrics that only go up. Never percentages, never "12 of 340." The denominator
is all of art history; displaying it is a promise that gets broken every session.

**6. Never ingest another aggregator's data (§12.4).** Their data is itself scraped
from museums, so re-scraping it compounds extraction errors instead of correcting
them — go to the same primary sources they do. And ingesting someone's dataset before
talking to them makes a later collaboration conversation impossible. Using an
aggregator as a *benchmark* — diffing our authority checker against what it shows —
is different and entirely fair.

**7. Dates are EDTF (§4.5, D5).** `1620~` not `1620`. Storing the integer silently
loses the "about," which propagates into unwarranted confidence downstream.

## Current state

**Phase A0 — collecting the ground-truth label corpus.** See `DECISIONS.md` D1 for why
this leads rather than B0.

Nothing is running yet. There is no database, no API, no app. What exists:

- `docs/capture-protocol.md` — the field procedure
- `tools/ocr/` — Apple Vision OCR CLI, working, builds with `swiftc`
- `tools/exif/` — one-file EXIF/GPS checker, run interpreted; first step after every import
- `data/` — nine label-only fixtures from one MCNY visit, bound to raw frames; venue registry with first-hand access rules

**Next:** A1, the Expo capture app. Its first milestone is concrete — *beat the stock
camera at collecting the corpus*: enforce paired work+label shots, capture venue
automatically, read the accession number on-device and show it back for confirmation.
The toolchain for all of that is now proven on the phone (D29, D30); what's left is
the capture screen itself.

## Repository layout

```
walltext/                (directory name predates the rename; see Naming)
├── apps/
│   ├── learner/        Expo + React Native, iOS first — A1, current
│   ├── backoffice/     Next.js — B1, not started
│   └── public-site/    Next.js, server-rendered — B3, not started
├── services/canon/     FastAPI — B1, not started
├── db/                 Postgres schemas — B1, not started
├── tools/ocr/          Swift Vision OCR CLI — working
├── data/               Label corpus, fixtures, venue registry
└── docs/
```

Each of `apps/`, `services/`, `db/` has a README explaining what goes there and what
was already decided about it. Read that README before creating anything in it.

## Commands

```sh
# Build the OCR tool (no Xcode project involved)
./tools/ocr/build.sh

# Run it over a take; NDJSON to stdout, progress to stderr
./tools/ocr/bin/placard-ocr data/labels/raw/2026-09-16-moma \
  > data/labels/derived/2026-09-16-moma.ndjson

# Non-Latin script (Asia Society, Japan Society — §4 hard cases)
./tools/ocr/bin/placard-ocr <path> --lang en-US,ja-JP,zh-Hans
```

## Machine

Intel Mac. This is a real constraint, not a footnote.

| | |
|---|---|
| Arch | `x86_64` — Intel, no Rosetta involved |
| macOS | 26.7 Tahoe (Darwin 25.6) — the last macOS that supports Intel |
| Xcode | 26.6 — **capped at 26.x**; Xcode 27 will be Apple Silicon only |
| iOS simulators | 26.5, 18.3 |
| Node | **22.23.2** default (`nvm alias default lts/jod`) · npm 10.9.8 (x64; no pnpm, no bun). Was 20.20.2 until 2026-09-22; moved up because `railway config` needs ≥22.6 (D34) and RN 0.86.3 accepts `^22.13.0`. 20.20.2 is still installed |
| Python | 3.14.3 — **ahead of many ML wheels**; pin services to 3.12/3.13 |
| CocoaPods | 1.17.0, on Homebrew Ruby 4.0.6 — **install with `gem`, never `brew`**, see below |
| Postgres | not installed (Homebrew available) |
| Docker | not installed |

### Verified working on this machine (2026-09-16)

Checked rather than assumed, because "does the toolchain still ship x86_64" is the
question that silently kills an Intel Mac:

- **`tools/ocr`** — builds with `swiftc` and runs natively. No issue.
- **Expo Go 57.0.9** — the simulator build is a fat binary, `x86_64 arm64`. The
  Expo Go path is fully supported.
- **`apps/learner`** — bundles and renders in the iOS 26.5 simulator and on the phone.
  `expo-camera` and `expo-location` both link and report permission correctly.
  Re-checked under Node 22.23.2 on 2026-09-22 after the default moved: `tsc --noEmit`
  clean and `expo export --platform ios` bundles 662 modules to Hermes from a cold
  cache. **The native build was not re-run under 22** — `expo run:ios` is slow here, and
  Xcode's bundle phase is the place a Node change would most plausibly bite. Treat the
  next device build as the confirmation.
- **React Native 0.86.3 prebuilt artifacts** — both `react-native-artifacts-0.86.3-reactnative-core-debug`
  and `-reactnative-dependencies-debug` contain an `ios-arm64_x86_64-simulator`
  slice. **Development builds are therefore viable on Intel**, which matters because
  A1's Vision OCR module requires one (Expo Go can't load custom native modules).
- **Expo Go on the phone** (iPhone 16, iOS 26.6) — loads the bundle over LAN from
  `npx expo start --go`. Expo Go's "Development servers" list is empty until *both*
  the CLI (`npx expo login`) and the app are signed into the same Expo account; that
  was the quick route. Scanning the QR from the Camera app is supposed to work without
  login.
- **Development build on the phone** — `npx expo run:ios --device` (pick the phone
  from the list) builds, installs, and launches; preflight reports a development-build
  host with camera and location granted. Signed with the personal account; the team
  ID is set in `app.json` and nowhere else. The four one-time setup steps (Developer Mode, first
  provisioning via Xcode, script sandboxing, trusting the profile) are in D29.
- **Vision OCR on the phone** — the local module compiles and runs the shared
  pipeline on-device: 13 lines in ~650 ms on the bundled 38.447.4 label (D30). This
  build is the only host for it; Expo Go reports the module as not linked.

### Homebrew has almost no Intel bottles on macOS 26 — check before installing

This is the single most expensive trap on this machine. **Intel on the newest macOS is
the least-supported Homebrew configuration there is**, and when a bottle is missing
Homebrew silently falls back to building from source. `brew install cocoapods` here
resolves to *compiling LLVM*, which is hours of CPU for what should be a one-minute
install.

Check first, every time:

```sh
brew info --json=v2 <formula> | python3 -c \
  "import sys,json;print(sorted(json.load(sys.stdin)['formulae'][0]['bottle']['stable']['files']))"
```

If `tahoe` isn't in the list, find another route — a prebuilt binary, a `.app`
distribution, or a language-native package manager. For Postgres later, Postgres.app is
likely the better path than Homebrew for exactly this reason.

### CocoaPods — resolved, and how

`pod` is **1.17.0**, installed with `gem install cocoapods` against the Homebrew Ruby
at `/usr/local/opt/ruby`. Fifteen seconds, and `ffi` came down as a prebuilt
`x86_64-darwin` gem so nothing compiled. Verified with `pod env`: the full gem stack
loads on Ruby 4.0.6 and sees Xcode 26.6.

Two things to know if this looks broken again:

- **The binstub is not in `/usr/local/bin`.** `gem install` puts executables in
  `/usr/local/lib/ruby/gems/4.0.0/bin`, which `~/.zshrc` now prepends to `PATH`. That
  path is version-pinned, so a Ruby major upgrade will need it bumped — `gem env`
  prints the current one under `EXECUTABLE DIRECTORY`.
- **Five 2020 binstubs were moved out of `/usr/local/bin`** — `pod`, `sandbox-pod`,
  `xcodeproj`, `httpclient`, `fuzzy_match`, all left by an old `gem install` against
  Apple's system Ruby 2.6. They ran, but they shadowed the current CocoaPods and
  emitted the `Ignoring ffi-1.13.1` warning. They're in
  `~/.local/share/stale-binstubs-20260916/` with a README, not deleted, in case
  something turns out to reference them.

### What Intel actually costs

Native iOS builds are slow, and Apple Silicon–only tooling is unavailable. Nothing is
blocked, but prefer approaches that make progress without a device build — which is
also the reasoning behind D2 and D3.

## Conventions

- **Write prose, not bullets, in the planning documents.** They're argued documents and
  the arguments are the content. Match the existing voice — it's careful and it earns
  its conclusions.
- **Cite sections.** When code embodies a decision from the plan, reference it (`§4.3`,
  `D2`). It's how a reader finds the reasoning without asking.
- **Raw capture data is immutable.** Never edit, crop, or rename anything under
  `data/labels/raw/`.
- Commit messages: what changed and why. The why is the part that's hard to recover.
