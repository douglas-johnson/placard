# Capture protocol — stock Camera

For collecting the ground-truth label corpus before the app exists. The corpus is the
one asset in this project that can't be bought or scraped, so the discipline here is
worth more than the convenience of shooting freely.

Everything below exists to make the take **machine-segmentable without manual sorting.**
Shot order and timing are the only metadata a stock camera gives us for free.

This is the second version. The first was written before any visit and assumed a
tidy world of one work, one label, one accession number. The first visit (MCNY,
2026-09-16, thirty frames, nine fixtures) contradicted it in most of the ways that
matter, and the changes below are each traceable to a frame in
`data/labels/raw/2026-09-16-mcny/`.

---

## Before you leave — and prove it

- [ ] **Location.** Settings → Privacy & Security → Location Services → **Camera** →
      *While Using the App*, **Precise Location on**. Then **take one photo at home,
      open it in Photos, swipe up: there must be a map.** The first visit was shot
      with this off, and nothing on the phone hinted at it — every one of the thirty
      frames came back with no GPS block at all. Without it the venue prior in §4.1 is
      gone and each fixture has to establish its venue from the bookends instead.
- [ ] **Live Photos off.** Thirty frames arrived with twenty-four `.MOV` halves. No
      loss, half the files.
- [ ] **Settings → Photos → Transfer to Mac or PC → Keep Originals.** *Automatic*
      transcodes on the way over. Raw means raw.
- [ ] HEIC is fine; Vision and ImageIO read it natively. Don't change format mid-trip.
- [ ] Storage: ~3MB per still. 200 photos ≈ 600MB.
- [ ] Confirm photography is permitted. Permanent collection usually yes; special
      exhibitions and loans often no.

---

## The unit is the label, not the work

The first draft said "a triplet per work." The visit showed that labels and works are
not one-to-one in either direction, so the unit of capture is **the label**, and the
frames around it record what it applies to.

```
  A. THE LABEL         whole label, filling the frame, square-on
  B. THE WORK(S)       whatever the label governs — one frame per object,
                       immediately before or after the label, nothing between
  C. THE ACCESSION     tight crop of the accession line — ONLY if the line is
                       small, low-contrast, or you doubt it will read
```

**Shot A is the most valuable photo you will take.** The work photo is a visual
rerank signal; the label is the lookup key. If you only get one, get the label.

**Shot C is now conditional, and usually unnecessary.** On the first visit the crop
never added a character that the full-label frame didn't already have. The one hard
accession (`X2011.4.10368.168`, read three ways) was solved by re-reading the *same*
frame at three scales, not by a closer one. Take it when the line is genuinely tiny —
the cigar-case panel would have earned one — and skip it otherwise. Two extra frames
per label were a third of the take for nothing.

**Do not skip shot B because the work "has no text to read."** Work frames are
deliberately in the corpus as negatives. OCR of the Gillon greenmarket photograph
invented eight lines of letters from a building's window grid; OCR of the Zellin deli
photograph read real signage correctly. Both are wrong answers for different reasons,
and the pairing logic (D15) needs both kinds.

### The accession number

The museum's unique catalog ID for the object. It's usually the last line of the label,
fused onto the end of the credit line, and it's usually the smallest type there:

```
Artemisia Gentileschi
Italian, 1593–1656
Judith Slaying Holofernes
about 1620
Oil on canvas
Gift of Mr. and Mrs. R. H. McCormick, 1925.708
                                      └──────┘
                                      accession number
```

It's the string that dereferences the institution's own catalog record (§4.3). Formats
differ per institution and even within one — MCNY alone showed `2014.21`, `56.323.46`,
`2013.3.1.454`, `48.108.14A-B`, `X2011.4.10368.168` — so the rule is **locate, don't
validate** (D11). Never decide a string isn't an accession because it's the wrong shape.

### Framing

- Square-on. Oblique labels are the single most common OCR failure.
- Fill the frame. Don't include the wall around it "for context."
- Tap to focus **on the text**, not the wall.
- If there's glare, move rather than zoom. One step left usually kills it.
- **Shoot sideways if the label is sideways, and leave it.** Orientation is EXIF; the
  pipeline reads it. Rotating on the phone creates an edited render (`IMG_E…`), and for
  two frames on the first visit *only* the edited version came over, so the raw folder
  now holds a rotated copy and no original. Never crop, straighten, or adjust.

---

## Labels come in systems — shoot the whole system, once

The tidy tombstone is one dialect among several, and a single building uses more than
one (MCNY had four in three galleries). What you meet:

**A shared panel governing many works.** One black panel per photograph in the history
galleries; but in the photography gallery one artist card serves a group of prints,
each print with only a small card of its own. Shoot the shared panel **once**, then the
per-object cards with their works. Note in the field log which works it covers — shot
order alone will pair it with the next work only.

**A case panel with many objects.** The cigar-makers vitrine: one panel, six objects,
mixed ownership — two with MCNY accessions, three from private collections with none.
Shoot the panel (two frames if it won't fit; overlap them), then the case. One
fixture per accessioned object; the panel is `source_image` for all of them.

**A distributed label system.** The Champanier mural had a tombstone, a numbered
per-panel key, a bilingual artist biography and an exhibition wall text, on four
surfaces. Shoot each once and in order. Fixture `mcny-loan-champanier-alice-panel1`
rests on six frames. That's normal for a special exhibition, not an exception.

**Interpretive wall text.** The curator's paragraph. Step back so the block fills the
frame with its heading visible. It's a different extraction problem (§4.6) and should
look like a different kind of photo.

---

## Loans — two kinds, both wanted

**No accession anywhere.** The Champanier mural is lent from NYC Health + Hospitals
and has no number on any surface. Shoot it fully; the no-key path (§4.3, D17) needs
fixtures. Write `loan / no accession` in the log.

**Someone else's accession.** The Brooklyn Daily Eagle reads "Lent by Museum of
American Finance, New York City, 894.5." That number is real and it's the *lender's*
(D17 refinement). Make sure the credit line is sharp — it's what says which catalog
the number belongs to.

---

## Venue signage is a capture category, not a bookend

The first draft treated the entrance sign as a timestamp marker. It turned out to be the
best single frame of the day: MCNY's sandwich board carried the hours, "Free on
Wednesdays," three ZIP codes that get in free always, and the ramp location — the
entire access-rule model of §9 in one photo (D26).

**On arrival, before anything else:**

- the venue's name as displayed
- any board or panel stating **hours, admission, free days, resident rules**
- the **accessible entrance** sign if it's separate

**On leaving:** the exterior, and any signage you missed on the way in. These frames
also do the segmenting job — bookends plus timestamps sort a 200-photo take into
venues without naming files — but that's now the secondary reason to take them.

If the venue has a public collection API (Met, Brooklyn, Cleveland, Harvard), say so
in the log. Those are the venues where an extraction can be checked against the
institution's own record, which is what makes a fixture *verified* rather than
*label-only*. Every fixture from the first visit is label-only.

---

## Deliberately collect the hard cases

A corpus of clean, well-lit, square-on Helvetica labels will make the extractor look
great and tell us nothing. Go out of your way for:

| Hard case | Why it matters | Have it? |
|---|---|---|
| **Reflective glass / vitrine** | Most common real-world failure | yes |
| **Low light** | Photography and works-on-paper galleries are kept dim | yes |
| **Shared panel, many works** | Breaks 1:1 pairing | yes |
| **Case panel, mixed ownership** | Some objects have keys, some can't | yes |
| **Loan, no accession** | The degraded path | yes (×2 — MCNY, Met/Selinus) |
| **Loan, lender's accession** | Wrong-namespace trap | yes |
| **Bilingual label** | Field order differs per language | yes (en+es) |
| **Object that isn't art** | No artist, and that's correct (D23) | yes |
| **Vinyl-cut lettering on wall** | No label edge to detect | no |
| **Non-Latin script** | Asia Society, Japan Society | no |
| **Oblique angle, unavoidable** | High shelf, roped-off object | yes (Met vitrines) |
| **Attribution qualifier** | See below | two ("Attributed to", MCNY and Met) |
| **Gallery checklist** | Commercial galleries hand out a sheet instead | no |
| **Label and catalog disagree** | Same institution, two claims, different dates (§4.7) | yes (Met 26.3.29, 48.160.1) |
| **Facsimile / copy** | The artist is the copyist, not the original's maker | yes (Met 23.2.84) |
| **Two keys in one parenthesis** | `(23.2.84, 23.2.86)` | yes |

### Attribution qualifiers — collect these on purpose

A controlled vocabulary with precise meanings; flattening them destroys the influence
graph (§4.6). Every one you find is a high-value fixture:

> Attributed to · Studio of · Workshop of · Circle of · Follower of · After · Manner of ·
> Formerly attributed to · Unknown artist · and any "possibly" / "probably" hedge

The Dawkins print gave one and the Cesnola krater at the Met a second — and the Met's
API carries it in a separate `artistPrefix` field, so it survives on both surfaces.
Old-master and decorative-arts galleries will give the rest.

### Children's and student work — don't shoot the label

Student exhibitions (P.S. Art at the Met, school shows, community centre walls) label
each work with the child's full name, grade, school, and often the teacher's name. That
is identifying information about a minor, and it is the one thing this corpus must
never hold. **Do not photograph the label.** If the exhibition itself is interesting —
and P.S. Art is, as a case where the venue's own accession system doesn't apply — shoot
the *work* and the *exhibition wall text*, which carry everything we need without a
name. A label of this kind that gets shot by mistake is deleted from `raw/` the same
day, along with any OCR of it, and the manifest is edited to say so. That is the only
exception to raw's immutability, and it doesn't wait for a discussion. See
`data/README.md`, *Minors*.

---

## Field log

Notes on the phone, one entry per venue, plus a line whenever a shared panel governs
more than the next frame. Thirty seconds each.

```
Venue: <name>
Arrived: <time>
Free via: <always free / Wed / library pass / paid>      ← check against the sign
Photography: <permitted / permanent only / prohibited>
Labels: <approx count>
Shared panels: <"Kubrick card covers next 3"; "cigar case, 6 objects">
Loans: <"Champanier — no accession"; "Eagle — MoAF 894.5">
Notable: <bilingual; vinyl in lobby; checklist at desk>
```

---

## Next trip

The first trip's job was to find out what breaks; it did. The second trip has two
jobs:

1. **Prove GPS.** First photo of the day, swipe up, map. If there's no map, stop and
   fix it before shooting anything — a second unlocated take teaches nothing new.
2. **Get a verified fixture.** Pick a venue with a public collection API so at least
   one extraction can be checked against the institution's record rather than against
   the label alone. Everything so far is `label_only`.

Then the missing rows in the hard-case table, in the order they're likely to be found.

## When you get back

**Image Capture over USB** into `data/labels/raw/<date>-<venue>/`. AirDrop works if
*Options → All Photos Data* is on; Messages, Mail and the phone-to-agent channel strip
everything. Then, before anything else:

```sh
swift tools/exif/exif-check.swift data/labels/raw/<date>-<venue>/*.HEIC
```

Every line should show a time with an offset and a latitude. If it shows `none none`,
the location was lost either on the phone or in transfer — find out which before the
take is trusted. Originals are immutable from this point: everything downstream reads
from `raw/` and writes elsewhere.
