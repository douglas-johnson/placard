# Decisions

Architectural calls that are **settled**, with the reasoning that settled them.

PLANNING.md §13 is the list of what's still open. This file is where things move to
when they stop being open. The point is that a decision made in conversation and left
in a transcript is a decision that will be re-litigated in three months.

**Format:** newest last. Record the reasoning, not just the outcome — a decision
without its reasoning can't be revisited intelligently when circumstances change.

---

## D1 — Track A leads; B0 splits

**Date:** 2026-09-16 · **Status:** accepted · **Supersedes:** PLANNING.md v0.8 §11

v0.8 sequenced B0 (a hand-built NYC free-art research calendar) before everything,
then Track B, then Track A.

Two things changed that:

1. An existing aggregator already publishes an NYC exhibition calendar (§12), so
   the calendar half of B0 is largely redundant. Its research value is available by
   reading that site and §12.2.
2. The half of B0 that *isn't* redundant — the ground-truth label corpus — is the
   irreplaceable asset, and it needs nothing but a phone and an afternoon.

**Decision:** B0's corpus half becomes **A0** and leads. Track A follows. Track B
continues in parallel but is paced by A2 rather than racing ahead.

**Reasoning.** Track A's behavioral risk is retired by A0, not A1 — if the builder
won't photograph labels with no app at all, no capture UI fixes that. Track B's
operational risk is partly retired for free by an existing aggregator having run the
Rung 1 scraper daily and succeeded. And §4's extraction pipeline carries the real technical
risk and the longest learning curve, so starting it early is worth more than
sequencing neatly.

**What would reverse this:** the label corpus turning out to be thin or the extraction
intractable. v0.8's instinct — find that out before committing months — still holds.

---

## D2 — Corpus collection starts with a stock camera, not the app

**Date:** 2026-09-16 · **Status:** accepted

The capture app is not a prerequisite for capturing. `docs/capture-protocol.md` makes
a stock iPhone camera sufficient, and `tools/ocr/` processes the take afterward on the
Mac using the same Apple Vision framework the app will eventually use on-device.

**Reasoning.** The corpus is an input to designing the app, not an output of it. Real
labels teach things a desk can't: how often accession numbers are absent, that glare
dominates the failure modes, that vinyl lettering has no label edge to detect. Blocking
collection on a working build — especially a device build on an Intel Mac — would have
cost a usable afternoon and taught nothing.

It also gives A1 a concrete first milestone: **the app has to beat the stock camera
at collecting the corpus.** That's testable in a way "a capture screen exists" isn't.

---

## D3 — Vision OCR runs as a Mac CLI before it runs on-device

**Date:** 2026-09-16 · **Status:** accepted

`tools/ocr/main.swift`, built into `placard-ocr` — a standalone Swift CLI, built with
`swiftc`, no Xcode project.

**Reasoning.** Same framework, same recognizer, no app plumbing, no code signing, no
device provisioning. It makes the corpus processable the day it's collected. When the
on-device path is built it will be the same `VNRecognizeTextRequest` configuration, so
this is a prototype of the real thing rather than a throwaway.

Two configuration choices worth keeping when it moves on-device:

- **`usesLanguageCorrection = false`.** Language correction "fixes" artist names and
  accession numbers into ordinary English words, which is precisely wrong here.
- **Explicit reading-order sort.** Vision returns observations in no guaranteed order.
  A tombstone label is only meaningful top-to-bottom, and §4.2's whole argument is that
  the label is a *known form* — which is only exploitable if line order is preserved.

---

## D4 — Raw photographs are not committed; fixtures are

**Date:** 2026-09-16 · **Status:** accepted

`data/labels/raw/` and `data/labels/derived/` are gitignored. `data/labels/fixtures/`
and `data/venues/` are committed.

**Reasoning.** Raw is gigabytes of binary and is regenerable only by going back to the
museum — so it needs backup, not version control. Derived is regenerable from raw by
running the pipeline; anything in there that *isn't* regenerable belongs in fixtures.
Fixtures are small, hand-verified, and are the actual asset — they need history,
review, and diffs.

Corollary: raw is **immutable**. No cropping, rotating, or renaming. A tidied corpus
makes every evaluation optimistic about conditions the app will actually meet.

**Amendment (2026-09-20, the Met).** One exception, and it is the only one: a frame
that identifies a minor is deleted from `raw/` the day it's found, its OCR is stripped
from the manifest (the record stays, marked `redacted`, so replay and sequence numbers
hold), and `derived/` is regenerated. The first case was a P.S. Art label carrying a
child's name, grade, school and teacher. The immutability rule exists so that nobody
tidies images to flatter the pipeline; a child's name is not that case, and reading the
rule as forbidding the deletion would put a corpus convention above the one thing the
project promises never to hold. The capture protocol now says not to shoot such a label
in the first place, and `data/README.md` (*Minors*) says what a fixture for that group
may contain — the work and the wall text, and no name. This amendment is the settled
answer; it does not get re-argued per case.

---

## D5 — Dates are stored as EDTF, everywhere, from the start

**Date:** 2026-09-16 · **Status:** accepted · **Source:** PLANNING.md §4.5

Art dates are fuzzy — "about 1620", "1620–25", "before 1640", "17th century". EDTF
(ISO 8601-2) has syntax for uncertainty (`1620?`), approximation (`1620~`), and
intervals (`1620/1625`).

**Reasoning.** Storing `1620` as an integer silently loses the *about*, and that loss
propagates into a curriculum that speaks with more confidence than its evidence
supports. This is cheap now and expensive later, so it applies to fixtures from the
first record — before there's a database to migrate.

---

## D6 — Private GitHub repository

**Date:** 2026-09-16 · **Status:** superseded by D32

The original repository was private.

**Reasoning.** PLANNING.md §12 at the time catalogued a specific existing aggregator's
data-quality problems and §12.5 discussed how to approach them. That analysis is fair
and is intended to be *offered* to them, but discovering it in a public repo before
that conversation happens is the single most reliable way to make the conversation
impossible.

Revisit once outreach has happened. Parts of this — the venue registry, the eligibility
model, arguably the fixture schema — are plausible public goods.

*D32 resolved this the other way round: the analysis left the repository instead of
the repository staying private.*

---

## D7 — The app requests only the permissions it uses

**Date:** 2026-09-16 · **Status:** accepted

Expo's config plugins add default permission strings for everything their module
*could* do. Out of the box `apps/learner` asked for the microphone, motion activity,
background location, and read access to the whole photo library — all with generic
`Allow $(PRODUCT_NAME) to ...` copy — none of which this app uses.

**Decision:** every unused permission is switched off explicitly in `app.json`
(`microphonePermission: false` and so on, which makes `@expo/config-plugins` delete the
key rather than fall back to its default). The Info.plist carries exactly three
entries, each with copy written for this app. `barcodeScannerEnabled` is off too, which
also drops a pod nothing here uses.

**Reasoning.** This is a §5 question before it's an App Store question. The permission
sheet is the first legible promise the app makes, and an app whose pitch is *your
photos and notes never leave the device* cannot open by asking for the microphone and
background location. Generic boilerplate copy compounds it — the strings should explain
why, in the app's own voice (§1).

**Standing rule:** when adding an Expo module, check the generated Info.plist and turn
off what the app doesn't use. The default is permissive and it is never silent about it
in the place users look.

**Refinement (2026-09-19, first TestFlight delivery).** Apple rejected build 3 with
ITMS-90683: `NSMotionUsageDescription` missing. The app never asks for motion data,
but `expo-location` links CoreMotion, and Apple's check is static — a *referenced* API
needs a purpose string whether or not it is ever called. So the Info.plist now
carries a fourth entry, and the string says plainly that Placard does not use motion
data and that a library it includes is why the notice exists. A purpose string is
not a permission request: the sheet only appears if the API is called, and it is
not. The standing rule holds; this is the one case where "off" is not an option.

---

## D8 — Local development builds are practical on this Intel Mac

**Date:** 2026-09-16 · **Status:** accepted · **Supersedes:** the caution in D2/D3 about build cost

Verified end to end rather than estimated: `expo prebuild` → `pod install` (91
dependencies, CocoaPods 1.17.0 on Ruby 4.0.6) → `xcodebuild` → install and launch on
the iOS 26.5 simulator. **`** BUILD SUCCEEDED **`, zero errors, 4m38s, `x86_64`
binary.**

**Reasoning it matters.** A1's Vision OCR module needs a custom native module, which
Expo Go cannot load, so a development build is on the critical path. The earlier worry
was that Intel would make that loop too slow to iterate in. It doesn't: React Native
0.86 ships its core as prebuilt xcframeworks, so almost nothing of RN compiles — only
Expo's Swift glue and app code.

**Consequence:** no need for EAS or a cloud builder to work on the capture app. The
constraint that remains is the *device* build for real camera work, which is a signing
and provisioning question rather than a compile-time one.

The stock-camera protocol still stands until the app clears the bar in
`apps/learner/AGENTS.md` — D2's reasoning was never about build speed.

---

## D9 — Vision's OCR confidence is not a correctness signal; geometry is

**Date:** 2026-09-16 · **Status:** accepted · **Amends:** PLANNING.md §4.7

The first real label, photographed at MCNY, settled a question the confidence ladder in
§4.7 had left open. Vision returned **1.00 confidence on lines that were plainly wrong**:

```
1.00  hese dual crises laid bare so        ← lost the "t"
1.00  /ulnerabilities, with the toll of    ← the "v" became "/"
1.00  re 700 meals in dai                  ← truncated at both ends
```

Vision is reporting how sure it is about the glyphs *inside the frame*. It has no
opinion about the ones outside it, and a clipped line produces a confident,
plausible-looking, wrong result. That is the worst possible failure shape for this
project, because §4.7 ranks label extraction as "high confidence" and a wrong value
that looks right propagates silently into the graph.

**Decision:** OCR confidence is never used as a quality gate. Truncation is detected
**geometrically** — a line whose bounding box runs into a frame edge is flagged as
probably clipped. `tools/ocr` now emits a `clipped` array per observation and a
per-photo `warnings` list.

On the test set this caught every truncated line and cleared every good one, including
the accession line. It also produced one false positive, on a line starting at the
panel's own left margin within the 0.01 tolerance. False positives route to review and
are the safe direction; the threshold should be tuned once there's a real corpus.

**The general rule this is an instance of:** a model's self-reported confidence
describes its certainty about the input it received, not about the input it should have
received. Framing, occlusion, and cropping are invisible to it. Any signal of that kind
has to come from outside the model.

---

## D10 — A label is not always a tombstone

**Date:** 2026-09-16 · **Status:** accepted · **Amends:** PLANNING.md §4.2

§4.2 assumes the tombstone is "a known form" — artist, nationality and life dates,
title, date, medium, credit line, accession. MCNY's photography galleries don't use one.
They use a **combined panel**: an interpretive essay, a horizontal rule, then a caption
block. There is no separate tombstone anywhere on the wall.

The caption block does have a form, but a different one:

```
Compassion in Action: Tzu Chi volunteers      ← title, bold italic
prepare 700 meals in darkness, Manhattan
2012                                          ← date
Photograph by Peter Lin                       ← creator, with role named
Museum of the City of New York                ← owning institution
Gift of Peter Lin, 2014.21                    ← credit line + accession
```

No medium. No nationality or life dates. The creator's role is stated in prose
("Photograph by") rather than implied. But the §4.2 claim that survives intact and
matters most is the last line: **the accession number is fused onto the end of the
credit line**, exactly as predicted.

**Decision:** the layout parser handles *multiple* label dialects, selected per venue
from the registry, rather than one tombstone grammar with exceptions. `data/venues/`
carries a `labels.format` field for this.

**The useful consequence:** the horizontal rule is a structural landmark worth
detecting, since prose and fields go down completely different pipelines (§4.6).

### Correction, same day — what the rule actually marks

A second MCNY label (`mcny-56.323.46`) showed the first reading was wrong. There the
rule sits at the **top**, followed by the caption, followed by the essay:

```
────────────────────────────────           ← rule
United Nations Building 1956               ← title + date, ONE line
Photograph by Samuel H. Gottscho (digital reproduction)
Museum of the City of New York
Gift of Gottscho-Schleisner, 56.323.46     ← credit + accession
                                           ← blank
The completion of the United Nations headquarters along the
East River in 1952 confirmed New York's postwar global status. ...
```

Re-reading the first label with that in mind: the prose *above* its rule was the
**exhibition's** introductory text — about COVID and the racial justice protests — not
that object's essay at all. The rule was the top boundary of the object's block both
times; the first photograph just happened to catch the end of the gallery intro above it.

**Corrected model:** the rule marks the **start of an object's label block**, and the
order within it is caption, then optional interpretive essay. Not a separator between
two kinds of text.

The lesson is about method rather than typography: one sample produced a confident,
tidy, wrong structural claim, and the second sample inverted it. Structural conclusions
need at least two objects **from different walls** before they go in the venue registry
as anything but a hypothesis.

---

## D11 — Accession patterns are hypotheses until several samples agree

**Date:** 2026-09-16 · **Status:** accepted

The MCNY registry entry was written from one label, `2014.21`, as
`^\d{4}\.\d+(\.\d+)?$`. The very next label was `56.323.46` — two-digit year, three
components — which that pattern rejects.

**Decision:** `accession_formats` in `data/venues/` holds a list of observed patterns,
each with `sample_count` and the examples it was derived from. A pattern with
`sample_count: 1` is never used to *reject* a candidate reading, only to rank it. The
parser prefers a known pattern but must accept an unfamiliar one, flagged for review.

**Reasoning.** §4.3 argues for tuning accession recognition hard per institution,
because "each institution has a recognizable format, which you know because you know the
venue." That's right in direction and too optimistic in degree. A museum with a century
of accessioning has *several* formats — MCNY's are plausibly a two-digit-year scheme
from the 1950s and a four-digit one used now. A parser that hard-rejects on a
single-sample regex will silently drop the oldest and most interesting holdings.

The failure is asymmetric, which is what decides it: accepting an odd accession costs a
review-queue entry, while rejecting a real one loses the primary key and drops the
object to the §4.3 degraded path for no reason.

---

## D12 — What hangs on the wall is not always the catalog object

**Date:** 2026-09-16 · **Status:** accepted · **Affects:** §4.3, §4.6, §7

The UN Building label reads:

> Photograph by Samuel H. Gottscho **(digital reproduction)**

The print on the wall is a modern digital reproduction. The accession number
`56.323.46` identifies the *original* in MCNY's collection. Those are two different
objects, and §4.3's whole move — dereference the accession to get the catalog record —
silently conflates them.

It matters more than it looks. The learner's encounter (§5 `encountered`) happened with
the reproduction; the catalog facts, dimensions, and provenance belong to the original.
Recording the encounter against the original is a small lie that makes "I have seen
this" mean something different from what the learner did.

**Decision:** capture a `displayed_as` qualifier on the encounter — `original`,
`digital_reproduction`, `facsimile`, `cast`, `later_print` — separate from the
identity resolved by the accession number. The event-centric model in §4.6 already has
the right shape for this: the reproduction has its own Production event, and it stands
in an `is_reproduction_of` relation to the original.

**Also worth noticing, on the same label:** the credit line is "Gift of
Gottscho-Schleisner", an architectural photography *firm*, while the creator is a
person. Donor and creator are different entity types, and a naive parser that reads
credit lines as personal names will produce a false person node for every firm, estate
and foundation that ever gave a museum anything.

---

## D13 — A photograph of a building carries two dates, and they are both right

**Date:** 2026-09-16 · **Status:** accepted · **Affects:** §4.6, §6.1

The UN label dates the photograph **1956**; its essay dates the building's completion
**1952**. Neither is an error. They describe different events: the Production of the
photograph, and the Production of the thing it depicts.

Flattening those into one `date` field on the artwork would make the graph say the
photograph was made in 1952, or the building in 1956, depending on which won.

**Decision:** dates attach to **events**, never to objects. This is the concrete payoff
of the event-centric model in §4.6 — `Production(photograph, 1956)` and
`Production(building, 1952)` are unremarkable, where a binary `artwork —has_date→ year`
edge has nowhere to put the second one.

**Why it's curriculum-relevant rather than pedantic:** the gap between the two dates is
often the whole point. A 1956 photograph of a 1952 building is a document of how the
postwar city wanted to be seen, and that reading is only available if both dates
survive. This is exactly the lateral, story-carrying material §4.9 says to prioritize
and §6.1 uses to close triangles.

---

## D14 — OCR output is Unicode, and the primary key must be folded before matching

**Date:** 2026-09-16 · **Status:** accepted · **Affects:** §4.3, §4.5

On an MCNY label the accession `38.447.4` came back as:

```
Gift of Mrs. J. Percy Sabin, 1938. (38.447•4)
                                          ↑
                                   U+2022 BULLET, not U+002E
```

Confidence 1.00. No clipping. **Neither quality signal this project has would ever
catch it** — D9's geometry check sees an intact line, and confidence is meaningless
(D9 again). The failure is total and silent: `38.447•4` matches nothing in any catalog,
so §4.3's entire dereference path — the thing the whole identification design rests on
— fails, and fails looking exactly like a success.

**Decision:** `tools/ocr` now emits `normalizedText` alongside `text`, folding
confusable punctuation to ASCII, and flags `wasNormalized` per line. **Anything
pattern-matched is matched against the normalized form.** The raw string is kept,
because knowing the glyph was ambiguous is itself evidence about the label.

**Reasoning, generalized.** A recognizer returns Unicode, and a small glyph in a serif
face can resolve to any of a dozen near-identical codepoints — bullet, middle dot, dot
operator, fullwidth stop. Humans reading the output can't see the difference either,
which is what makes this class of bug survive review. Every downstream identifier
comparison in this project — accession numbers above all, but also EDTF dates and
controlled-vocabulary lookups — needs a restricted character set at the boundary.

This one finding justifies the fixture corpus on its own. It is not discoverable from a
desk, it would have surfaced as "our accession lookups mysteriously miss sometimes"
months into B1, and it cost one afternoon to find.

---

## D15 — Pairing comes from shot order, not from content

**Date:** 2026-09-16 · **Status:** accepted · **Affects:** `docs/capture-protocol.md`, A1

The first two test triplets suggested an easy heuristic: the work photo returns zero
OCR lines, the label photo returns many. Sort the take by that.

The third killed it. *Liberty Triumphant* is an 18th-century engraving covered in text —
engraved title, place names, speech banderoles, a numbered key explaining the allegory.
The **work** photo returned **41 lines**:

```
LIBERI "RIUMPIAN I;orthe Downfall of OPPRESSION.
Jono,and let not thairbrave
Delaware Bay
AMERICA
```

Garbage against period engraved script, but 41 lines of it — more than either label
photo produced.

**Decision:** work/label pairing is established by **capture order**, per the protocol,
and never inferred from content. This is why `docs/capture-protocol.md` insists on
strict back-to-back ordering with nothing in between — that constraint is load-bearing,
not a convenience.

**Consequence for A1:** the capture app must *enforce* pairing at the moment of capture
rather than reconstructing it later. Reconstruction is not merely harder, it's
unreliable in principle, because text-bearing artworks are a large and permanent
category — prints, broadsides, maps, manuscripts, conceptual art, most of the twentieth
century.

**A a side benefit worth remembering:** OCR of the *work* is sometimes real content. The
numbered key on this engraving is a legend decoding the allegory — genuinely
curriculum-rich material (§4.9), sitting inside the image rather than on the wall. Worth
returning to once extraction is solid.

---

## D16 — Label dialects are per gallery, not per institution

**Date:** 2026-09-16 · **Status:** accepted · **Supersedes:** part of D10

D10 concluded MCNY doesn't use tombstones. The Revolutionary-era history galleries do —
and in a completely different design from the photography galleries: serif face, white
on aubergine, a **vertical** rule down the left margin rather than a horizontal one on
top, bilingual English and Spanish, and it carries a **medium** line the photography
labels lack.

```
Liberty Triumphant: Or the Downfall of Oppression     ← title, EN
La libertad triunfante: o la caída de la opresión     ← title, ES
ca. 1774                                              ← date, circa marker
Attributed to Henry Dawkins                           ← ATTRIBUTION QUALIFIER
Engraving                                             ← medium
Gift of Mrs. J. Percy Sabin, 1938. (38.447.4)         ← donor, donation year, accession
```

**Decision:** `data/venues/*.json` carries a list of `dialects`, each with the galleries
it applies to. Parser selection is per gallery. Venue-level label assumptions are wrong
often enough to be dangerous.

**What this label gave us, all firsts:** an attribution qualifier (§4.6's prime
curriculum material — *Attributed to* is a claim about uncertainty the museum is making
deliberately, and flattening it to `created_by` asserts something MCNY explicitly
declines to assert); a medium; a circa marker (`ca. 1774` → EDTF `1774~`, D5); an
accession in parentheses rather than bare; and a donation year sitting on the same line
as an accession that begins with the same two digits — `1938. (38.447.4)` — which is a
trap for any parser hunting year-like numbers.

**And the bilingual problem.** Title and essay each appear twice. An extractor taking
"lines before the date" as the title concatenates two languages; one taking "the first
line" silently privileges English. Neither is right without language detection, and this
is New York — bilingual labels will be common, not exotic.

---

## D17 — Loans break the accession strategy structurally, not accidentally

**Date:** 2026-09-16 · **Status:** accepted · **Affects:** §4.1, §4.3

A Champanier mural panel at MCNY has **no accession number anywhere on the wall**. Not a
poor label — the work isn't MCNY's. It is lent from the **NYC Health + Hospitals Arts in
Medicine Collection**.

§4.1's identification design chains: GPS → venue → the venue's catalog → the object.
§4.3 then calls a missing accession "the degraded mode." Both assume the venue owns what
it hangs. A loan breaks the chain at the first link, and it does so for a whole
*category* of object rather than as an edge case: special exhibitions are largely loans,
and special exhibitions are what a learner is most likely to travel to see.

**Decision:** the venue prior narrows the candidate set but never defines it. When a
label names an owning institution different from the venue, resolution re-targets to
that institution, and the lookup key becomes `(owning_institution, title, artist)`
rather than `(venue, accession)`.

**Reasoning.** The information needed is usually *present* — this label names its owner
plainly. What fails is the assumption baked into the plumbing. Recording
`owning_institution` as a first-class field on every extraction, equal in standing to
the accession number, costs nothing now and is the difference between a resolvable
object and a dead end.

**Note for A0:** §11's venue criteria rank "public collection API" highest because it
allows ground-truthing. A loan-heavy special exhibition scores badly on that and is
still worth visiting — it is where the *hard* identification cases live.

**Refinement, same evening — a loan can also *redirect* the chain rather than break it.**
The Brooklyn Daily Eagle in the same visit (fixture `mcny-loan-moaf-894.5`) is lent, and
carries a number: `894.5`, the Museum of American Finance's. So the accession is not
absent; it is in another institution's namespace. The consequence for the model: an
accession number is never a key on its own, only `(owning_institution, accession)` is.
Asking the venue's catalog for a lender's number is worse than a miss — it can return an
unrelated object with full confidence. The credit line ("Lent by …") is what says which
namespace applies, which is one more reason the credit line is parsed, not stored as a
string.

---

## D18 — A label is a system of separated texts, not one object

**Date:** 2026-09-16 · **Status:** accepted · **Amends:** §4.2, §4.6

This one work is served by **four** distinct pieces of wall text, on different surfaces:

| Element | Carries |
|---|---|
| Tombstone | artist, life dates, title, date, medium, extent, owning institution |
| Numbered panel key | per-panel titles and descriptions |
| Artist biography panel | biography and nearly every relationship worth having |
| Exhibition wall text | commission, site, conservation history, curator |

§4.2 treats "the label" as one photographable object. Here the field that resolves
identity (owning institution) is on the tombstone, while the material with actual
curriculum value is on a biography panel that may be around a corner.

**Decision:** an encounter can carry **multiple label captures of different kinds**, each
typed — `tombstone`, `panel_key`, `artist_panel`, `exhibition_text`, `checklist` — and
they are associated with the work rather than each standing alone. The extractor runs a
different pipeline per type.

**Consequence for the capture protocol:** the triplet in `docs/capture-protocol.md` is
too narrow. It assumes work + label. In a single-artist or thematic exhibition the
artist panel is shared across every work in the room and should be photographed **once
per room**, not once per work. That needs saying before the next trip.

**Consequence for A1:** the app cannot model an encounter as one photo plus one label.

---

## D19 — Vision flattens dashes inconsistently, so EDTF must key off pattern

**Date:** 2026-09-16 · **Status:** accepted · **Affects:** §4.5, D5

The label reads `1896–1960` and `1938–1940` with en dashes. Vision returned both with
**U+002D HYPHEN-MINUS**. In the same photograph, one em dash in the Spanish text came
back as **U+2014**, correctly.

So the flattening is real, lossy, and *inconsistent within a single image*.

This is the mirror image of D14. There Vision invented an exotic codepoint where a plain
one belonged; here it flattens meaningful typography to ASCII. Both destroy information,
and no normalization table fixes this direction — the distinction is already gone by the
time the tool sees it.

**Decision:** date parsing never keys off the dash character. `\d{4}\s*[-–—]\s*\d{4}`
is an EDTF interval (`1938/1940`) regardless of which dash appeared; everything else
containing a dash is left alone. The same string shape settles it:

```
1896-1960        → interval, life dates
1938-1940        → interval, work date
16-panel         → compound word, not a date
New Deal-era     → compound word, not a date
Fabzio-a         → flattened em dash in prose, not a date
```

**The general rule, third time now:** anything the pipeline matches on has to be
canonicalized first, and the canonical form has to be *derivable from what survives*.
Typographic distinctions do not survive OCR reliably enough to carry meaning.

---

## D20 — What the learner stood in front of may be part of the catalog object

**Date:** 2026-09-16 · **Status:** accepted · **Extends:** D12

The tombstone describes `Alice of Wonderland Visiting New York, 1938–1940, Oil on
canvas, **16 panels**`. On the wall is **one panel**. One tombstone serves the whole
series; a separate numbered key names each panel.

D12 established that the displayed object may be a *reproduction* of the catalog object.
This is the same failure from a different direction: the displayed object may be a
*part* of it. Recording the encounter against the whole mural claims the learner saw
sixteen panels.

**Decision:** an encounter records the **part encountered** alongside the work it belongs
to. The event-centric model (§4.6) already accommodates this; what's needed is that
extraction not silently discard it.

**And a genuine data contradiction worth preserving.** The tombstone says sixteen panels;
the exhibition text says *"fifteen of the panels were conserved."* Both are true — sixteen
as painted, fifteen surviving. An extractor reducing "number of panels" to one integer
must pick a wrong answer. Extent-as-made and extent-extant are different facts, and for
a WPA mural rescued from an abandoned hospital the gap between them *is* the story
(§4.9).

---

## D21 — OCR is non-deterministic across scale, so the primary key needs corroboration

**Date:** 2026-09-16 · **Status:** accepted · **Affects:** §4.3, §4.4, A1 · **Extends:** D14

A Kubrick label at MCNY carries the accession `X2011.4.10368.168`. Recognition at three
resolutions produced three different answers:

```
native     X2011.4.10368168      ← dropped the separator before 168
~2000px    X2011.4.10368.168     ← correct
~4000px    X2011.410368.168      ← dropped a different one, before 10368
```

Each scale loses a *different* separator. Nothing flags any of them: confidence is 1.00
throughout (D9), no line is clipped, and normalization can't help because the character
was **deleted**, not substituted (unlike D14). Every reading is structurally plausible.

And "shoot closer" is not the fix — past a sweet spot the reading degrades again.

**Decision:** `tools/ocr` runs recognition at several scales by default (1.0, 1.6, 2.4)
and cross-checks. Each observation carries `variants` and a `contested` flag; a
per-photo warning names how many lines the passes disagreed about. `--single-pass`
opts out.

Verified on this label: six of seven lines unanimous, and the accession correctly
flagged contested with both readings surfaced — one of which is right.

**Reasoning.** This is the move the project already makes everywhere else, applied one
level down. §5 promotes a sighting only when independent observers corroborate it; §8.2
builds verification out of agreement between sources. A single OCR pass is a single
observer, and the primary key is exactly the claim least tolerant of being wrong. The
independent observers here are the same recognizer at different resolutions — cheap,
and empirically they fail differently, which is all corroboration requires.

**Consequence for A1, and it settles a design question.** `apps/learner/AGENTS.md` sets
the milestone "read the accession on-device and show it back for confirmation." That was
written as good manners. It is now a requirement: **the machine cannot determine the
accession number reliably on its own**, and consensus narrows the field without closing
it. The human in front of the object is the arbiter, which is also the §4.1 principle —
*ask rather than guess* — arriving from a second direction.

**Open:** whether disagreement should trigger more scales, and whether a token that
never wins agreement should be stored as a set of candidates rather than a value.

---

## D22 — Typographic conventions on labels are data, not decoration

**Date:** 2026-09-16 · **Status:** accepted · **Affects:** §4.2, §4.5 · **Extends:** D12, D16

Two labels in one gallery, three conventions that a naive parser would discard:

**Square brackets mean a supplied title.** `[Union Square Greenmarket]` — the brackets
are cataloguing convention for a title *devised by the institution* because the artist
gave none. Stripping them as punctuation doesn't just lose a nuance; it asserts the
artist named the work when the museum is explicitly saying the opposite. Exactly the
loss as flattening `Attributed to` (D16).

**Parentheses in a title can carry a descriptive second part.** `Shoe Shine Boy (Mickey
and another boy at a hotdog cart)` — a short title plus a descriptive gloss, which
should survive as two fields rather than one string, because the gloss is what makes it
searchable and the short title is what a person would say.

**"Modern print" is a `displayed_as` value.** Both labels carry it, joining "(digital
reproduction)" from D12. So that qualifier now has at least two members and a real
controlled vocabulary is warranted. It also compounds with D13: `1947` dates Kubrick's
**exposure**, while the object on the wall is an undated later print. The date on the
label is not the date of the thing you are standing in front of.

**The general principle, and it keeps recurring:** museum labels are written in a
professional notation. Brackets, parentheses, "attributed to", "circa", "modern print"
are all doing precise work. Every one of them encodes something about *certainty* or
*identity* that the plain text loses, and §4.7's claims model exists to carry exactly
that. A parser that normalizes punctuation away is discarding the most epistemically
loaded part of the label.

**Also, sub-collections exist.** `Museum of the City of New York, The LOOK Collection,
Gift of Cowles Magazines, Inc., X2011.4.10368.168` — institution, then a *named
sub-collection*, then donor, then accession, all comma-separated on one line. Four
entities of three different kinds. A credit-line parser splitting on commas and taking
the last field as the accession happens to work here and will not generalise.

---

## D23 — Not everything with a label is an artwork, and the model has to say so

**Date:** 2026-09-16 · **Status:** accepted · **Affects:** §4.2, §7

A cigar mold at MCNY:

```
Cigar mold   late 19th century
Wood
Museum of the City of New York
Gift from the Estate of Mrs. Pauline Stein, 48.108.14A-B
```

**No artist. No title.** An object *name* and a material. §4.2's tombstone grammar leads
with the artist; §7's canon has `Artwork` and `created_by`. Neither fits a tool.

**Decision:** the canon distinguishes `Artwork` from `Object` — material culture with a
function, a maker who is usually unrecorded, and no title. `created_by` becomes optional
and an object name substitutes for a title. Extraction must not synthesise an artist.

**Why this is not a niche case.** §9.6 argues that New York's free tier skews
contemporary, folk, community-rooted and historical — and observes this is a *feature*,
since a free-weighted curriculum is a different canon rather than a thinner one. Those
venues are exactly the ones full of unauthored objects. A data model that only holds
authored artworks quietly makes the free-weighted graph the thin one, which is the
outcome §9.6 was betting against. Handling unauthored objects properly is load-bearing
for that argument.

**And the curriculum value is real.** This mold's label explains that its invention in
the 1860s let employers move cigar production into tenements with unskilled family
labour, while Gompers's unionised rollers kept the skilled work — the object *is* the
mechanism of a labour-history argument. §4.9's test is whether an edge can carry a
story. This one carries more than most paintings.

**Two smaller field types this label also forces:**

- **`estate` as a donor type**, after person and organization. "Gift from the Estate of
  Mrs. Pauline Stein" names a legal entity standing in for a deceased person; an
  extractor grabbing the last personal name invents a living donor.
- **Period-phrase dates.** "late 19th century" is neither a year nor a year range. EDTF
  can express it, but only behind a vocabulary that maps the phrase — and it is a
  different problem from "ca. 1774" (D16), which is a year with an approximation marker.

---

## D24 — Accession suffixes describe physical parts, and cases mix ownership

**Date:** 2026-09-16 · **Status:** accepted · **Extends:** D20, D17

**`48.108.14A-B`.** The mold is two halves, plainly visible in the photograph. `A` and
`B` are those pieces. Two wrong moves are both tempting: stripping the suffix to
`48.108.14` identifies a different thing, while treating the whole string as opaque
loses that the object has parts.

**Decision:** an accession is stored whole *and* parsed into `base` plus
`component_suffix` where one is present. The suffix is structural information about the
object, not formatting. This is D20's part/whole problem again — encoded in the primary
key this time rather than in prose.

**And one vitrine holds objects of mixed ownership.** The same case panel lists a Riis
photograph and a lithographed cigar box owned by MCNY with accessions, alongside a
cigar box, a lapel button and a stereo card marked only *private collection* — no
accession, no institution, nothing to dereference.

So D17's loan problem is not confined to loan exhibitions. **A single case interleaves
objects that resolve and objects that cannot**, and the only honest response is for the
extractor to record `owner: private, accession: none` and stop, rather than reaching for
the nearest accession on the panel — which in a dense case is a neighbouring object's.

**A capture note that follows.** This panel was shot from far enough back to include an
adjacent panel serving entirely different objects: 24 of 64 lines flagged as clipped,
nearly all from the intruder. The clipping detector (D9) did its job, but the deeper
point is that in a crowded vitrine, *framing decides which object you are documenting*.
One panel per frame.

**OCR note, confirming D21 beyond the accession line.** Multi-scale consensus caught
word-boundary loss here — `American Federation ofLabor`, `Museum ofthe City of New
York`, `foundedthe` — with the correct reading among the variants each time. Dropped
spaces join dropped and substituted separators as a third silent corruption mode, and
consensus catches all three.

---

## D25 — Eligibility has granularity, and the finest grain is the most identifying

**Date:** 2026-09-16 · **Status:** accepted · **Affects:** §9.6 · **Source:** MCNY's own entrance signage

```
Free on Wednesdays
Always free for 10029, 10035, 10037
```

§9.6 lists the eligibility dimensions: state residency, city residency, age bands,
student and faculty status, institutional affiliation, membership, SNAP/EBT, veteran or
active military, teacher, disability access, library card.

**ZIP-code residency is not on that list**, and it is much finer than "city resident."
Those three ZIPs are the museum's immediate neighbourhood. It is a *neighbours free*
policy, and it is a different kind of condition from the ones the plan anticipated.

**Decision:** geographic eligibility is modelled with an explicit granularity —
`country` / `state` / `city` / `borough` / `zip` — rather than as a flat set of
audience labels.

**The privacy consequence sharpens §9.6 rather than complicating it.** §9.6 already
argues the eligibility profile must never leave the device, reasoning from SNAP/EBT as
an income proxy. ZIP-level residency makes the point more general: **the finer the
geographic grain, the more identifying the profile.** "NY State resident" is nearly
nothing; "resident of 10029" is a neighbourhood, and combined with a visit history it is
close to a person. A server that learned which ZIP rules a user matches would be
accumulating home-neighbourhood data on everyone who turned the feature on.

So `freeForMe(rule, profile)` running on the client isn't just the safer of two options.
It is the only version of this feature that can be offered without asking people to
disclose where they live in exchange for a discount.

**Two structural findings from the same sign, both saying the model needs optionality:**

- **`window` must be optional.** "Free on Wednesdays" has no time restriction — the whole
  opening day. MoMA's "Friday 17:30–20:30" does. Both are `free_window` rules.
- **`recurrence` must be optional.** "Always free for 10029…" has no temporal condition
  at all. One sign exercises both ends of the model.

**And accessibility is two different facts.** "Ramp access on 104th St" is a
*reachability* property of the venue (§6.6) — the Fifth Avenue entrance is up a flight of
marble steps — and is unrelated to any admission concession for disabled visitors. §9.6
lists "disability access" once, among eligibility dimensions. It needs to appear twice:
once as a condition a person may meet, once as a physical property of the building. A
learner who uses a wheelchair needs the second one whether or not they qualify for the
first.

---

## D26 — The first §9.6 data arrived on the §11 A0 trip, and that is worth exploiting

**Date:** 2026-09-16 · **Status:** accepted · **Affects:** §11

D1 split B0, sending the label-corpus half to A0 and treating the free-art calendar half
as largely redundant now that an aggregator already covers it. That reasoning holds
for *listings*. It does not hold for **admission and eligibility**, which §12.3
identifies as one of the four things the existing aggregators do not do at all.

Today's trip produced both: seven label fixtures *and* the first structured access rules
in the project, photographed off the museum's own board on the way out.

**Decision:** every A0 visit also captures the venue's entrance signage — hours,
admission, free windows, accessibility. It costs one photograph and it is the only
first-hand source for the §9.6 layer.

**Reasoning.** §8.2 says access policy is verified by *dereferencing the authority*, and
the institution is definitionally that authority. A photograph of the museum's own sign
is about as close to the authority as it gets, better than a scraped page and far better
than an aggregator. §11's B0 notes made this exact point with the MoMA example — three
aggregators, three different answers, only the museum's own site correct.

**Confirmed today:** §11 listed "Museum of the City of New York on Wednesdays" as a free
window. That was a starting hypothesis the document explicitly said to verify before
going. It is now verified first-hand, and is the first item from that list to be checked
against the institution itself rather than against another aggregator.

---

## D27 — Homoglyph substitution is not limited to punctuation

**Date:** 2026-09-16 · **Status:** accepted · **Extends:** D14

Vision returned `СТY` for `CITY` on an English-language sign, with `en-US` as the only
recognition language. The characters are **U+0421 CYRILLIC CAPITAL LETTER ES** and
**U+0422 CYRILLIC CAPITAL LETTER TE**.

D14 folded confusable *punctuation*. This is the same failure one character class up,
and the stakes are identical: a Cyrillic Х inside `X2011.4.10368.168` is invisible to a
human proofreader and matches nothing in any catalogue.

**Decision:** `normalize` also folds Cyrillic and Greek letters that are visually
identical to Latin ones — but **only inside a token that already contains ASCII
alphanumerics**. A genuinely Cyrillic or Greek word on a multilingual label passes
through untouched, while `СТY` and a Cyrillic letter inside an accession number do not.
That conditionality matters because New York labels really are multilingual (D16) and a
blanket fold would corrupt them.

**The recurring lesson, now the fourth time:** every stage between the glyph and the
match is lossy in a way that produces *plausible* output. Confidence doesn't see it
(D9), geometry only catches truncation (D9), normalization catches substitution but not
deletion (D14, D21), and consensus catches inconsistency but not a systematic error every
pass shares. Each mechanism covers a different failure, and none of them is optional.

---

## D28 — Photo upload is opt-in, per purpose, and is not the same question as promotion

**Date:** 2026-09-16 · **Status:** accepted · **Decided by:** Doug · **Corrects:** an overstatement of mine in `apps/learner/AGENTS.md`

### What was wrong

I had written that photos "never leave the device." PLANNING.md does not say that.
§3 says no learner sees *another learner's* photos. §5 says photos never *promote* to the
shared canon. §8.5 explicitly contemplates learner photos with "explicit per-photo
opt-in, strip EXIF." I collapsed three different rules into one absolute and then
repeated it as a hard constraint.

### The distinction

**Processing for the learner is not promotion to shared knowledge.**

§5's tiers govern what becomes *shared*. They are silent on where the private layer is
stored and on whether the service may analyse a learner's own material on their behalf.
An uploaded photo, analysed to expand that learner's path, never enters the canon — only
derived objective claims do, under §5's existing corroboration rules.

### The decision

**Sending artwork photos to the service is opt-in.** Telemetry and PII never accompany
them.

**Why it's worth having**, and this is the product argument: an embedding can rank
candidates, but a model looking at the actual image can read condition, framing, what is
depicted, and how it relates to other works. That is material the label does not carry
and the catalogue often does not either — which is to say, it is exactly the lateral,
story-bearing material §4.9 wants and §6.1 uses to close triangles. Declining to look at
the image forecloses a real source of curriculum.

### What stays absolute

- **§8.5 is unchanged and becomes more important, not less.** The back office has no read
  path to the private layer. Server-side photos make that harder to hold, which is the
  argument for enforcing it with separate schemas and credentials (§10) rather than
  application code.
- **No learner-to-learner visibility**, ever.
- **Nothing new promotes.** Analysis outputs about the *artwork* may become canon claims
  under the normal §5 filter — corroborated, de-identified, day-coarsened. Anything about
  the *learner* does not.
- **The eligibility profile still never leaves the device** (§9.6, D25). ZIP-level
  residency is close to a home address; that one is not a toggle.

### Hazards this creates, and how they're handled

**Bystander faces.** §4.1 observes that gallery photos come "with heads in the frame."
Those people did not opt in and the learner cannot consent for them. "No PII" protects
the learner and says nothing about third parties. Detect and blur faces **on device,
before upload** — not server-side, because server-side means the unblurred frame was
already transmitted.

**The upload set is itself a profile.** Even with zero telemetry, a run of photos with
venues and objects is an interest profile and a movement history. This is not an argument
against the feature; it is an argument about storage. Photos are learner-keyed, never
joined across learners, and live in the `private` schema whose credential the back office
does not hold.

**Deletion must reach derived artifacts.** Embeddings, model outputs and cached analyses
outlive the photo unless deletion is defined to include them. Decide it now: deleting a
photo deletes everything derived from it, except canon claims that have already been
corroborated by other learners and de-identified — those are no longer about this person.

**Granularity: label photos and artwork photos are different.** A label photo is public
information the museum printed for everyone, contains no bystanders, and is the
higher-value capture for identification anyway (§4.2, §4.3). An artwork photo carries
framing and bystanders. They are **separate properties in the permissions model** —
`upload.label_photos` and `upload.artwork_photos`, each with its own consent record —
so the data layer can never conflate them. Whether they surface as two toggles or one
grouped control is a UI decision, deferred; the model must not be the thing that forces
that choice later.

### Open

- Is label-photo upload default-on, given it is public information? Arguable either way;
  defaulting anything on deserves more care than defaulting it off. Separate properties
  make this askable per kind rather than once for both.
- Whether the two properties are presented as separate toggles (see above).
- Retention period for uploaded originals once analysis is complete.
- Whether analysis runs once at upload or can be re-run later as models improve — the
  second is more useful and implies keeping originals longer.

---

## D29 — The device development build works; it is signed with the personal Apple account

**Date:** 2026-09-16 · **Status:** accepted · **Closes:** the provisioning question D8 left open

D8 verified the development build on the simulator and said the remaining question was
signing for a real device. Verified today: `expo run:ios --device` builds, installs, and
launches on the iPhone 16 (iOS 26.6), and the preflight reports **Host: development
build** with camera and location permission granted. The build compiles at simulator
speed, since the same prebuilt React Native xcframeworks carry a device slice.

**Signing uses the personal Apple account.** Xcode's cached team
list still carried an employer team from a signed-out account, and I put that into
`app.json` first. It is wrong for this project and must
not come back: Placard is a solo project and its App ID belongs under the personal
account. `ios.appleTeamId` in `app.json` is the one place the team is set; prebuild
writes it into the Xcode project from there.

**Four one-time steps that are not in any Expo doc together**, in the order they bit:

1. **Developer Mode** on the phone (Settings → Privacy & Security), which restarts it.
   `xcrun devicectl device info details` reports `developerModeStatus`.
2. **First provisioning needs Xcode, not the CLI.** `expo run:ios` does not pass
   `-allowProvisioningUpdates`, so with no certificate or profile it fails. Selecting
   the team in Xcode's Signing & Capabilities once creates the certificate, registers
   the device, and writes the profile; every build after that works from the CLI.
3. **Decline Xcode's "update to recommended settings."** It sets
   `ENABLE_USER_SCRIPT_SANDBOXING = YES`, and React Native's bundle script writes
   `ip.txt` into the app bundle on *device* builds only (so the phone can find Metro),
   which the sandbox denies. The simulator build never exercised this path, which is
   why D8 didn't see it. `ios/` is regenerated by prebuild and doesn't carry the flag.
4. **Trust the developer profile** on the phone (Settings → General → VPN & Device
   Management) before first launch; the install succeeds and the launch fails with a
   "Security" error until then.

**Consequences.** `expo-dev-client` is now a dependency, so the device build has a
launcher and a dev menu and finds Metro the way Expo Go did — `npx expo start
--dev-client`. Expo Go remains the faster loop for pure JS work and still runs the app
until the Vision module exists; after that the development build is the only host.

If the personal account is a free Personal Team, the installed app expires after
seven days and needs a rebuild. Not a problem for A1; noted so the expiry isn't
mistaken for a regression.

---

## D30 — OCR runs on the phone from the same Swift file as the corpus tool, and the phone's Vision is not the Mac's

**Date:** 2026-09-16 · **Status:** accepted · **Builds on:** D3, D14, D21

The Vision module exists and runs on the device. It is a local Expo module,
`apps/learner/modules/vision-ocr/`, and its recognition pipeline is a single file,
`ios/OCRCore.swift`, that the Mac CLI in `tools/ocr/` now compiles too. The CLI kept
only what a Mac needs around that core: EXIF, GPS, directory walking, NDJSON.

**Why one file rather than a port.** D3 said the CLI was the same Vision configuration
the app would need. That only stays true if it is the same *code*. Every lesson the
corpus has taught so far — D9's geometry-not-confidence, D14's confusables, D19's
dashes, D21's cross-scale corroboration, D27's homoglyphs — lives in that pipeline,
and a second copy would stop learning them the day it was made. The file lives on the
app side because CocoaPods requires a pod's sources under its own directory, while
`swiftc` will compile a file from anywhere; the dependency arrow points from the tool
to the app, which is the direction the project is heading anyway.

**Verified on the phone**, not the simulator. The preflight bundles a 1200 px copy of
the 38.447.4 label (`apps/learner/assets/fixtures/`) — the D14 regression case — and
runs the full three-scale pipeline on it: 13 lines in about 650 ms on an iPhone 16,
off the main thread. Fast enough that capture can OCR every label shot as it is taken,
which is what "read the accession on-device and show it back" in the A1 milestone
requires.

**The finding.** Same file, same code, different wrong answer. On the Mac the
reference scale reads the accession as `38.447•4`, a bullet, which normalization
folds. On the phone it reads `38.447-4`, a **hyphen**, which normalization must *not*
fold — a hyphen is a legitimate accession separator (`48.108.14A-B` is in the corpus).
The only thing that caught it was D21's cross-scale check: the line came back
contested, with `38.447.4` as the reading from another scale.

Two consequences:

- **The corpus tool predicts the shape of the phone's failures, not the characters.**
  The Vision model on iOS 26.6 / A18 is not the one on macOS 26.7 / Intel, and the
  fixtures' `traps` describe what the Mac saw. §4's evaluation has to run on-device
  eventually, and the preflight's bundled fixture is the first step toward that — a
  device-side fixture runner is now the obvious A1 task after capture.
- **Corroboration is the defense, not folding.** D14's confusable map handles the
  characters that are never legitimate. For the ones that sometimes are, there is no
  table; there is only asking the recognizer twice and noticing the disagreement. The
  preflight verdict was changed to reflect this: a contested line whose variants hold
  the truth is the pipeline *working*, and the resolution — showing the learner both
  readings and asking — belongs to the product (§4.1), not to OCR.

**Not decided:** whether the core should pick a majority reading across scales rather
than always taking the reference scale's. With three passes, two agreeing against one
is real evidence. It would change the corpus tool's output and every fixture's `traps`
was written against the current behavior, so it wants its own decision with a rerun
over the corpus, not a quiet edit here.

---


## D31 — The project is named Placard

**Date:** 2026-09-19 · **Status:** accepted, amended by D40 · **Closes:** the §13 question "Is Wall Text the name?"

The project is **Placard**. The domain is `placard.pics`. The learner app's bundle
identifier is `pics.placard.learner`, the npm package is `placard-learner`, and the
corpus tool builds as `placard-ocr`. This is the second rename: *Art Book* → *Wall
Text* in PLANNING.md v0.9, *Wall Text* → *Placard* now.

**Reasoning.** "Wall text" was a good name for this domain, which is exactly the
problem: two unaffiliated sites already used it, both in the exhibition-guide space.
One collision could be lived with, and §12.5 was written on that assumption. Two is a
pattern — the name is generic enough in this field that it would keep colliding, and
each collision costs a disclaimer, a disambiguation section, and a harder outreach
conversation. §13 had already noted that a rename is nearly free before anything is
public and expensive after. This is the last moment it's free.

"Placard" is the same object from a different angle — the small card beside the work —
and it isn't a term of art the way "wall text" is, so it is less likely to be taken by
the next museum-adjacent project. Lowercase "wall text" continues to mean what it
means in museum usage (the interpretive panel, as distinct from the tombstone label)
throughout the documents; only the project and app name changed.

**What changed with it.** The bundle identifier, because it is the one name that
cannot change after an App Store or TestFlight submission, and the cost today is one
Xcode signing pass (D29 step 2) rather than a permanent mismatch. The Xcode project
name follows `app.json` and regenerates; the working directory on disk did not change
and nothing derives from it.

**What did not change.** The repository's working directory name, git history's
references to the old name in the archive (D32), and the museum term.

*D40 reversed the first of these: the directory became `placard/` on 2026-09-27, and
some things outside git did derive from its path.*

---

## D32 — The repository is public, and the prior-art analysis is not in it

**Date:** 2026-09-19 · **Status:** accepted · **Supersedes:** D6

`github.com/douglas-johnson/placard` is public, under GPL-3.0. It was created as a
fresh repository with a single initial commit; the original private repository is
retained as `douglas-johnson/walltext-archive` and is not deleted. The site-specific
analysis that PLANNING.md §12 used to carry lives in `douglas-johnson/placard-notes`,
private.

**Reasoning.** D6 kept the whole repository private to protect one section of one
document. That was the right call for one day of work; it's the wrong shape for a
project whose venue registry, eligibility model, fixture schema, and claims model are
plausible public goods and whose outreach position is *better* when the work is
visible. Making the repository public means moving the sensitive part out, not
carrying it in history — an imperfect scrub of twenty commits is worse than none, so
the public repository starts from a clean initial commit and the archive keeps the
history.

**The rule this establishes.** The public repository never carries another project's
failure analysis before we have spoken to them. Prior art is argued from the category
("existing aggregators do X and don't do Y"), which is just as load-bearing for D1,
§11, and B3's scope and names nobody. Specific findings — duplicate records, drifted
venue mappings, the DOM patterns that caused them — are things to offer someone in
conversation, and they go in the private notes repository until that conversation has
happened. Naming a site as *existing* is fine; publishing what's wrong with it is not.

**Consequences.** GPL-3.0 applies to the code. The fixtures in `data/` are short
transcriptions of museum label text and are published as part of the corpus; raw
photographs remain uncommitted (D4). The Apple team ID stays in `app.json`, where
prebuild needs it, and nowhere else. The archive repository is frozen at its last
commit and is not a working repository — nothing goes there.

**What would reverse this:** discovering that something in the public tree should not
have been — in which case the fix is to move it to the notes repository and republish
from a fresh initial commit, since the same reasoning about history applies.

---

## D33 — Field-beta iterations ship as JS updates on top of one native build

**Date:** 2026-09-19 · **Status:** proposed by Claude, awaiting Doug · **Amended by:** D48 · **Builds on:** D29, D30, field-beta §5

Build 4 — the first TestFlight build — went out with `expo-updates` configured
(channel `testflight`, runtime version policy `appVersion`, so `0.1.0`). F0 was then
written to add **no native module**: the capture flow uses only what build 4 already
links — `expo-camera`, `expo-file-system`, `expo-location`, `expo-media-library`, the
local Vision module, and React Native's own `Share` for the manifest export. Two things
were wanted and deliberately not added because each would have forced a rebuild:
`react-native-safe-area-context` (replaced by `Constants.statusBarHeight` and a fixed
home-indicator inset, `src/insets.ts`) and any navigation library (the app is four
screens and a state machine).

**Decision:** while the native surface is sufficient, a field-beta iteration is
`eas update --channel testflight`, which reaches every tester's phone on next launch
in about a minute. A native rebuild (`eas build` + `eas submit`, ~15 minutes plus
Apple's review of the binary) happens only when the native surface changes — F1's
face blur in the Vision module is the first known case — and every such rebuild bumps
the app version so the runtime version moves with it.

**Reasoning.** The Mac is an Intel machine and Doug is often remote (field-beta §5);
the whole point of TestFlight was to take the Mac out of the loop. An OTA path keeps it
out for the common case, which for a data-collection beta is copy changes, a new flag,
a different prompt order — the things testers will ask for on day one. The cost is a
constraint on what F0 may reach for, and the constraint turned out to be cheap: the
insets helper is twelve lines, and the router is smaller than a library's config would
have been.

**What would reverse this:** a JS-only change that misbehaves against the embedded
native modules — the runtime-version policy is what guards against that, and if
`appVersion` proves too coarse the policy moves to `fingerprint`.

---

## D34 — Railway for compute, Backblaze B2 for raw, git for fixtures

**Date:** 2026-09-22 · **Status:** accepted · **Supersedes:** `docs/field-beta.md` §4's
hosting proposal · **Detail:** `docs/infrastructure.md`

field-beta §4 proposed Vercel for the ingest function and Cloudflare R2 for the bucket,
and asserted "bucket versioning on" as the enforcement of raw immutability. That section
was written without checking the providers. R2 does not offer bucket versioning, so the
promise could not have been kept as written — the design rested on a property the chosen
store did not have.

**Decision:** three stores, chosen for the guarantee each tier needs.

**Railway** runs `ingest`, the workers, the `derived` bucket, and eventually B1's
Postgres. One project, one bill, one file. Infrastructure is declared in
`.railway/railway.ts` and applied with `railway config plan` / `railway config apply`,
through a GitHub Action that plans on pull requests and applies on merge. TypeScript
because that variant is GA and the Python one is beta; the file is configuration, not
application code, so it does not contradict §10's choice of Python for the API.
Railway's older `railway.json` config-as-code is deprecated and stops working
2026-12-01, so we start on the right side of that line. The first environment is named
`testflight`, matching D33's `expo-updates` channel so the mapping is one word;
`production` arrives with a public app.

**B2** holds raw, because it is the only store examined that offers versioning together
with keys scoped to a bucket, a filename prefix, and a capability set. That combination
is what D35 rests on.

**Git** holds fixtures. A pull request is the review gate and history is supersession —
the two guarantees a fixture needs (§8.3) — and the repository is already off the Mac.

**Reasoning.** The second vendor is the cost, and it is deliberate: the vendor boundary
*is* the enforcement boundary. That resembles the separate Postgres credential in
`db/README.md`, but the resemblance is structural only — that split serves the privacy
constraint and this one serves the corpus, which is a different data class
(`field-beta.md` §1). Consolidating raw onto Railway's bucket — one full-access
credential, no versioning, no scoped keys — would trade D35's bounded blast radius for
one fewer login. Cost is
not a factor either way: Hobby is $5/month with $5 of usage included, `ingest` idle is
about $4.50 at list, B2 is $6/TB-month, and bucket egress is free to three times stored
volume.

**Amendment (2026-09-22, first apply).** TypeScript costs more on this machine than the
choice anticipated, and the cost is worth recording rather than rediscovering. The CLI
evaluates the authoring file with `node --experimental-strip-types`, so it needs **Node
≥22.6**, which the machine default of 20.20.2 did not meet. That turned out to cost
nothing: React Native 0.86.3 declares `^20.19.4 || ^22.13.0 || ^24.3.0` and Expo
declares no constraint at all, so the default moved to 22.23.2 the same day and serves
the app and the CLI alike. `apps/learner` typechecks and bundles under it; the native
build has not been re-run. The claim in an earlier draft that Node 20 was pinned for
Expo was wrong — nothing pinned it. And because `.railway/railway.ts`
imports `railway/iac`, the repository needed a **root `package.json`** where it
previously had no Node project at all. The decision stands — beta is a poor property for
the file that defines the infrastructure, and CI has neither problem — but had both
costs been known, the Python variant would have been a closer call than the entry
implies.

Also settled by the first apply: a `bucket()` node exposes no `env`, unlike
`postgres()`, so bucket credentials reach a service through Railway shared variables
(`ctx.shared.<NAME>`) rather than by referencing the node. `docs/infrastructure.md` §6
carries the corrected sketch.

**What would reverse this:** Railway's IaC failing to cover buckets or Postgres, which
are the two resources that would otherwise pull the project back to a second control
plane. On the B2 side, AWS S3 is the upgrade path if the conditional write it lacks
(D35) ever becomes load-bearing; the migration is an `rclone sync`.

---

## D35 — In `raw/`, only a redaction ever replaces or removes a key

**Date:** 2026-09-22 · **Status:** accepted · **Builds on:** D4 and its amendment ·
**Verified against the live account:** 2026-09-22

Two rules, one checkable and one about credentials:

> In `raw/`, the only operation that ever replaces or removes an existing key is a
> redaction. Every other write creates a key that did not exist.

> No service, deployed anywhere, holds a credential that can delete from `raw/`.

Absent, not permission-gated. That is the same *shape* as the back office having no read
path into the private layer, and no more than that — constraint 1 governs learner
material, this governs the corpus, and the two are separate rules that are easy to run
together (D28). The first draft of this went further and said no delete-capable
credential should exist at all, "and if one is ever needed, that is a decision to record,
not a key to mint." D4's amendment is that decision, recorded four days earlier. So the
capability is not forbidden to exist; it is forbidden to *persist* (D36).

**The two halves are enforced differently, and only one by the store.** Removal is real:
no standing key carries `deleteFiles`, and B2 refuses the call — checked against
`placard-raw`, where a write with the read-only key returns `unauthorized` and nothing
lands. Replacement is not, and cannot be: **B2 has no conditional write.** `PutObject`
with `If-None-Match: *` returns `NotImplemented`, and the same header on a presigned URL
returns HTTP 501. What carries the create-only half is three weaker things in series —
the app's frame counter, monotonic and replayed from the manifest on launch; the
contributor ID above the take in the key, so two phones cannot collide; and `ingest`'s
HEAD before it signs a PUT, which is a check-then-act and therefore a guard against bugs
and retries rather than a guarantee against a compromised client.

**Versioning stays at full retention, and what it buys is soft delete — not overwrite
protection.** Two earlier framings were wrong. The first called it belt-and-braces; the
second oversold it as the only thing standing between a write credential and an
overwrite. The overwrite case is real but narrow: `ingest` is the sole holder of
`writeFiles` and it checks before it signs. What versioning actually gives is that **a
plain delete is soft and only an explicit delete by version ID destroys**, which is
precisely the split this project needs — redaction must be hard, and every other delete
is a mistake that should be recoverable. It comes from the store, so it does not depend
on every future caller routing through our service, and D36's tool is the deliberate
version-by-version path for exactly that reason. Setting the bucket to "keep only the
last version" would remove the property and buy nothing.

*Checked:* an unconditional PUT over an existing key was accepted and the prior version
retained; version-by-version deletion destroys. *Not yet checked:* that a plain
`DeleteObject` leaves a marker rather than destroying. Expected — the API lists
`DeleteMarkers` as a category — but it is load-bearing now and should be tested.
*Checked 2026-09-27:* a plain `DeleteObject` left the version and added one delete
marker. Soft, as this entry assumed (infrastructure.md §8).

**Object Lock is ruled out permanently, not deferred.** The first draft deferred it
until a contributor's frames carried legal weight; one already had, four days earlier.
Object Lock makes deletion impossible for a retention period and D4 makes deletion an
obligation that can arrive at any time, including months later when someone reviewing
fixtures notices a name nobody caught in the gallery. Both cannot be true, and D4 wins.
The cost is accepted and stated rather than mitigated: without it, an attacker holding a
delete-capable credential can destroy raw. A replica in a separate account would be the
answer, and it has a catch — every replica multiplies the redaction surface, because a
redaction must reach all of them or it has not happened.

**Two buckets do not help**, which was the first idea and is worth recording as
rejected. Splitting raw into a redactable tier and a locked tier needs a boundary that
bounds where a minor's identity can appear, and there is none. Not by frame kind: the
Met case deleted the *label* and kept the work and the wall text, and a name can appear
on either. Not by age: the case can surface at any distance from the capture, including
during fixture review months later. One bucket, with redaction able to reach any object
in it, is the honest model.

**What would reverse this:** a store offering versioning *and* conditional writes at a
cost worth the move, which today means AWS S3. That would make the create-only half
store-enforced and let this decision be stated without its caveat.

---

## D36 — Redaction is a tool that mints and revokes its own key

**Date:** 2026-09-22 · **Status:** accepted · **Implements:** the D4 amendment ·
**Builds on:** D35

D4's amendment settles *that* a frame identifying a minor is deleted from `raw/`, its
OCR stripped from the manifest, and `derived/` regenerated. This is only about making it
reliable, because the failure mode is specific and silent: you delete the object, the
console shows it gone, and three prior versions of it are still there. An incomplete
redaction is indistinguishable from a complete one unless something checks.

**Decision:** `tools/redact/`, run from the Mac, never deployed. Given a take, a frame,
and a reason it mints a B2 key with `deleteFiles` restricted to that take's prefix with
an hour's duration; enumerates **every version** of the frame's key and deletes each by
ID, then re-lists and fails loudly if anything remains; rewrites the manifest and then
deletes every prior version of the manifest key, because those contain the text that was
stripped; purges and regenerates the take's `derived/` objects; appends a line to
`data/labels/redactions.ndjson`; revokes the key; and exits non-zero if any step could
not be verified.

The loop was exercised against a throwaway bucket before being written as a tool: four
versions across two keys enumerated, deleted by ID, re-listed, nothing surviving.

**Lifecycle rules are not a substitute.** They run once a day and a one-day rule can
take 48 hours. "The child's name is gone within two days" is not the promise.

**The manifest is therefore write-once except under redaction**, which is the single
exception to D35's invariant. `field-beta.md` §4 calls the manifest a take's commit
marker and that still holds in the sense that matters — a take without one is incomplete,
not corrupt — but its content is mutable, by exactly one writer. F0's format already
anticipates this: `take.ts` carries a `redacted` field on the frame record, and the
record stays so replay and sequence numbers hold.

**Amendment (2026-09-22, D38).** The two paragraphs above assume the manifest reaches
the bucket as one file. It does not: D38 uploads it as one immutable object per record,
so there is nothing to rewrite. The tool's third step becomes *destroy every version of
the `ocr` record's key* — the same operation as the frame's, not a special case — and
the `redacted` marker is an appended record rather than an edit to an existing one. The
manifest stops being an exception to D35's invariant, and `raw/` holds nothing that is
ever rewritten. The device format is untouched: `take.ts` still marks its own record,
and it is only the uploaded form that splits.

**The audit record** is `data/labels/redactions.ndjson`, committed, one line per
redaction, carrying nothing identifying — take, group, frames, reason, what was removed,
what was kept, the fixture. Constraint 2 says nothing is ever hard-deleted and
superseded versions stay queryable; redaction is the one case that cannot honour it, and
this record stands in its place, so the fact, scope, and reason of a removal remain
queryable forever even though its content does not. Naming the exception is better than
leaving it an unmarked contradiction, and it makes the rule testable: every manifest
record marked `redacted` should have a matching line, and every line a matching record.
The Met case is the first line.

**What would reverse this:** nothing short of D4 changing. If redactions ever became
frequent enough that minting a key per case is friction, that is a signal about the
capture protocol, not about this tool.

---

## D37 — Fixtures stay in git, and frame references become `{key, sha256}`

**Date:** 2026-09-22 · **Status:** accepted · **Builds on:** D32, D34

A fixture is a test suite entry, not a record of the world (PLANNING.md §11 A0 sizes the
set at 300–500 labels across 15+ institutions). It does not grow with usage: early it
grows with coverage — a new venue, a new accession format, a non-Latin script, an
attribution qualifier not yet seen — and in steady state with discovered difficulty,
when the pipeline misreads a label and that label becomes a fixture so it cannot
silently regress again. When forty learners photograph the same label and the extractor
reads it the same way forty times, that is corroboration on a claim in the canon (§4.7),
not forty fixtures and not one.

**Decision:** fixtures stay in git. F2's drafter runs as a Railway worker, reads the
manifest and label frame from B2 with a read-only key, runs OCR and the accession
locator, checks the venue's catalog API where one exists, and **opens a pull request**
against `data/labels/fixtures/`. Merge is verification. Its GitHub credential is scoped
to this repository with `contents` and `pull_requests` write, and branch protection on
`main` requires review, so the token cannot merge its own work.

This is §4.8's claim lifecycle without building B1: the draft is an inferred claim, and
the merged fixture is verified with a citation. The drafter writes the fields migration
into the canon will need — `verified_against`, the catalog record ID, the reading it
corrected from — which the Met fixtures already carry by hand. A fixture's commentary
(`traps`, `work_photo_note`, cross-references to decisions) documents why a case is hard
and stays in git even after B1.

**Frame references become `{key, sha256}`.** Fixtures currently bind to raw by path —
`raw/2026-09-16-mcny/IMG_E1308.HEIC`, and after the Met, Image Capture's names. Once raw
is a bucket the reference is a key, and it carries a content hash: the key is the
address, the hash is the identity. Raw is immutable so the two should never disagree,
and the hash is what says if they ever do — a shadowed key (D35), a corrupted upload, a
half-finished sync. It also keeps a fixture valid across a move off B2. This covers all
23 fixtures and should be done while the frames are still on the Mac. A redacted frame
gets no hash: it is not identifying on its own, but it would let someone holding a copy
confirm they hold the right one, and there is no use for it once the object is gone.

**What would reverse this:** fixtures outgrowing review, which would mean the extractor
is failing in more distinct ways than a person can vouch for — a different problem than
where the files live.

---

## D38 — The manifest uploads as immutable per-record objects, not as a file

**Date:** 2026-09-22 · **Status:** accepted · **Amends:** D36 · **Builds on:** D35, the
D4 amendment · **Detail:** `docs/infrastructure.md`

F0 writes one append-only NDJSON per take and that does not change. It is the app's only
state, replayed on launch to resume a visit, and it has to work in airplane mode. This
decision is about what leaves the phone.

`field-beta.md` §4 has the manifest arriving in the bucket as `manifest.ndjson` beside
the frames. That makes it the one mutable object in an immutable store, which is why D36
carried a step that rewrote it and then destroyed its prior versions — the step most
likely to be got wrong, and the one where getting it wrong leaves behind exactly the
text the redaction existed to remove.

**Decision:** the manifest uploads as one object per record.

```
raw/doug/2026-09-20-met/records/000014-frame.json
raw/doug/2026-09-20-met/records/000015-ocr.json
raw/doug/2026-09-20-met/f0007-label.jpg
```

Three things follow. **Redaction becomes one uniform operation** — destroying a frame's
OCR text is "destroy every version of this key," the same call as for the frame itself.
**D35's invariant holds with no exception**, because nothing in `raw/` is ever
rewritten. And **the redaction marker becomes an appended record** rather than a
mutation: `{"type":"redacted","frame":"f0035","removed":["frame","ocr"]}`. The log is
already append-only on the device; this keeps it that way in the bucket, and it makes
`data/labels/redactions.ndjson` derivable rather than separately maintained.

**Why not rows in Postgres.** Considered first and rejected. If the manifest lives only
in a database, the bucket stops being a complete archive — forty-one files named
`f0007-label.jpg` with nothing to interpret them are not a corpus. Raw is the thing the
Mac no longer holds (D35), so it has to be self-describing. It would also make A0 work
server-dependent: everything done for the Met take ran on the Mac with no service at
all, and that should stay true.

**Why per record rather than per group.** A group object would be written once at close
and would be immutable too — but removing one frame's OCR from it means rewriting it,
which is the problem this decision exists to remove. Redaction has to target a key, not
a fragment of one. The cost is object count: roughly 130 objects per take against 41
today, and a few tens of kilobytes of records. B2 bills per GB and its API operations
are free, so this is close to nothing. *(Claude's call; the alternative is coherent and
was rejected on this reasoning, not on measurement.)*

**The commit marker survives.** `take_ended` carries the take's final `seq` and its
frame counts, both of which `take.ts` already maintains. It is a claim about what should
exist, not an assertion that all of it has arrived — a tester can end a visit in a
basement gallery with the upload queue still full. Completeness is the service's
determination, when observed records and frames match the claim. *(Also Claude's call.)*

**The convenient form is derived.** Mac-side tools want a `manifest.ndjson` next to the
frames. Generate it — list the records, sort by `seq`, write it into `derived/`, which
is regenerable by definition and so may be freely rewritten, including after a redaction
regenerates that take. The `raw`/`derived` split in `data/README.md` does exactly the
right work here.

**Postgres is an index, not the truth.** The service ingests records into rows for
querying, for the reconciler, and eventually for B1's canon, but the bucket stays
canonical. A database loss is repaired by re-ingesting from the bucket, not by restoring
a backup.

**Transport splits by size.** Frames are large and go straight to B2 by presigned PUT.
Records are a few hundred bytes, so the app POSTs them to the API and `ingest` writes
them, which also lets the bucket write and the row insert happen together. The app still
never holds a bucket credential.

**What would reverse this:** a store that charges per operation, where 130 objects per
take instead of 42 would begin to matter. Serving speed would not — the generated
NDJSON in `derived/` is the cache and Postgres is the index, and neither changes what is
canonical.

---

## D39 — Hard constraint 1 names a goal; separate credentials are its preferred mechanism

**Date:** 2026-09-22 · **Status:** accepted, Doug's call · **Amends:** `CLAUDE.md` hard
constraint 1 · **Related:** D25, D28, D35

CLAUDE.md's first constraint said: *"Enforce it with separate database credentials, not
with application code."* That sentence conflates two things — the boundary itself, which
is not negotiable, and one mechanism for holding it, which is.

**Decision:** the constraint is the **goal**. No learner ever sees another learner's
notes, photos, or interest profile, and the back office has no read path to the private
layer — absent, not permission-gated. Separate database credentials remain the
*preferred* enforcement, because they hold when application code is wrong, which is the
failure mode that actually happens. But a different mechanism may be proposed, and
should be accepted if it meets the goal as well or better.

**Reasoning.** Doug's own words on being asked: *"I am significantly more flexible than
that as long as the privacy goals are met."* The prescription had also started doing
work it was never meant to do. While the corpus infrastructure was being designed, this
sentence was cited repeatedly as though it governed where raw frames live — it does not
(§1 of `docs/field-beta.md`: a contribution is not the private layer), and that borrowed
authority is the same class of confusion D28 already caught once. Constraint 1 now says
which data class it governs, and that scope note is the more important half of the
change.

Recording it because the review of PR #5 was right that it wasn't. The scope
clarification was justified by D28 and D35; the softening of the mechanism rode along
inside it with nothing behind it but a conversation — which is the exact failure this
file exists to prevent, on the repository's most safety-critical constraint.

**What would reverse this:** a proposed alternative mechanism that turns out to depend
on application code being correct. That is not a different mechanism, it is the absence
of one, and the preference for credentials exists precisely to rule it out.

---

## D40 — The working directory is `placard/`

**Date:** 2026-09-27 · **Status:** accepted · **Decided by:** Doug · **Amends:** D31's
"What did not change"

Doug renamed the working directory on disk from `walltext/` to `placard/`, so that
the folder matches the project name. D31 listed the directory name among the things
that did not change and said nothing derives from it. The first half is now reversed.
The second half turned out to be true of the repository and false of the tools around
it, and that difference is what's worth writing down.

Nothing tracked in git held the absolute path, so the repository needed only
documentation changes (`CLAUDE.md`, the pr-review skill) and a regenerated root
lockfile, whose package name had defaulted to the old folder name. Three things
outside git did depend on the path:

- **`expo-modules-jsi`'s generated modulemap** in `apps/learner/node_modules` held
  `/Users/doug/dev/walltext/…` header paths. Its build script regenerates the modulemap
  from the current `PODS_ROOT` on every build, and the modulemap is part of the cache
  hash, so the next native build rebuilds the xcframework slices with no manual step.
  That first build is slower. A clean prebuild (`CLAUDE.md`, "When the iOS build fails
  on a header") also clears it.
- **Xcode DerivedData** is keyed by project path. Xcode starts a fresh folder for the
  new path, and the old ones take up disk space and nothing else.
- **Claude Code's per-project state**, memory included, is keyed by path. The memories
  were copied to the new location. Session transcripts from before the rename stay
  under the old key and don't appear when resuming from `placard/`.
- **The Railway CLI's project link** (`~/.railway/config.json`) is keyed by path too.
  Found the same day, when `railway config plan` reported no linked project; `railway
  link --project placard --environment testflight` from the new path restored it.

**What would repeat this:** any future rename of the directory. The list above is the
checklist.

---

## D41 — On the phone, a visit's one edit is removing a photo, as a redaction

**Date:** 2026-09-27 · **Status:** accepted · **Amended by:** D48 · **Decided by:** Doug asked for it; its
shape is Claude's call · **Implements:** the D4 amendment and D36 on the device

The Met redaction was carried out on the Mac. The phone's own copy of that visit still
holds the P.S. Art label frame (`f0035`, group `g0014`) and the OCR record with the
child's name, grade, school and teacher. That copy has to go before anything uploads
from the phone. More generally, the protocol says a frame like this is deleted the day
it's found, and a tester in the field has no Mac.

**Decision:** an earlier visit opens to its photos, and the one change it offers is
removing a photo, as a redaction. It does on the phone exactly what was done by hand on
the Mac. The image file is deleted. The frame record keeps its place with `file: null`
and a `redacted` note. Every `ocr` record for that frame keeps its place with `lines`
and `candidates` emptied and a `REDACTED` warning, so replay and sequence numbers hold
and the visit still records that a photo was taken there. When the photo is a label or
an accession crop, the group's `accession` record loses its `reading` and `candidates`
as well, because the locator read them from that OCR; the review of PR #7 caught that
the first version left them. What the tester said stays: the accession `status` and
`value`, and the group's note, are their answer rather than the app's reading, and the
Mac-side redaction of the Met kept the note too. A tester's own words can still repeat
a label; the Mac-side redaction tool that follows (D42) takes extra records by sequence
number for that. Every other line keeps its exact bytes.

**Why not a general edit.** A take is evidence (data/README.md), and the one sanctioned
change to it is this one. A general delete would quietly make the corpus tidier than
the gallery was, which is the failure the raw/ rules exist to prevent, so the
confirmation names the case instead of offering one.

**Two limits, stated rather than hidden.** The camera-roll copy is a separate asset
whose ID the app never recorded, so the screen tells the tester to delete it in
Photos. And the manifest is rewritten in full, which the file API cannot do
atomically. So the removal writes an intent (the frame, the reason, the day) before
it touches anything, deletes the image first because it is what identifies someone,
writes the new manifest to a side file, marks the side file ready once it is
complete, and moves it into place. Before anything reads or appends to the manifest,
replay moves a ready side file into place and discards one that isn't ready. If an
intent is still present, it then runs the redaction again. A crash at any point
therefore ends either before anything was removed or with the redaction complete,
never with the image gone and the text still there. The first version got this
wrong, and the review of PR #7 caught it: it treated "side file and manifest both
present" as "side file torn", which is also true in the instant after the side file
is finished. `npm run redaction-test` now crashes the sequence at every step, and at
every step of the recovery after it.

**What would reverse this:** nothing short of D4 changing. Once uploads exist, a frame
already in the bucket also needs `tools/redact/` (D36), and the phone-side removal
does not reach the bucket.

---

## D42 — The redaction tool lands before the first upload

**Date:** 2026-09-27 · **Status:** accepted · **Decided by:** Doug (the order); the
details are Claude's calls, marked · **Implements:** D36 · **Builds on:** D35, D38

`infrastructure.md` §9 put `tools/redact/` ahead of any upload, and the order holds.
The upload path was first written as one branch and then split so that this lands, and
is reviewed, before anything can reach `placard-raw` from a phone. Once a frame is in
B2, the only reliable way to remove it is a version-by-version tool, and needing that
tool is exactly when there is no time to write it.

The tool is D36 as amended by D38. The details below are Claude's calls:

- **Every version of every `ocr` record is read, hidden ones included,** to find the
  records that read the frame. A hidden version still holds the text, and a record
  that cannot be parsed stops the run rather than being guessed about.
- **`--record <seq>` destroys further records by sequence number,** for the case the
  Met nearly was: a tester's free-text note that repeats what the label said.
- **For a label or accession crop, the group's `accession` record loses its reading
  and candidates,** as it does on the phone (D41). The review of PR #8 caught that the
  first version of this tool did not, the same gap the review of PR #7 found on the
  phone. A bucket object can't be edited, so every version is destroyed, and the
  record is written back once, after the destruction is verified, without the
  locator's reading. The tester's status and value stay. The frame's kind and group
  come from its own record in the bucket, not from `--group`.
- **The marker is `records/redacted-<frame>.json`,** not a sequence-numbered record.
  The sequence belongs to the device, and a marker written months later on the Mac
  must not be able to collide with it. It is written only if the take is in the
  bucket at all.
- **A take that is not in the bucket is "nothing to do" and still gets its audit
  line.** That is the Met case, and `infrastructure.md` §9 names it as the first live
  test.
- **One audit line per redaction.** A rerun that destroys nothing, on a frame that
  already has a line, appends nothing. The realistic rerun is after a failed revoke,
  which exits non-zero even though the redaction itself succeeded (review of PR #8).
  A rerun that does destroy something is a new event and gets its own line.
- **Revocation is checked, not assumed:** after deleting the key the tool lists keys
  and fails if it is still there, printing how to revoke it by hand.
- **Railway's `derived` bucket is guarded by a constant.** Nothing writes to it yet.
  The first worker that does must flip `DERIVED_BUCKET_IN_USE` and add its purge.
  The check is a precondition, run before a key is minted: failing after the
  deletions would leave a redaction with no audit line (review of PR #8).
- **Standard library against B2's native API.** Minting keys and listing versions are
  native-API operations, and a tool that runs interpreted needs nothing from Homebrew
  (CLAUDE.md).

Tested against a fake B2 that keeps versions and hide markers the way B2 does. Not yet
run against the live account.

**What would reverse this:** nothing short of D36 changing.

---

## D43 — The first upload path: the app drains its own queue

**Date:** 2026-09-27 · **Status:** accepted · **Decided by:** Doug (the first four
points); Claude's calls are marked · **Builds on:** D33, D34, D35, D38, D41, D42 · **Detail:**
`docs/infrastructure.md` §5 and §9

The collector's build stops depending on USB and Image Capture. Frames and records leave
the phone through `services/ingest/`, land in `placard-raw` as D38 lays out, and come
back to the Mac through `tools/corpus-pull/`. It lands after D41 (removing a photo on the
phone) and D42 (the redaction tool), in that order, so nothing can leave a phone
before both exist. Four scope calls were Doug's:

**The upload is automatic, on any network.** The queue drains whenever there is signal,
during a visit or after it. A take is roughly forty frames of a few megabytes each, which
is not worth a Wi-Fi gate, and a manual "send this take" button would make the tester's
memory part of the pipeline. That is the failure the Met showed, when the manifest was on
the phone and nobody could reach it (field-beta §6.1).

**Redaction comes first.** The upload path was written as one branch and then split, so
that phone-side removal (D41) and the redaction tool (D42) are each reviewed and merged
before this.

**Postgres is provisioned now.** `ingest` inserts a row under a primary key on
(contributor, take, frame) before it signs a URL, which is the create-only allocation
D35 asks for in place of the conditional write B2 lacks.

**The pull-back tool is in scope.** Without it, frames reach the bucket and USB is still
the way they reach the Mac, so nothing the tester feels would have changed.

The rest are Claude's calls, recorded as such:

- **Integrity is Content-MD5 on the device, SHA-256 on the Mac.** The phone cannot
  compute SHA-256 over a four-megabyte file without a native module or a slow JS loop
  on the capture thread, and adding a native module would break D33's JS-only path.
  `expo-file-system` already hashes MD5 natively. `ingest` signs the PUT with the
  declared `Content-MD5`, so the store is asked to reject a body that doesn't match.
  `corpus-pull` then computes the SHA-256 that D37's fixture references carry, and
  checks each download against B2's own SHA-1. *Verified 2026-09-27 against the live
  account (infrastructure.md §8): a presigned PUT whose body doesn't match the signed
  Content-MD5 is refused with `400 BadDigest`, and B2's ETag for a simple PUT is the
  MD5, so `ingest`'s comparison on `complete` is a real check and not the length-only
  fallback.*
- **Uploading is opt-in per phone and off by default** until F1's consent screen
  exists. This OTA update reaches every TestFlight phone, and field-beta §1 says no
  contributor's frames leave the phone before they have been told where they go. One
  switch for now. The three per-kind properties that §1 describes are F1's work.
- **Consent is not retroactive.** Only visits started while sending was on are sent;
  visits already on the phone stay there. It is the right rule on its own terms, and
  the Met showed a specific reason besides: the redaction there was carried out on the
  Mac, and the phone's own copy of that take still held the P.S. Art label and its OCR
  until D41 made it removable on the phone. Sending everything on the phone at opt-in
  would have put it in the bucket.
- **A photo removed on the phone after it was sent says so.** Records go before frames,
  so a label's OCR text usually reaches the bucket before its photo does. D41's removal
  doesn't reach the bucket, so the confirmation warns when anything of that frame has
  already been sent and `tools/redact/` is needed too.
- **The contributor ID is random and made on the device** (field-beta §3, still a
  proposal there). Doug's phone gets one like anyone else's, and the app shows it so
  he can recognise his own prefix.
- **`corpus-pull` uses the Python standard library against B2's native API**, like
  `tools/redact/` (D42), and not rclone. rclone would come from Homebrew, which is this
  machine's most expensive trap (CLAUDE.md). Downloading only what is missing, and
  never overwriting what is present, is short enough to write.
- **A frame's key in `frames.json`, and so in a rebound fixture, is the full object key,
  `raw/` included.** D37 says the key is the address. The same string is the file's
  path under `data/labels/` in the mirror, which is the form today's fixture paths
  already take. `infrastructure.md` §5.3's example had dropped the `raw/`, and
  `corpus-pull` followed it until the review of PR #10 caught the contradiction with
  §5.1 and `ingest`.
- **Postgres gets a `corpus` schema**, separate from the three in `db/README.md`. The
  corpus index is its own data class (field-beta §8.1), and putting it in `canon` would
  imply that frames are claims.

**What would reverse this:** B2 ceasing to enforce a signed Content-MD5, which was
verified on 2026-09-27. That would move integrity checking to the verify step,
`ingest` comparing the stored object after upload, rather than dropping it.

## D44 — The app sends to `ingest.placard.pics`, a domain we own

**Date:** 2026-09-27 · **Status:** accepted · **Decided by:** Doug (the name); Claude's
calls are marked · **Builds on:** D31, D34, D43

`ingest` answers at **`ingest.placard.pics`**, a custom domain on the Railway service,
and `EXPO_PUBLIC_INGEST_URL` points there rather than at
`ingest-testflight.up.railway.app`. The reason is the one thing about the upload URL
that is hard to change later: every phone carries it inside its installed update. A
Railway hostname ties every tester's copy of the app to Railway. A hostname under
`placard.pics` can be pointed at whatever runs `ingest` next by editing one DNS record,
and no phone has to update first. It is within the Hobby plan's limit of two custom
domains per service.

**A subdomain, not the bare domain** (Claude's call). The domain registrar, which holds
the DNS, has no CNAME flattening or dynamic ALIAS at the root, and Railway needs one of
those for a bare domain. Railway's documentation and its forum both give the workaround as moving
the nameservers to Cloudflare. A subdomain is an ordinary CNAME and needs neither. The
root is kept for the public site (B3) anyway, and that is when the Cloudflare question
gets decided.

**Added by hand, not in `.railway/railway.ts`.** Railway's configuration rejects a
custom domain outright ("Custom-domain registration is not supported by Railway
configuration"), so it was added with `railway domain` and two records at the registrar,
a CNAME and a `_railway-verify` TXT. It is the one piece of the Railway setup that the file
doesn't describe. `services/ingest/README.md` has the commands to re-create it.
Checked 2026-09-27: `railway config plan` reports no change with it in place, so an
apply doesn't remove it.

**The Railway hostname stays live** (Claude's call). Phones whose update predates the
switch keep sending there until they pick it up. Nothing about it needs removing.

**What would reverse this:** Railway's configuration learning to declare custom
domains, in which case the domain moves into `railway.ts` and the README's hand steps
go away. Moving DNS to Cloudflare for the public site would change where the records
live, but not this hostname.

## D45 — Python is linted and formatted by Ruff, at 100 columns, enforced in CI

**Date:** 2026-09-29 · **Status:** accepted · **Decided by:** Doug (the line length, and
that CI enforces it); Claude's calls are marked

All Python in the repository — `services/` and `tools/` alike — is formatted by
`ruff format` and linted by `ruff check`, configured once in a root `ruff.toml`. A
GitHub Actions job (`.github/workflows/python-lint.yml`) fails a PR on either. Until now
nothing was configured anywhere: the code had a consistent style because it had been
written carefully, and the only tooling that ever touched it was whatever the editor
happened to have installed, which ran with defaults nobody chose and only on files saved
by hand. Most of this code is written by Claude through tools, never saved in the editor,
so an editor-only standard would have governed almost none of it. CI is the one layer
every change passes through.

**Ruff, not Black plus flake8 or Pylint** (Claude's call). One binary does both jobs,
its formatter is Black's style, and its rule codes are flake8's, so the `# noqa: E402`
comments already in the tools kept their meaning. It installs from pip as a prebuilt
x86_64 macOS wheel, which on this machine is the difference between a second and an
afternoon — the Homebrew trap in CLAUDE.md never comes up.

**100 columns.** At 100 the first reformat rewrapped about 95 over-long lines of code
and left 15 string literals to split by hand; at Black's 88 it would have been half
again as many. The comments here are argued prose and read better with the room.

**The rules** (Claude's call): pycodestyle, pyflakes, isort, pyupgrade and bugbear
(`E W F I UP B`). Deliberately not the docstring or naming families: the comments in
this code say *why*, and a rule that demands a docstring on every function is satisfied
by an empty one. `target-version` is 3.13, the lower of the two interpreters (the
service is pinned to 3.13, the tools run on the system 3.14), so an autofix never
introduces syntax the service can't run.

**One pin, shared by CI and the editor** (Claude's call). `ruff==` lives in
`services/ingest/requirements-dev.txt`, because that venv is the only one the repository
has; CI installs exactly that line, and `.vscode/settings.json` points the Ruff
extension at that venv's binary. Two Ruff versions can disagree about where a line
breaks, and a CI failure over a formatter difference nobody can see locally is the kind
that teaches people to ignore CI. The workspace settings also override two user-level
settings for Python only: `insertSpaces: false`, which would put tabs into
space-indented files, and autopep8 as the format-on-save formatter.

**The first reformat is its own commit,** listed in `.git-blame-ignore-revs` so that
`git blame` — and GitHub's blame view, which reads the file automatically — skips it.
Locally, `git config blame.ignoreRevsFile .git-blame-ignore-revs` does the same. Besides
wrapping, it renamed seven one-letter `l` loop variables (E741) and moved two
`timezone.utc` to `datetime.UTC`; the test suites passed unchanged on either side.

**Not yet** (Claude's call): a type checker, and a pre-commit hook. About 40% of
functions are annotated, which is too few for a type-check gate to say anything but
"annotate more"; Pylance's editor checking is free in the meantime, and B1's `canon`
service is the natural point to start one strictly. A pre-commit hook duplicates CI for
a single committer and adds a tool to install.

**What would reverse this:** little, for the formatter — the style is Black's, and
leaving Ruff for Black would be a no-op on the code. The rule set is the part expected
to grow; adding a family is one line in `ruff.toml` and one cleanup commit.

## D46 — The capture app is type-checked, linted by ESLint and formatted by Prettier, in CI

**Date:** 2026-09-29 · **Status:** accepted · **Decided by:** Doug (the tools, 100
columns, and that CI enforces all three); Claude's calls are marked · **Builds on:** D45

`apps/learner` is checked by three tools, each with an npm script and each run by
`.github/workflows/learner-lint.yml` on every PR: `tsc --noEmit` under the `strict`
config it already had, ESLint with Expo's `eslint-config-expo`, and Prettier at 100
columns with single quotes. As with Python before D45, nothing was configured: the
code was consistent because it had been written carefully, the ESLint and Prettier
extensions were installed in the editor with no configuration to act on, and an
`eslint-disable` comment in `App.tsx` was addressed to a linter that wasn't installed.

**The type check is the strongest of the three and cost nothing.** Unlike the Python in
D45, the app was already fully typed under `strict` and passed. Putting it in CI turns a
property that held by habit into one that holds by construction.

**ESLint and Prettier, not Biome.** Biome is the closer analogue to D45's Ruff — one
binary, lint and format — and was the real alternative. What decided it was Expo's
config: it carries the React hooks rules, including `exhaustive-deps`, which catches the
stale-closure bug that is the commonest real React defect, and it tracks Expo's own
module resolution, which matters on an app that ships by OTA update (D33). Every Expo
and React Native resource assumes this pair, so a problem met here is a problem already
answered somewhere. On 4,000 lines Biome's speed would not be felt.
`eslint-config-prettier` comes last in the ESLint config, so formatting belongs to
Prettier alone and the two never argue. `typescript-eslint` 8.71 supports TypeScript
`<6.1`; the app is on 6.0.3, checked before adopting it.

**Warnings fail CI** (Claude's call), through `--max-warnings 0` in the `lint` script. A
warning CI tolerates is one nobody reads. A deliberate exception is an
`eslint-disable-next-line` with the reason on the line above it.

**`react/no-unescaped-entities` is narrowed to `>` and `}`** (Claude's call). The rule
exists for HTML, where a stray `'` in JSX text is usually a markup typo. In React Native
it is UI copy, and the rule's fix — `can&apos;t` — would make copy that carries the
voice constraint (§1) harder to read and edit. The two characters kept are the ones that
do signal a mistake.

**The adoption changed no behavior** (Claude's call), because the next OTA update ships
whatever is on `main`, and the camera and upload fixes it carries are still untested in
a gallery. ESLint found four `react-hooks/set-state-in-effect` errors and one
`exhaustive-deps` warning; each was read, found deliberate or harmless, and given an
inline disable with its reason rather than a fix. The iOS bundle was exported from
`main` and from the branch and compared: the minified JavaScript differs in exactly one
place, where Prettier moved a `·` across a line break in `Visit.tsx`'s JSX and the text
splits into children differently while rendering the same string. The Prettier reformat
is its own commit, in `.git-blame-ignore-revs`.

**One follow-up, deliberately deferred:** `useUploadStatus` in `src/upload.ts`
subscribes in an effect and then sets state to catch an update between render and
subscribe. `useSyncExternalStore` is React's purpose-built form of exactly this and
should replace it — after the first real upload, so that visit tests the upload queue
that was built, not a rewrite of it.

**Scope.** Prettier formats code and the app's JSON config, not `AGENTS.md`: Markdown is
prose, and Prettier would rewrite its list markers and table padding. The workspace
settings make Prettier the TypeScript formatter only where a Prettier config exists, so
`.railway/railway.ts` is untouched; `apps/backoffice` and `apps/public-site` will get
their own configs when they exist. The Swift in `modules/vision-ocr/` is outside this
decision; `swift format` ships with Xcode if it's ever wanted.

**What would reverse this:** Expo adopting Biome or Oxc as its default, or
`eslint-config-expo` falling behind the SDK. The formatting would survive a move, since
Biome formats as Prettier does to within a few percent; the Expo-specific rules would not.

---

## D47 — Cooper Hewitt: verified against the museum's published dataset, and a date-shaped key is ranked, never doubted

**Date:** 2026-09-29 · **Status:** accepted · **Decided by:** Doug (that the first
uploaded take becomes fixtures, re-read for accessions that look like dates); every
call below is Claude's · **Builds on:** D11, D21, D24, D37, D43

The first take through the upload queue was Cooper Hewitt's, and its accessions look
like dates: `2018-40-1` is the first item of the museum's fortieth acquisition of 2018.
On the spot the tester answered *no number* to four right candidates. Re-reading the
take against the museum's own catalog settled five things.

**The catalog is the museum's published dataset, not its website** (Claude's call).
Cooper Hewitt's collection site now redirects to si.edu behind a request-verification
page that answers scripts with 403, and that page is not to be worked around: a
museum that asks automated clients to stop has said something, and constraint 6's
point about a later conversation applies to primary sources too. The Smithsonian Open
Access API is the museum's own data but holds only CC0 records, 58,198 of them, and
none of the nine objects on the first visit. The museum's own `objects.csv` on GitHub
(CC0, last pushed 2018-01-10) holds six of the eight labels' objects and all of the
panel-mates. Fixtures checked this way say `verified_against: catalog_dataset`, and
the two objects acquired after 2017 stay `label_only` until a source that holds them
is reachable. A dataset is a snapshot, so where it disagrees with a 2026 label the
fixture says which differences are its age.

**Calendar validity is not a signal** (Claude's call). Across the museum's 192,248
year–lot–item keys, a middle group above 12 rules out a date for 154,082, but 13,021
are valid dates, including one on this visit. A score that rewarded "cannot be a date"
would push down one real key in fifteen for no gain, because the locator was already
right on every label: the four misses were human. The venue shape ranks the family
(+3, D11), and the fix for the doubt belongs in the read-back, which is Doug's call and
not taken here.

**The locator keeps Cooper Hewitt's part designators** (Claude's call). `-a,b`, `-a/d`
and `-c` are on about one object in nine, and the device dropped them, offering
`2025-11-1` for `2025-11-1-a,b`. The token now takes a hyphen and lower-case letters as
a part designator beside MCNY's attached capitals (D24), and strips either before
matching a venue shape. Shorthand lists (`2009-16-6, 7-a, 8-a,b, 11`) are recorded in
the fixture and not yet expanded.

**`locator-eval` judges a device row by its fixture when one exists** (Claude's call).
It used the tester's answer on the spot, which here was *no number* four times, so it
would have scored the locator on the human's mistake. It also now reads the bucket
layout (`derived/<contributor>/<take>/manifest.ndjson`), which it didn't see before.
40/43, up from 32/35: the eight new rows pass, the three failing Met rows are
unchanged.

**Fixtures from a bucket take use D37's `{key, sha256}` shape from the start**
(Claude's call), `source_image` included, rather than bare paths that the rebinding
would then have to convert. The 23 USB fixtures still wait for that pass.

**Deferred by Doug, pending more data:** the accession step saying what the venue's
numbers look like when a candidate matches a registry shape (at Cooper Hewitt, that
they start with the year acquired). One visit, one tester and a doubt that stopped by
the seventh label don't yet say whether it is this venue, this key shape, or the first
labels anywhere new. Issue #21 lists what to count on the next visits.

**Open, for Doug:** on a shared panel, the confirmation could ask which object was
photographed; the tester confirmed the drawing's number for a photo of the vase. JS-only
under D33; issue #22.

**What would reverse this:** a reachable Cooper Hewitt source for current records
(the dataset updated, or the objects entering Open Access), which would move the
fixtures to `catalog_api` and supersede the snapshot's claims, not delete them.

---

## D48 — Expo Router for the capture app; a retake deletes; an unsent visit can be deleted

**Date:** 2026-10-04 · **Status:** accepted · **Decided by:** Doug (the router, the
three scope calls, and D41's reach); Claude's calls are marked · **Amends:** D33's
"no navigation library", D41's "one edit" · **Issues:** #25–#31

Doug walked the app looking for what makes it hard to reason about and hard to use, and
came back with four notes: venue selection should sit behind a "start a visit" button;
the upload opt-in belongs in a settings screen and says too much; a bad photo can't be
thrown away and retaken; and a visit can't be removed, so a visit shot only to reach
these screens stays on the phone for good.

**The router is Expo Router.** React Router and TanStack Router were the candidates
Doug knew or wanted to learn. Neither is a React Native router today: React Router v7
dropped `react-router-native`, and its core package under a `MemoryRouter` matches
routes but gives no native stack, swipe-back or transitions; TanStack Router supports
React DOM and Solid, with a React Native adapter still on a branch as of October 2026.
Expo Router is file-based routing over React Navigation, ships with Expo, and is what
an app like this is actually built with, so it is also the better use of the learning
budget. The reason to have a router at all is Doug's: the screens and their states
should be legible from the file tree, which `App.tsx`'s `Route` union and LabelFlow's
seven-step `Step` union are not.

It needs `react-native-screens` and `react-native-safe-area-context`, so it is a
native change and rides the next native build, F1's face blur, under D33's rule that
the app version and runtime version move together. That build is also when
`src/insets.ts`, D33's twelve-line stand-in for safe-area-context, goes away. Until
then the state machine stays, and the changes that don't need routes ship OTA in it
(Claude's call on sequencing).

**A retake deletes the frame.** "The label needed another frame" read as *the label
was too big for one photo*, not as *try again*. The action that means retake says
Retake, and the frame it replaces is actually deleted. Doug's reasoning: a blurred or
empty label frame is worth little to the corpus, and the focus problem the Met visit
surfaced was reported by the tester at the time, not inferred from the imagery
afterwards. Adding a second frame of a label that won't fit in one stays a separate
action, because the protocol asks for it on large case panels (capture-protocol, "two
frames if it won't fit"); that split is Claude's call.

**A removed photo comes off the commit marker** (Claude's call, found while building
the retake, and fixed with it at Doug's request). D41 kept every line but the frame's
own records byte for byte, so a visit that removed a photo before sending it still
claimed it in `take_ended`'s frame count. `ingest` would never have called that visit
complete. A removal now takes one off that count when the frame still had its file,
and replay counts only frames that will be sent. A frame whose records were already
sent is still a job for `tools/redact/`, as D43 says.

**A visit with nothing sent can be deleted.** Deletion is limited to visits from which
nothing has reached the corpus: none of the frames or records are in the upload ledger. A visit
started while sending was off always qualifies, and so does one that never had signal.
A visit that has sent anything still goes through `tools/redact/` (D42), because
deleting the phone's copy would leave the bucket's copy orphaned rather than removed.

**D41's "one edit" governs the corpus, not the learner.** D41 called a take
*evidence* and allowed it one change, redaction, so that the corpus would never be
tidier than the gallery was. That rule was written for the collector's build, and the
machinery under it was built to protect the identity of a child whose name was on a
label. It is not a precedent for the learner's own material. Later phases will let a
learner remove things from their taste profile and shape how their path is built.
That is Doug's stated direction, not yet written into PLANNING.md; it concerns §5's
private layer and §6's curriculum. Nothing about redaction should be read as limiting it. This is the
same distinction CLAUDE.md draws between the corpus and the private layer, applied to
edits.

**What would reverse this:** for the router, a TanStack or React Router release with
real native-stack support would not by itself be enough, since the migration cost is
paid once; Expo Router dropping support for the SDK would. For retakes, evidence that
discarded frames carried signal the tester's report didn't, which would bring back
keeping them with a `rejected` mark rather than deleting them.

---

## D49 — A found face is blurred unless the tester says it belongs to the artwork

**Date:** 2026-10-04 · **Status:** accepted, to be re-evaluated on more examples ·
**Decided by:** Doug (the policy, and its re-evaluation); Claude's calls are marked ·
**Settles:** field-beta §3's face blur and §8 proposal 2 · **Issue:** #35

Field-beta §3 planned to detect faces on the phone and pixellate every one before a frame
is kept, under D28's rule that a frame is blurred before it leaves the phone, since
blurring on the server means the unblurred frame was already sent. Before building
that, the face pass ran over the whole corpus on the Mac: 100 frames from MCNY, the Met
and Cooper Hewitt, the same Vision request the phone will make. It found eight faces,
and every one was part of the work: the seated marble goddess and the Egyptian figure at
the Met, the pharaoh in the facsimile painting, Alice in the MCNY mural, and sitters in
framed photographs. It found no visitor. The one frame with visitors in it, behind the
Egyptian figure, shows them out of focus, one cut off at the frame's edge and one
with a phone in front of their face; the pass left them alone, and a person detector
(Vision's human rectangles) found both, and the statue twice. No label or wall-text
frame had a detection, so blurring before OCR cost no reading.

Blurring every face would have pixellated the subject of every portrait and statue in
the corpus and protected nobody. So a found face is **pixellated by default, and the
tester can keep one that belongs to the artwork**. When a frame has faces, the app
shows it with each one marked; tapping a face keeps it, and that is recorded in the
manifest as the tester's claim (`kept`, `why: "artwork"`), the same standing as any
other claim. Skipping the step, closing the app, or ending the visit leaves the blur in
place. This is a step on the frames that have a face, which was 8 in 100 here.

**This is provisional by design.** Eight detections from three venues is enough to
show the problem, not to size it. Doug will collect frames with faces in them, real
visitors among them, on the next visit, and the policy is re-evaluated against them.
The policy lives in the app's JavaScript and the native module only finds and
pixellates (Claude's call). That means the re-evaluation can ship as an update, not a
native build.

**How it's built** (Claude's calls):

- **The face pass is its own shared file, `FaceCore.swift`, beside `OCRCore.swift`**,
  compiled into the same two hosts (D30). It's not part of OCRCore because it doesn't read
  text, and it's shared so the Mac can measure a change to it against the corpus, as it
  did above, before a phone build.
- **Every frame kind goes through it**, as §3 said. Labels had no detections, and a label
  in glass can reflect a face.
- **The visit's directory never holds an unblurred frame.** The frame is pixellated
  as it moves into the take. The unblurred original waits in the app's cache, which
  device backups exclude, only until the tester answers, and is deleted then. The
  camera-roll copy is the default-blurred one, written at save time. iCloud Photos
  would otherwise carry an unblurred copy off the phone. As a result, a kept face is
  blurred in the camera roll but not in the corpus.
- **Uploads hold a frame with faces until it has an answer.** The answer is a `faces`
  record after the frame's own. Ending the visit writes one for every unanswered
  frame, keeping nothing.
- **Faces only, not bodies.** A turned or out-of-focus face isn't found, and isn't
  identifying as a face. Clothing and build can identify someone too, but blurring
  every body would also blur every statue. That question waits for the examples.

**What "raw" means for a contributed frame**, field-beta §8 proposal 2, follows from
this. The frame that reaches `placard-raw` is the one the phone kept, with faces
pixellated except those the tester kept, and the unblurred frame never leaves the
phone. The blur count is in the frame record, and the kept faces are in the `faces`
record that follows it.

**What would reverse this:** examples where testers keep visitors' faces, by mistake
or carelessly, would argue for blurring every face. So would a corpus in which artwork
faces turn out rare. Visitors found by the person detector whose faces the face pass
misses would argue for adding bodies.

---

## D50 — Transcriptions are CC BY 4.0, and sending is consented to once, for three kinds

**Date:** 2026-10-04 · **Status:** accepted · **Decided by:** Doug (the license, and one
choice over three toggles); Claude's calls are marked · **Settles:** field-beta §8
proposal 6, and for F1 the D28 question of how per-kind consent renders · **Issue:** #30

**The transcriptions contributors help produce are published under CC BY 4.0.** That
covers the fixtures: what a label says, checked against the institution. The photos
themselves stay in the private store (field-beta §1), so they aren't licensed at all.
The code stays GPL-3.0. The consent screen names the license, since field-beta §8
wanted it settled before the first external tester.

**One choice, with the kinds named.** Field-beta §1 keeps consent per kind, using
D28's properties (`upload.label_photos`, `upload.artwork_photos`) plus
`upload.venue_photos`, and left open whether they show as three toggles or one
control. They show as one. The consent screen names all three kinds, and one "Send
them" agrees to all three. The phone still records them as three properties, so they
can be split later without asking anyone again. Separate toggles would let a visit
send some kinds of frame and not others, and a take's commit marker (D38) counts every
frame, so ingest would have to learn to call such a visit complete.

**How it's built** (Claude's calls):

- **The consent screen appears when sending is turned on, not before the first
  capture**, where field-beta §1 first put it. Nothing leaves the phone without that
  opt-in, and a tester who never turns it on keeps everything local. They should be
  able to try the app without first agreeing to send.
- **The opt-in records what was agreed to**: the three properties, the version of the
  consent text, and when. A change to the terms is a new version, and a tester who
  agreed to an older one is asked again before anything else is sent.
- **Settings holds the choice; the consent screen holds the terms.** The settings
  toggle gets one line, and every clause of the old paragraph moves to the consent
  screen, where each is something the tester agrees to.

**What would reverse this:** a tester who wants to keep one kind back, most likely
venue exteriors now that faces are blurred anyway (D49), would argue for the toggles,
along with the ingest change they need.
