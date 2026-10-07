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

**But these encounters were never one learner's interests.** Doug pointed out that the
three visits were chosen for instructive labels, not out of a taste or a line of inquiry,
so "the visits share nothing" is the truth about the corpus rather than a failure of the
ranking. A learner may hold several interests at once; in the learner app they place each
encounter on a *path* (§6.3's thread), and recommendations are per path (D52). So `--only`
narrows the learner to a single path, and `--subject`
attaches what a label's text says a work is about, linked to Wikidata by hand and recorded
as an inferred claim. The one Revolutionary War capture from MCNY, Dawkins's *Liberty
Triumphant* (ca. 1774), run as a path of its own:

```sh
python3 tools/curriculum-spike/spike.py --only mcny-38.447.4
python3 tools/curriculum-spike/spike.py --only mcny-38.447.4 \
  --subject "mcny-38.447.4=Q192769:American Revolution"
```

- *As the label reads* — a maker and "engraving" — nothing. Twelve engravings were in a
  gallery in the 2023 data; the live API says none of them is today, because works on
  paper rotate (§13's decay half-life, measured). The Met's one Dawkins, a 1780
  Massachusetts banknote, joins only by name. Wikidata knows him as an engraver and
  nothing else.
- *With the subject the label's text names* — the American Revolution, which the
  fixture's `expected_relationships` had already drafted from the extended label (§4.6) —
  *Washington Crossing the Delaware* in gallery 760 and Trumbull's *George Washington
  before the Battle of Trenton* in 719, both confirmed on view. The right suggestions,
  from one inferred edge.
- *Either way, no closure.* A path of one has no two things to connect, so §6.1 has
  nothing to rank by; it can only open outward. A path's first suggestions are a
  different problem from its later ones, and they rank by relevance to the thread's
  subject, not by how they densify a map — the cold-start question (§13) at the scale of a
  path, which comes up every time a learner starts something new.

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

## Label text as a subject source, 2026-10-07

The path run above found the right suggestions for *Liberty Triumphant* only once the
subject its label names was linked by hand. This measures whether that generalizes:
what does the interpretive text across all three visits name, can it be linked, and
does it connect the Cooper Hewitt and MCNY encounters to anything?

```sh
python3 tools/curriculum-spike/resolve-subjects.py          # candidates for unlinked terms
python3 tools/curriculum-spike/label-subjects.py            # coverage, relationships, reach
python3 tools/curriculum-spike/label-subjects.py --relations about,depicts,context,influence,place,use,technique,maker
```

`label-subjects.json` holds the annotation: for each encounter, the frames of
interpretive prose bound to it (the object's own text, or a gallery or case text), and
each thing the prose names, with the relationship the text gives it and its scope. The
tombstone's own fields don't count. Each search term was resolved to Wikidata by hand
from the top candidates, or left null with a reason. **The annotation is Claude's reading
and is unreviewed.** It covers 30 encounters: the spike's 29 plus the MCNY cigar mold,
which the spike skips for having no title or maker.

**Labels carry subjects more often than expected.** 23 of 30 encounters have
interpretive text bound to them; 22 name something that links to a Wikidata item; 18
name a subject — something the work depicts or is about — and 17 of those from the
object's own text rather than a gallery's.

| | encounters | interpretive text | names a linked item | names a linked subject |
|---|---|---|---|---|
| Cooper Hewitt | 8 | 5 | 5 | 4 |
| MCNY | 9 | 6 | 5 | 4 |
| the Met | 13 | 12 | 12 | 10 |

The gaps are a label style, not a venue: MCNY's photography wall cards (Gillon, Zellin,
Kubrick) and three of Cooper Hewitt's design labels carry no prose at all.

**What the text names, by relationship:** depicts 35, context 28, about 18, place 15,
influence 11, maker 8, use 6, technique 3. Three things stand out. "About" is the rarest
of the subject relationships: labels mostly say what's shown and what was happening
around it. Context comes mostly from gallery texts (16 of 28), which is Linked Art's
pattern of an exhibition's idea being `about` something rather than each object.
And influence is how design labels talk — Bantjes's poster drawing on Islamic
calligraphy and blackletter, Boym's *Recycle* on Pop Art and flea markets.

**Linking works, with a tail.** 116 of 123 distinct terms resolved to an item. The seven
that didn't are a specialist typology (Mediterranean Group II glass), an exhibition
(*Divine Egypt*), an institution only its successor has an item for (the Whitney Studio
Club), three concepts with no item, and the siren of Greek myth, which name search
cannot find under the films, albums and villages called Siren. Name search is
resolution, and it needs a person or a better method behind it.

**But the subjects connect to nothing new.** With the 43 label subjects the Met's tags
didn't already supply added as facets, no encounter is reached that wasn't before; with
all 101 linked mentions of every relationship (the same exclusion), still none. Cooper Hewitt stays at 3 of 8 and MCNY at 2 of 8,
and every closure that reaches them still goes through a material. The reason is on the
candidates' side: of the 48 subjects linked from Cooper Hewitt's and MCNY's texts, **one**
— New York City — appears among the Met's tags. The Met's 1,154 tags describe what is
depicted, mostly in older art (men, women, portraits, flowers, horses); stereotypes, the
labour movement, the Great Depression, Pop Art and disposable products aren't in that
vocabulary. Wikidata does better on coverage — 41 of the 48 have some item that depicts
or is about them — but only 12 of those are Met works, and the counts are inflated by
"main subject" on books and scholarly articles.

**What this suggests — proposals, not decisions:**

- *Label text is a real subject source*, and the only one at venues without a rich
  catalog. Extracting subjects from interpretive prose (§4.6's relationship candidates)
  is worth building, each as an inferred claim with its relationship, not a bare tag.
- *A subject only recommends something if candidates carry subjects the same way.* The
  Met's tags and a label's prose are different vocabularies from different sources, so
  matching across them fails even when both are linked to Wikidata. Candidates need
  subjects drawn from their own interpretive text — which is what the corpus collects —
  or from Wikidata restricted to artworks.
- *For modern design and New York history, "look into" may matter more than "go see".*
  The Tea Act's chain of events, other Federal Art Project murals, the Memphis Group:
  Wikidata's events and works are where these paths lead, and the Met isn't.

Not measured here: whether an automated extractor finds what the hand annotation found,
and whether the relationships hold up under a second reader.
