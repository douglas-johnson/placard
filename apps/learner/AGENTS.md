# apps/learner — the capture app

**Read the exact versioned Expo docs at https://docs.expo.dev/versions/v57.0.0/ before
writing any code.** Expo changes fast and remembered APIs are usually a version or two
stale.

Project-wide context is in the repository root `CLAUDE.md`, `PLANNING.md`, and
`DECISIONS.md`. Read the root `CLAUDE.md` first — this file only covers what's specific
to this app.

## What this is

Phase A1 (PLANNING.md §11). The learner-facing iOS app: capture, OCR, location, and
manual identification against a small hardcoded catalog. **No suggestions yet** — the
curriculum work is A3, and building it early would mean building it against a graph
that doesn't exist.

The one question A1 exists to answer: *is the capture ritual something you'd actually
do standing in a gallery?* No amount of engineering answers that, and if the ritual
doesn't hold, nothing downstream matters.

## The first milestone is concrete

**Beat the stock camera at collecting the corpus.** The corpus is currently being
collected with `docs/capture-protocol.md` and a stock iPhone camera (D2), which sets a
real bar:

- Enforce the work → label shot pairing, so the take needs no hand-sorting
- Capture venue automatically from GPS instead of the manual field log
- Read the accession number on-device and show it back for confirmation
- Never lose a capture to bad signal

That's testable in a way "a capture screen exists" isn't. Until the app clears it, the
protocol is the better tool and should be used.

**F0 (docs/field-beta.md §7) is that build, written 2026-09-19 and awaiting a field
test.** What it does, and where:

| | |
|---|---|
| `App.tsx` | The router — four screens and one flow at a time, no navigation library (D33) |
| `src/take.ts` | A visit: frames plus an append-only NDJSON manifest under `Documents/takes/<date>-<venue>/`, replayed on launch to resume |
| `src/screens/Arrive.tsx` | GPS fix → registry venues nearby → pick or add (a low-confidence claim) → the field log. Earlier visits, with share, live here too |
| `src/screens/Done.tsx` | After the exterior: the manifest, and nothing else, before the take is let go |
| `src/screens/Capture.tsx` | The viewfinder. Preview is 3:4 on purpose — expo-camera crops the still to the preview — and there is no `autofocus` prop on purpose: `"on"` means focus-once-and-lock (field-beta §6.1) |
| `src/screens/LabelFlow.tsx` | A label → on-device read → accession shown back → C only if nothing read → B enforced, or a stated reason → flags and hard cases |
| `src/accession.ts` | Finds and ranks accession-shaped lines; locates, never validates (D11). `npm run locator-eval` scores it against every reading in the corpus — device manifests and Mac OCR — 32/35 first-candidate correct after the Met |
| `src/screens/VenueFlow.tsx` | Arrival signage in the protocol's order; the exterior on leaving, which ends the take |
| `src/screens/WallTextFlow.tsx` | The interpretive panel, optionally linked to the last label group |
| `src/location.ts` | One position watcher per session; the fix is written into each JPEG's EXIF via `additionalExif` |
| `src/registry.ts` | `data/venues/` bundled via `metro.config.js` `watchFolders` — add a venue there **and** to the import list |

Frames also go to the camera roll, so the USB path in the protocol still works. The
manifest leaves through the share sheet (AirDrop works in airplane mode).

## Constraints specific to this app

**Capture must never fail offline.** Museums have terrible connectivity (§3). Photo,
OCR, and location all happen on-device and queue locally; resolution against the canon
happens whenever signal returns. This is an architectural constraint, not an
optimization — it shapes the data flow, so design for it from the first screen.

**OCR is on-device, via Apple Vision.** Free, fast, works with no signal. It is the
local Expo module in `modules/vision-ocr/`, and its pipeline — `ios/OCRCore.swift` —
is literally the file `tools/ocr/` compiles for the Mac corpus tool (D30). Change it in
one place and both hosts change. Two settings from D3 are load-bearing:

- `usesLanguageCorrection = false` — correction turns artist names and accession
  numbers into ordinary English words
- explicit top-to-bottom reading-order sort — Vision returns observations unordered,
  and §4.2's whole argument is that a label is a *known form*, which only helps if
  line order survives

Vision is not in the Expo SDK, so this module needs a development build — Expo Go
reports it as not linked and the preflight says so. `npx expo run:ios --device` builds
one; the one-time device setup is in D29. The preflight runs the module over a bundled
copy of the 38.447.4 label in `assets/fixtures/` so a broken build is caught by a
real reading, not by the module merely existing. **The phone's Vision model is not the
Mac's** — same file, different wrong character (D30). Don't assume a fixture's `traps`
describe what the device will see.

**The label shot is the highest-value capture and the easiest to forget** (§13). Making
the second shot feel like documentation practice rather than a chore is a design
problem, not a technical one.

**Ask rather than guess.** When identification confidence is low, show three candidates
and let the learner choose (§4.1). A wrong silent identification poisons the learner's
graph; an honest question is Reggio-appropriate anyway.

**This device holds the private layer** (§5) — photos, notes, reactions, interest
weights. Two different rules govern it, and conflating them is a mistake I already made
once (D28):

- **Promotion to the shared canon** is tightly constrained. Only the objective fact of a
  sighting promotes, de-identified, timestamp coarsened, and only once corroborated.
  Notes, reactions and interest vectors never promote at all.
- **Processing for this learner** is a separate question with a separate answer. Sending
  an artwork or label photo to the service for richer identification and analysis is
  **opt-in, per purpose**, and carries no telemetry or PII. It expands that learner's own
  path; it does not enter the canon. See D28 for the model and its limits.

**The eligibility profile is the exception that really never leaves** (§9.6, D25).
`freeForMe(rule, profile)` runs here, on the phone, and the server learns at most which
venues were viewed. ZIP-level residency is close to a home address, so this one is not a
toggle.

## Running it

```sh
npm install
npx expo run:ios --device <simulator udid>   # development build in the simulator
npx expo run:ios --device                    # …or on the phone (D29)
npx expo start                               # Metro, for either
```

Expo Go still loads the bundle but can't link the Vision module, so a label group
reads nothing there. In the simulator the shutter produces a blank 200px frame; every
camera screen has a **Fixture (dev)** action that hands the flow the bundled 38.447.4
label instead, which exercises the read-back path. It's compiled out of release builds.

`npm run locator-eval` runs the accession locator over every reading the corpus holds
(`scripts/locator-eval.ts`) and prints one line per label with the expected number
and the candidates offered. Run it after any change to `src/accession.ts`; the
manifests under `data/labels/raw/` are the device rows, so the count is machine-dependent.

The preflight that used to be the whole app is now `src/screens/Preflight.tsx`, behind
"Check this build" on the hub. It reports whether the native modules the capture path
depends on are actually linked, and echoes the same readout to the Metro console.

### Shipping to testers

Two paths, and the difference is whether the native surface changed (D33):

```sh
# JS-only change — reaches every TestFlight phone on next launch, ~1 minute
npx eas-cli@latest update --channel testflight --environment preview --message "…" --non-interactive

# Native change (a new module, a plist string) — ~15 minutes plus Apple's processing
npx eas-cli@latest build -p ios --profile testflight --non-interactive
npx eas-cli@latest submit -p ios --profile testflight --id <build> --non-interactive --wait
```

`--environment` is required in non-interactive mode; it selects which EAS
server-side environment variables get bundled, and this project defines none, so
`preview` is just the label that matches a TestFlight channel.

Adding a dependency with native code silently puts you on the second path. Check
before adding.

**Verified on this machine 2026-09-16** — bundles at 721 modules, renders in the iOS
26.5 simulator, `expo-camera` and `expo-location` both link and report permission.
Expo Go's simulator build is `x86_64 arm64` fat, so Intel is not a problem here.

## Development builds

Expo Go cannot load custom native modules, so the Vision OCR work needs
`expo prebuild` and a development build. Two things to know before starting:

1. **CocoaPods is ready** — 1.17.0, installed via `gem`, verified against Xcode 26.6.
   Do not `brew install` it; there's no Intel bottle on macOS 26 and Homebrew will
   compile LLVM from source. See root `CLAUDE.md`.
2. **It does work on Intel.** React Native 0.86.3's prebuilt xcframeworks include an
   `ios-arm64_x86_64-simulator` slice, checked directly against Maven Central. Slow,
   but not blocked.

The simulator has no real camera, so capture work ultimately needs a device build.
That's another reason the stock-camera protocol stays in use until this app clearly
beats it.
