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

**Date:** 2026-09-19 · **Status:** accepted · **Closes:** the §13 question "Is Wall Text the name?"

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

**Date:** 2026-09-19 · **Status:** proposed by Claude, awaiting Doug · **Builds on:** D29, D30, field-beta §5

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
