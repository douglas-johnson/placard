# tools/curriculum-spike

A spike for #42, ahead of B1 and A2. It treats the verified fixtures as one learner's
`encountered` set (§7), pulls their neighbourhood from the museums' own records and from
Wikidata, ranks candidates with §6.1's bonus for connecting two things the learner already
knows, and prints suggestions in the app's voice. Its job is to let §13's two schema
questions — how far to take CIDOC CRM, and what seeds canonical facts — be argued from
evidence rather than in the abstract. It is not the canon and it is not the recommender.

```sh
# once: the Met's Open Access dataset (~320 MB, CC0), into the gitignored cache
curl -L -o tools/curriculum-spike/cache/MetObjects.csv \
  https://media.githubusercontent.com/media/metmuseum/openaccess/master/MetObjects.csv

python3 tools/curriculum-spike/spike.py [--top 10] [--claims out.ndjson] [--refresh]
python3 -m unittest tools/curriculum-spike/test_spike.py
```

Wikidata responses and the live Met lookups are cached under `cache/`, so a rerun is
offline. `identities.json` is the hand-checked match of non-Met makers to Wikidata.

## How it works

Every edge is held as a claim with its source, record and retrieval time (constraint 2).
Where an object hangs is kept apart as a display-state claim (§8.2), and the fixture's own
link to the learner is marked private. `--claims` writes all of them out, which is the
closest thing so far to a sample of what B1's tables will hold.

Each work has **facets**: maker, culture, period, object type, material, and subject tag.
How much a shared facet is worth is how rare it is across the Met's 470,000 objects
(`1/log2(2+n)`), so "terracotta" says little and "Cesnola Painter" says a lot. A candidate
scores the sum of its two strongest links to encounters, plus a bonus when it **bridges**
two encounters that shared nothing before, reached through different facets. That bridge
is §6.1's closing triangle: a new edge in the learner's map, not a new leaf.

Candidates come from the Met's Open Access CSV, not its search API (Claude's call). The
search API's bot protection blocked this Mac after about 80 requests at 20 a second on
2026-10-04, well under the documented limit, and the Met's own documentation sends anyone
enumerating the collection to the dataset. The dataset was last published 2023-06-17,
which is fine for canonical facts and stale for display state, so its gallery numbers only
nominate candidates: each suggestion is confirmed against the live API, one request a
second, and the run stops asking at the first 403. Every one confirmed so far was still in
a gallery.

## What it found, 2026-10-04

Twenty-nine encounters over three visits: MCNY (2026-09-16), the Met (09-20), Cooper Hewitt
(09-29).

**Closure works where the record is rich, and only there.** At the Met, where every
encounter is a full catalog record, the suggestions read as consolidation. A Terracotta
oinochoe by the same Cesnola Painter as the krater, and the same vessel shape as one of the
three glass vessels. A Hematite intaglio of Osiris that shares a goddess with the Kybele
statuette and Anubis with the Haremhab facsimile. Lancelot Crane's other Haremhab tomb
facsimile. All thirteen Met encounters are reached by some closure.

**Labels alone don't give it enough to work with.** The Cooper Hewitt and MCNY encounters
are what their labels say: a maker and a material, at most. Every closure that reaches one
of them goes through material — oil, ink, plaster — and eleven of the sixteen are reached
by none. The three visits share no maker, culture, period, type, material or subject at
all. The difference between a curriculum and a list is the catalog record behind the
label, which makes A2's identification the precondition for recommendations, not a
refinement of them. A venue without a rich public catalog (MCNY has no API) will produce
leaves.

**Contemporaneity alone is noise.** The first run counted overlapping dates as a link, and
the top ten were a drum, a Qajar tile and a column shaft, each "made in the same stretch of
time" as a Cooper Hewitt paper dress and a Kubrick photograph. §1's own example is time
*and* place — Caravaggio "painting in Rome around the same time" — which is a Production
event with a time-span and a place (§4.6), not two dates. A date facet was taken out; an
event node would put it back properly. That is evidence for event nodes in the CRM
question.

**The museum record carried every useful link; Wikidata carried the cross-visit ones and
the noise.** Culture, period, type and subject — the Met's own fields — made every closure.
Wikidata's art-historical relations are nearly empty for these makers: of eleven with an
item, one has a movement (Michael Graves, postmodern architecture), one an influence
(Kubrick), and four any linking property at all. What it did give is the only suggestions for the design encounters
that aren't about material: Graves was a member of the Memphis Group, which is a good
thing to look into next. And its noise: membership in the American Academy of Arts and Letters and an
alma mater of Harvard put Obama and Mark Twain first; weighting by rarity then promoted
Graves's high school, shared with a Second Lady and a basketball player. Schools were
dropped. Rarity measures how much a link narrows, not whether it means anything; which
kinds of edge are worth traversing is §4.9's question, and it needs an answer per property.

**Wikidata identifiers are the join key between institutions.** The Met's record for
Samuel Gottscho carries Q7411518, the item matched by hand from his MCNY label, so the Met's
39 Gottscho photographs join to that encounter with no name matching. Henry Dawkins is at
the Met too, on a 1780 Massachusetts banknote, but that record has no Wikidata link, so the
join would be entity resolution by name. Five of sixteen named makers have no Wikidata item
at all.

**What this suggests for §13 — proposals, not decisions:**

- *Seed source:* museum catalogs for canonical facts; Wikidata identifiers as the identity
  spine across institutions; Wikidata's relations as inferred claims (§4.8), traversed by
  property, never promoted on their own.
- *CRM depth:* event nodes earn their place on this evidence alone, since time without
  place produced the worst suggestions. Two of the fixtures already need more than a flat
  `Artwork`: a label for three glass vessels resolves to one catalog record (D12, D20), and
  a facsimile's interesting edge is to the tomb it copies, not to its painter.
- *Order:* identification against rich records (A2) before ranking (A3), and venue
  coverage weighted toward institutions whose records carry culture, period, type and
  subject — which the A0 venue criteria already favour for a different reason.

What it does not show: whether the suggestions *feel* like consolidation to a learner.
That is Doug's to judge from the report.
