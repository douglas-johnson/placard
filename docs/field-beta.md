# Field beta — a collector's build of the learner app

**Status:** plan, on branch `field-beta`. Nothing here is built. Decisions it proposes
are marked as proposals and go to `DECISIONS.md` when settled, not before.

**The problem it solves.** The corpus is collected with a stock camera (D2) and the
frames reach the project either over USB or by being pasted into a chat, and the chat
channel strips every byte of EXIF — no GPS, no time offset, no orientation. The protocol
already says so. The capture app was always going to replace that, and A1's milestone
already names the bar: *beat the stock camera at collecting the corpus.* This plan
takes that milestone and adds one constraint the phasing didn't have: the collectors
are not all Doug, and they are not all in New York.

So the first shipped build of Placard is a **collector's build**. It captures venues,
labels, and wall text as three distinct inputs, queues them offline, uploads them to a
private corpus bucket, and does nothing else. No identification against a catalog, no
suggestions, no curriculum. That is a narrowing of A1, not a change of direction: the
capture ritual is the one question A1 exists to answer, and a build that a dozen
people use in a dozen museums answers it faster than one person in one city.

---

## 1. What a collector's build is, and what it is not

**It is the same app.** Bundle `pics.placard.learner`, same codebase, same native
module. The beta is the capture flow plus a contribution queue, with the rest of the
app absent rather than hidden. Shipping a second "collector" app would mean a second
App ID, a second TestFlight, and a migration for every tester when the real app
arrives. Shipping it as *the* app, at version 0.x, costs nothing later.

**Testers are contributors, and a contribution is not the private layer.** This is the
one conceptual point that has to be right from the first build. §5's tiers and §8.5's
boundary govern the learner's *private* material: photos taken for themselves, notes,
interest weights. A tester on this build is doing something different — knowingly
adding to the shared ground-truth corpus (§11 A0), whose fixtures are committed to a
public repository (D32). That is a distinct data class with its own consent, its own
storage, and its own credential. It is not the private layer, and it is not the canon
either: raw frames are evidence, not claims. Proposal §8.1 names it.

The consent screen says this in plain words before the first capture: *your photos
of labels, works, and venue signage go into a shared research corpus that other
people work from; the photos stay in a private store, the transcriptions become
public; nothing about you is recorded except a random ID this phone made up.* Consent
is per kind, using D28's properties — `upload.label_photos`, `upload.artwork_photos` —
plus a third, `upload.venue_photos`, because venue exteriors are the frames most
likely to contain strangers. Whether they render as three toggles or one grouped
control is still the deferred UI question from D28; the model keeps them separate.

**The voice constraint still applies.** Constraint 4 is about UI copy, and a
collection app is nothing but UI copy. *"Got the label — now the work it belongs to?"*
rather than *"Step 2 of 3: photograph artwork."* Never a count of labels remaining or
a percentage of a venue covered (constraint 5); a running count of what's been
captured today is fine, because it only goes up.

---

## 2. The three inputs

The capture protocol v2 is the spec. Each of its capture categories becomes a distinct
input with its own flow, and the app enforces what the protocol could only ask for.

### 2.1 Venue

The protocol's discovery from the first visit: entrance signage was the best single
frame of the day, and it is a capture category, not a bookend (D26). On arrival the
app asks for, in order: the venue name as displayed, any board stating hours,
admission, free days, or resident rules, and the accessible-entrance sign if it is
separate. On leaving, the exterior. These frames also do the segmenting job the
protocol relied on — bookends plus timestamps — but the app records venue membership
explicitly, so segmenting is a fallback, not the mechanism.

The **field log** becomes a short structured form filled at arrival: free-via, whether
photography is permitted, and free text. The rest of the protocol's log — shared
panels, loans — is captured where it happens, at the label.

### 2.2 Label

The unit is the label, not the work (protocol v2, D18). A label capture is a small
group:

- **A. The label**, one or more frames (the protocol allows two overlapping frames
  when a panel won't fit; the group holds both).
- **B. The work(s)** it governs — one frame per object, taken immediately after. The
  app asks for at least one and allows many; it does not let the group close without
  either a work frame or an explicit *"no work photo — photography prohibited / it's a
  case / it's a building."* That reason is data (D23, D12).
- **C. The accession crop**, only offered when on-device OCR read no accession-shaped
  line from frame A. The protocol says the crop was usually wasted; the app makes it
  conditional on evidence rather than on judgment.

**Accession read-back** happens on frame A, on device, with the existing Vision
module, in the ~650 ms D30 measured. The app shows the candidate line and asks the
tester to confirm, correct, or say there isn't one. This is the A1 milestone's third
bullet and the corpus's biggest time-saver: a fixture whose primary key was confirmed
by a human standing in front of the label is a different thing from one transcribed
later from a photo. The correction, if any, is stored alongside the OCR reading —
both are corpus data (D21).

**Group-level flags**, each traceable to a protocol case: *shared panel — governs the
next N works* (the photography gallery); *case panel — several objects, mixed
ownership* (the cigar vitrine); *loan, no accession* (the Champanier mural); *loan,
lender's accession* (the Eagle). And the protocol's hard-case table as a multi-select —
reflective glass, low light, bilingual, non-Latin, vinyl, oblique, attribution
qualifier — so a tester who went out of their way for a hard case says so at the
moment they did it.

### 2.3 Wall text

The interpretive panel, as a separate input, because it is a different extraction
problem (§4.6) and the protocol already asks that it *look like a different kind of
photo*. One or more frames, optionally linked to the label group it accompanies (the
Champanier system had four surfaces). No OCR read-back; nothing to confirm.

---

## 3. Multi-city

Two things break when the collector is not in New York: the venue registry and the
identity of the collector.

**Venue resolution.** On arrival the app takes a GPS fix and offers the registry venues
within a few hundred meters. That works for any city whose venues are in
`data/venues/`, which today is one museum in one city. When nothing matches, the
tester adds the venue: name as displayed, the fix, optionally the website. That
record is a *claim* with source `tester`, confidence low, and it stays that way until
someone verifies it against the institution — constraint 2 applies to venues as much
as to attributions. The registry grows from the field, which is the only way it was
ever going to grow to fifteen institutions in several cities.

Seed the registry before the first external tester, with a handful of venues in each
tester's city, so that the add-venue path is the exception on day one rather than the
rule. That is an afternoon of JSON per city and it needs to know who the testers are
(§9, open question).

**Collector identity.** No accounts. The app generates a random ID on first launch and
that ID accompanies every upload. It is the only identifier the server ever sees.
Doug knows which ID is his; if he needs to know which ID is a friend's, that mapping
lives in his head or in the private notes repository — never in the bucket, never in
the working repository. This is D25's shape applied to contributors: the thing that
identifies a person stays off the server.

The photos themselves keep their EXIF, GPS included, because the venue prior (§4.1)
and the segmenting fallback need it and because that is what the protocol fought to
get. The consequence is that a contributor's uploads are a movement history of their
museum visits. That is the same hazard D28 names for learner uploads, and the same
answer applies: the bucket is private, single-credential, never joined to anything
about the person, and the ID is pseudonymous.

**Faces.** Venue exteriors and work frames will have strangers in them, and those
people did not consent. D28 is explicit: detect and blur on device, before upload,
because server-side blurring means the unblurred frame was already transmitted. The
Vision module already exists; face rectangles are a second request type in the same
framework and pixellation is a Core Image filter, so this is a modest addition to
`OCRCore.swift`'s host rather than a new module. The count of blurred regions is
recorded on the frame. Label frames go through the same pass — it is cheap, and a
label reflected in glass can have a face behind it.

This alters what "raw" means for contributed frames, and §8.2 says so explicitly rather
than leaving it to be discovered.

---

## 4. Storage and transport

**Capture never fails offline** (AGENTS.md). Every frame is written to the app's own
document directory the instant it is taken, with an append-only NDJSON manifest
recording the group it belongs to, the input kind, the flags, the OCR reading and its
confirmation, and the venue. Frames are also saved to the camera roll (the permission
is already declared) so the tester keeps their own photos and so Doug's existing
USB-and-`exif-check` path still works unchanged as a fallback.

**Upload is a queue** that drains when there is signal, retries, and never deletes the
local copy until the server has acknowledged the manifest as well as the frames.

**The server is deliberately tiny.** `services/ingest/`, FastAPI, because §10 chose
Python for the API and this is the first API. It does two things: issue pre-signed
upload URLs for a private S3-compatible bucket, and accept a manifest once the frames
are in. It has no database. Manifests are JSON objects in the bucket beside their
frames, and the bucket's layout mirrors `data/labels/raw/<date>-<venue-slug>/`, with
the contributor ID one level up, so that everything on the Mac side —
`placard-ocr`, `exif-check`, the fixture format — runs over a synced copy without
change. B1's Postgres ingests the manifests when it exists; nothing here has to be
redone for that.

**Write-once.** Bucket versioning on; the app's credential can PUT new keys and can
neither overwrite nor delete. Raw immutability (data/README.md) enforced by the
store, in the same spirit as the credential boundary in db/README.md.

**Access to the service** is a per-build shared token plus the contributor ID. That is
enough to keep the bucket from being an open upload endpoint for a closed beta and not
enough for a public app; the token rotates with each TestFlight build.

**Where it runs.** Two constraints from the machine section of CLAUDE.md: no Docker, no
Postgres, and an Intel Mac that should not become a build server. So: a host that runs
a Python function from a git push, and object storage with no egress charge for
pulling the take back down. Proposal: **Vercel** for the function (Python on Fluid
Compute; the CLI is already installed) and **Cloudflare R2** for the bucket (S3 API,
free egress, ten gigabytes free — a few thousand frames). Backblaze B2 is the
equivalent alternative. Neither choice is load-bearing; both are a day to swap.

**Pulling the take back.** A `tools/corpus-pull` script (rclone against R2) syncs new
prefixes into `data/labels/raw/`, after which the existing pipeline applies. The
contributor's on-device OCR reading and confirmation arrive in the manifest, so
drafting a fixture starts from a confirmed accession rather than from nothing.

---

## 5. Getting it onto phones

The Mac is not in the loop. That is the whole reason to do this with TestFlight, and
it is also a real advantage: no Intel build times, no Xcode clicking, and installs
from anywhere, including a tester's city.

**EAS Build → EAS Submit → TestFlight.** Expo's cloud build service compiles the iOS
app (including the local Vision module — it is an ordinary Expo module and autolinks)
and submits it to App Store Connect. What it needs: `eas.json` with a `preview` profile
for internal builds and a `production` one for external; an App Store Connect API
key, created on the web (works from a phone), so submission never waits on
interactive two-factor; and an Apple Developer Program membership, which is the
gate.

**The gate.** TestFlight is unavailable to a free Personal Team; it requires the paid
Developer Program. D29 recorded that the signing team is the personal account and
left open whether it is paid. Xcode's cached account data on this machine does not
list team `Q52822X522`, so the question can't be answered from here. If it is paid,
everything below can start tonight. If it is not, enrolling takes a day or two of
Apple's time, and the first TestFlight build waits on it.

**Internal versus external.** Internal testers — App Store Connect users on the team,
up to a hundred — get a build minutes after it finishes processing, with no review.
Doug is an internal tester. External testers get a public link or an email invite and
the *first* build waits on Beta App Review, typically about a day; later builds are
usually approved within minutes. So the multi-city testers see the build roughly a day
after it is submitted, once, and thereafter promptly.

**Expo's side.** `eas-cli` is not installed; `npx eas-cli` works. The account is
logged in as `birdinternet`. The free plan's build quota is enough for a beta but
builds queue; expect fifteen to twenty-five minutes per iOS build. A first EAS build of
a project with a local native module is a plausible place to lose an evening, which
matters for §6.

---

## 6. Tomorrow at the Met

Two versions of tomorrow, and the right plan prepares both.

**The Met is the right venue regardless.** It is the highest-scoring venue by §11's
criteria — a public collection API, which is what produces the first *verified*
fixtures in a corpus that is entirely `label_only` so far; several accession formats in
one building; and tombstone conventions across dozens of departments. Its entrance
policy (pay-what-you-wish for New York State residents and NY, NJ, and CT students,
fixed admission otherwise, ID required) is precisely the §9.6 eligibility data, and
it is on a sign. `data/venues/met.json` should exist before the visit.

**If the gate is open tonight.** Build the §7 F0 scope, run the first EAS build, and
submit to TestFlight internally; install on the phone in the morning. Use it for a
subset of the take and the stock camera for the rest — that comparison *is* the A1
milestone test, and it is more useful than a whole day on an untested build. Hard
rule: if the build is not on the phone by the time the doors open, it is a stock
camera day, no exceptions, and the app is used the visit after.

**If the gate is closed.** Enroll tonight; tomorrow is a stock camera day under the
protocol, with the Met API check as its goal. Nothing about this plan changes except
which visit gets the first build.

Either way, tomorrow's frames arrive by USB, not by chat.

---

## 7. Milestones

**F0 — one collector, no server.** The capture flow for all three inputs, label
groups with enforced pairing, accession read-back and confirmation, group flags and
hard-case tags, venue from GPS against the registry with add-venue, the manifest, and
camera-roll save. Export the manifest through the share sheet. Everything runs with
the phone in airplane mode. This is the build that clears A1's milestone, and it is
the one that can plausibly exist by tomorrow if the gate is open.

**F1 — many collectors.** The consent screen; the contributor ID; face blur in the
native module; the ingest service and bucket; the upload queue; `eas.json` and
external TestFlight; a one-page tester guide distilled from the protocol for people
who will not read the protocol; the registry seeded for each tester's city.

**F2 — closing the loop.** `tools/corpus-pull`; fixture drafting from manifests;
verification against the Met's and other public APIs; the tester's hard-case tags and
free text feeding the protocol's table; a "what was hard" prompt at the end of a
session, in the app's voice.

---

## 8. Decisions this plan needs

Proposals, mine, not yet accepted. Each becomes a D-entry when Doug settles it.

1. **Corpus contributions are a fourth data class**, alongside `private`, `canon`, and
   `published`: their own consent (three D28-style properties), their own store (the
   private bucket), their own credential. Not the learner's private layer, not the
   canon. This is the one that shapes everything else.
2. **For contributed frames, "raw" means as-uploaded**, with on-device face blur as
   part of the act of capture. The blur count is recorded; the unblurred frame never
   exists off the phone.
3. **Contributors are pseudonymous by construction.** Device-generated ID, no accounts,
   the mapping to people kept off every server.
4. **Ingest is FastAPI on Vercel with R2 as the bucket**, write-once, no database until
   B1. Or the equivalents; the shape matters more than the vendors.
5. **Distribution is EAS Build and TestFlight.** Local Xcode builds remain for native
   debugging only.
6. **What contributors are licensing.** The code is GPL-3.0; the fixtures — the
   transcriptions contributors help produce — are data, and §13 already floats CC-BY
   for published data. The consent screen has to say what the transcriptions are
   released under, so this needs an answer before the first external tester, not after.

---

## 9. Open questions for Doug

- Is the Apple account a paid Developer Program membership? (§5, the gate.)
- Who are the testers, roughly how many, and in which cities? The registry seeding and
  the number of external invites follow from this.
- Is a small monthly hosting and storage cost acceptable for the beta, or should the
  stack stay inside free tiers? Free tiers cover it; the question is whether that is a
  constraint to design for.
