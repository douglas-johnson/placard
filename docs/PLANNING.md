# Placard — Planning Document

**Status:** v0.10, draft for discussion
**Date:** September 2026
**Changed in v0.10:** Project renamed from *Wall Text* to *Placard* after a second name collision (D31). Repository made public; §12 now argues from the category of existing aggregators rather than from one site, and the site-specific analysis moved to private notes ahead of outreach (D32).
**Changed in v0.9:** Project renamed from *Art Book* to *Wall Text*. §11 phasing reordered — B0 split, its label-corpus half promoted to A0, Track A now leads. §12.5 and §13 updated for a name collision.

> **Reading this document.** It is long, and it is a *reasoning* document rather than a
> specification — it argues its way to positions and the arguments are load-bearing.
> Don't read it end to end to answer a narrow question. The map:
>
> | If you're working on | Read |
> |---|---|
> | Anything at all, first | §1 pedagogy, §3 requirements, §5 privacy tiers |
> | Camera, OCR, label parsing, accession numbers | §4 (all of it) |
> | Graph schema, ontology, event modeling | §4.6, §7, §8.3 |
> | Suggestions, ranking, threads | §6 |
> | Back office, review queues, verification | §8 |
> | Public site, markup, eligibility, "free to me" | §9 |
> | Stack, storage, what to build in what | §10 |
> | What to build next, and why in that order | §11 |
> | Prior art: existing aggregators, and partnership | §12 |
> | What is genuinely undecided | §13 |
>
> **Three constraints from this document override convenience everywhere in the codebase:**
> the privacy boundary in §5 and §8.5 (the back office has *no read path* to learner data —
> absent, not permission-gated); the claims model in §4.7 (nothing enters the graph as a bare
> fact); and the tone constraint in §1 (co-researcher, not instructor).
>
> §13 is open questions. An answer settled in conversation should be written down there or
> in `DECISIONS.md` — not left in a transcript.

---

## 1. What this is

Placard is a self-study art history curriculum builder. A learner photographs works that genuinely interest them, and the app grows a course of study outward from those encounters.

The pedagogy is borrowed from Reggio Emilia: curriculum emerges from the learner rather than being delivered to them. Three Reggio ideas do real work here, and they should constrain design decisions:

**Emergent curriculum.** No fixed syllabus. What gets studied next is a function of what the learner has already reached for. The app proposes; it never assigns.

**The teacher as co-researcher.** In Reggio the adult doesn't hold the answers — they investigate alongside the child and ask better questions. Placard's voice should be that of a curious peer, not an instructor. This is a tone constraint with teeth: prefer "Caravaggio was painting in Rome around the same time — want to see what that looked like?" over "Next lesson: Baroque tenebrism."

**Documentation.** Reggio classrooms document learning in progress, and the documentation *feeds the next provocation* rather than grading the last one. The learner's own photos and notes are not a scrapbook at the edge of the system. They are the primary input to what comes next.

A fourth idea, *the environment as third teacher*, is why physical presence matters. The learner standing in front of an object, reading the wall label, noticing the room it's hung in — that encounter is the raw material. The app is what happens around it.

---

## 2. Core loop

```
   ENCOUNTER              IDENTIFY               DOCUMENT
   photograph a    ──►    resolve to a    ──►    add what you
   work in person         known entity           noticed, felt,
                                                 wondered
        ▲                                             │
        │                                             ▼
   CONTINUE                SUGGEST               INTEGRATE
   go see the      ◄──    offer paths      ◄──   place it in the
   next thing             outward                learner's graph
```

Every arrow is a product surface. The two hardest are *Identify* (§4) and *Suggest* (§6).

---

## 3. Requirements

### Functional
- Capture a photo of a work in situ; capture the wall label; capture location
- Resolve the photo to a known artwork with a confidence score, with graceful failure
- Let the learner record free-form notes, and structured reactions, at the point of encounter
- Maintain a per-learner model of interests, familiarity, and open threads
- Generate study suggestions: about the artist, the work, its period, its influences and descendants
- Track exhibitions near the learner and surface ones that connect to their threads
- Filter and schedule by what's actually reachable — cost, eligibility, hours, travel — with the eligibility profile held on-device
- Accumulate a shared, growing body of knowledge about what is currently on public display

### Non-functional
- **Privacy is a hard boundary, not a setting.** No learner ever sees another learner's notes, photos, or interest profile. Shared knowledge is derived and de-identified. See §5.
- Identification should feel instant in a gallery. Target under 3s for a confident match, and the app must work degraded with no signal — museums have bad connectivity. Capture always succeeds offline; resolution can queue.
- Solo developer. Every architectural choice is also a learning-budget choice.

### Explicit learning goals for the builder
Knowledge-graph AI, personalization, data warehousing. These are stated goals, so the design should route *through* them rather than around them — but §10 notes where the simplest solution and the most educational solution diverge, and says so honestly.

---

## 4. Identification and extraction

### 4.1 Identifying the work

The naive approach is image-embedding similarity against a catalog of artwork photographs. That alone will disappoint, because gallery photos are taken at an angle, under warm light, behind glass, with heads in the frame.

Use three signals and fuse them:

**a. The wall label.** OCR of the placard is the highest-value signal and the most overlooked. It usually contains artist, title, date, medium, and often an accession number — which is a primary key. A learner can be nudged to take two shots: the work, then the label. Frame this as documentation practice, not as a technical workaround.

**b. Location.** GPS plus a venue registry narrows the candidate set from "all art" to "the roughly 3,000 objects this institution has on view." This is an enormous prior and it makes the visual matching problem tractable.

**c. Visual embedding.** CLIP-style embedding, nearest-neighbor against the narrowed candidate set. Fine as a ranker once (a) and (b) have done the hard filtering.

Fusion: candidate set from location → text match from OCR → visual rerank → confidence score. When confidence is low, ask rather than guess: show three candidates and let the learner choose. A wrong silent identification poisons the learner's graph; an honest question is a Reggio-appropriate interaction anyway.

**Catalog sources.** Several museums publish open collection APIs with images and CC0 metadata — the Met, the Art Institute of Chicago, the Rijksmuseum, Harvard Art Museums, Cleveland — and Wikidata plus Europeana provide broad, if uneven, coverage. Start with two or three institutions and a single city. Do not attempt global coverage in v1.

### 4.2 What a label actually contains

Before designing extraction, notice that the tombstone label is a **known form**, not free text. Near-universally the same fields in the same order:

```
Artemisia Gentileschi            ← artist
Italian, 1593–1656               ← nationality, life dates
Judith Slaying Holofernes        ← title
about 1620                       ← date, with uncertainty marker
Oil on canvas                    ← medium (finite vocabulary)
Gift of Mr. and Mrs. R. H.       ← credit line → donor, patronage
   McCormick, 1925.708           ← accession number → PRIMARY KEY
```

Regional and institutional dialects vary, but the form holds. That makes this semi-structured record parsing, not general document understanding, and the pipeline should exploit that rather than handing everything to a language model and hoping.

Often there's a second element: an **interpretive paragraph** written by a curator. That's prose, it's genuinely rich in relationships — influences, subjects, historical context — and it needs entirely different handling (§4.6).

### 4.3 The accession number reframes everything

The single most valuable thing OCR can extract is the accession number. With it plus the institution, you dereference the museum's own catalog record, which has dramatically richer and more accurate data than a label printed for a wall: full dimensions, provenance chain, exhibition history, bibliography, credit line, curatorial department, sometimes conservation notes.

**So the label's primary job is to be a lookup key, not a data source.** Extract the accession number, hit the API, and the label's other fields become a cross-check on the result rather than the payload.

This changes what "good extraction" means. Accession number recognition should be tuned hard — it's a constrained pattern (`1925.708`, `M.2003.45.1`, `inv. 1234`, `NG6461`) and each institution has a recognizable format, which you know because you know the venue from GPS.

The fallback path — no accession number visible, or no API for this institution — still needs to work, but it should be understood as the degraded mode.

### 4.4 The extraction pipeline

```
photo ─► region detect ─► OCR ─► layout parse ─► field extract
                                                       │
                          ┌────────────────────────────┤
                          ▼                            ▼
                  accession found?              deterministic
                  dereference API                 patterns
                          │                            │
                          └──────────┬─────────────────┘
                                     ▼
                              normalize to
                           controlled vocabularies
                                     ▼
                              reconcile against
                            authorities + canon
                                     ▼
                              emit CLAIMS
                          (with source + confidence)
```

**OCR on-device.** Apple's Vision framework text recognition is good, free, and works offline. That matters more than it sounds: museums have terrible connectivity, and capture must never fail because of signal. OCR locally, queue the rest.

**Deterministic patterns before any model.** Accession numbers, date ranges, circa markers (`about`, `c.`, `ca.`, `before`), dimensions, and medium — which is a finite controlled vocabulary, not open text. These are regex-and-lookup problems and solving them deterministically is faster, cheaper, and more debuggable than model inference.

**Constrained model extraction for the remainder.** Structured output against a schema, with the deterministic fields already filled in as context. The model's job is the messy residue, not the whole label.

### 4.5 Normalization and reconciliation

Extraction produces strings. The graph needs entities. Two steps get you there, and both are standard practice worth learning under their proper names.

**Normalize to controlled vocabularies:**

| Field | Target |
|---|---|
| Artist | Getty **ULAN** (Union List of Artist Names) |
| Medium, technique, object type | Getty **AAT** (Art & Architecture Thesaurus) |
| Places, nationalities | Getty **TGN** (Thesaurus of Geographic Names) |
| The work itself | Getty **CONA**, Wikidata |
| Dates | **EDTF** (ISO 8601-2) |

EDTF deserves a note. Art dates are fuzzy in ways ordinary date types can't express — "about 1620", "1620–25", "before 1640", "17th century". EDTF is a real standard designed for exactly this, with syntax for uncertainty (`1620?`), approximation (`1620~`), and intervals (`1620/1625`). Adopting it early avoids the trap of storing `1620` as an integer and silently losing the "about," which then propagates into a curriculum that speaks with more confidence than the evidence supports.

**Reconcile** the normalized values against existing canon entities. This is the same entity-resolution problem from §8.1, and the Getty vocabularies are what make it tractable — resolving to a ULAN ID once means every later mention of that artist, in any spelling, collapses to the same node.

### 4.6 From fields to edges — and why the model should be event-centric

Here's the architectural recommendation that came out of thinking this through.

The binary-edge model sketched in §7 (`artwork —created_by→ artist`) handles a tombstone label fine. It handles **provenance and exhibition history badly**, and those are where the curriculum-relevant richness lives.

Consider a provenance line: *"Collection of Durand-Ruel, Paris, by 1890; sold Christie's, London, 12 June 1923, lot 45; to a private collection; acquired by the museum 1951."* That's four ownership intervals, two transfer events, three places, two dated transactions, and a dealer who connects to hundreds of other works. Binary edges can't hold it without inventing awkward reified structures.

**CIDOC CRM** (ISO 21127) is the cultural heritage ontology built for this, and it's **event-centric**: instead of `artwork —created_by→ artist`, you model a *Production* event with participants, a time-span, and a place. Acquisitions, exhibitions, sales, and conservation treatments are all events with the same shape. **Linked Art** is the modern, practical profile of CIDOC CRM that Getty, Yale, and others actually use — much more approachable than the raw standard.

This is worth serious consideration for three reasons:

1. Provenance chains, exhibition histories, and ownership intervals become natural rather than contorted.
2. It's the professional standard, so museum data ingested in Rung 2 or 3 (§9.5) increasingly arrives in this shape already.
3. It would teach ontology design properly, which is a stated learning goal, and event-centric modeling is the concept that most changes how you think about graphs.

The cost is real: CIDOC CRM is verbose, and a naive adoption will produce a model that's miserable to query for simple things. A reasonable middle path is to model *events* as first-class nodes — Production, Acquisition, Exhibition, Sale — while keeping the ontology homegrown and CRM-shaped, then align to Linked Art at the ingestion and publication boundaries rather than internally.

**Attribution qualifiers are not decoration.** Labels say "Attributed to," "Studio of," "Workshop of," "Circle of," "Follower of," "After," "Manner of." These are a controlled vocabulary with precise meanings, and flattening them all to `created_by` destroys exactly the information that makes the influence graph interesting. *Follower of Caravaggio* is not a weaker fact about authorship — it's a strong fact about **influence propagating**, which is prime curriculum material. Preserve the qualifier on the production event.

**The interpretive paragraph** is the best source of lateral relationships: influences, subjects, responses to other works, historical context. Extract relationship *candidates* from it with a model, but every one of them enters the §8.1 review queue as low-confidence. Curatorial prose is interpretive by design, and it's written to be engaging rather than precise.

### 4.7 Everything is a claim

Nothing extracted from a label enters the graph as a fact. It enters as: *the label at venue V, photographed on date D, asserted that this work is by Artemisia Gentileschi, about 1620.*

That matters because **labels are wrong more often than people expect.** They're simplified for a general audience, they lag scholarship by years or decades, attributions get quietly revised, and a reprinted label may not reflect the current catalog record. A label is a good source, not an authoritative one — which slots it into the source-type ranking from §8.3, below the institution's own catalog and well below verified scholarship.

The confidence ladder for this pipeline, roughly:

| Source | Confidence |
|---|---|
| Accession number matched to institutional catalog | Near certain |
| Deterministic pattern extraction from label | High |
| Model extraction from tombstone fields | Medium-high |
| Model extraction from interpretive prose | Candidate only — review queue |
| Inference (§4.8) | Candidate only — review queue |

### 4.8 Inferred edges

Some useful relationships aren't asserted anywhere and can be derived:

- `contemporary_of` — overlapping lifespans plus shared city
- `possibly_taught` / `possibly_influenced` — teacher chains from ULAN, or temporal + geographic + stylistic proximity
- `shared_patron` — two works with the same donor or commissioner
- `depicts_same_subject` — normalized iconographic subjects

These are genuinely valuable for §6.1's triangle closure, because inference tends to find exactly the lateral connections that make a learner's existing map denser.

They must carry an `inferred` source type permanently, and the §8.2 rule applies: **inference must never launder into verified fact.** An inferred edge that a verifier confirms becomes a verified edge with a citation; one that merely goes unchallenged stays inferred forever.

### 4.9 Which edges are worth the trouble

Not all extracted relationships earn their place. The test is whether an edge can carry a *story*:

**High curriculum value** — `influenced_by`, `taught`, `responds_to`, `commissioned_by`, `exhibited_alongside`, `depicts_same_subject`, `shared_patron`. These are lateral connections between people and works. They support narration, and they're what §6.1's triangle closure operates on.

**Necessary but inert** — dimensions, accession number, credit line. Required for identity and dereferencing; nobody ever learned anything from a canvas measurement.

**Deceptive middle** — `has_medium`, `part_of_movement`. These look like useful connections and mostly aren't, because they group too coarsely. Every Baroque painter is `part_of_movement → Baroque`, which means that edge connects everything to everything and tells the learner nothing. Watch for edge types with pathological degree distributions; they'll dominate a naive recommender and produce suggestions that feel random.

Worth tracking, per edge type, how often suggestions built on it get taken. That's a straightforward warehouse query and it will probably reorder this list within a few months of real use.

---

## 5. The three-tier knowledge model

This is the architectural answer to "ever-growing and reusable, but never exposing personal notes." Three stores, one direction of flow, with a filter at each boundary. Nothing ever flows downward.

```
┌─────────────────────────────────────────────┐
│  PRIVATE LAYER  (per learner, never shared) │
│  photos · notes · reactions · interest       │
│  weights · thread state · suggestion history │
└──────────────────┬──────────────────────────┘
                   │  PROMOTION FILTER
                   │  strips identity · requires
                   │  corroboration · keeps only
                   │  objective claims
                   ▼
┌─────────────────────────────────────────────┐
│  SHARED CANON  (internal, cumulative)        │
│  artworks · artists · movements · venues     │
│  exhibitions · "work W on view at V, date D" │
│  every claim carries provenance              │
└──────────────────┬──────────────────────────┘
                   │  VERIFICATION GATE
                   │  human or trusted-verifier
                   │  sign-off (§8)
                   ▼
┌─────────────────────────────────────────────┐
│  PUBLISHED LAYER  (public web, machine-      │
│  readable)  verified events only · schema.org│
│  markup · source and social-proof links (§9) │
└─────────────────────────────────────────────┘
```

The third tier is new as of v0.2 and it changes the canon's job. The canon is now a working store containing claims of varying confidence, and publication is a distinct, deliberate act. That gives verifiers a concrete purpose: they are the gate between "we think this is true" and "we are telling the public this is true."

**What promotes:** the objective fact of an *observation*. "Accession 1942.51 was observed on public display at Venue V on 2026-09-13." Nothing about who saw it, in what order, or what they thought.

**What never promotes:** notes, photos, reactions, dwell time, sequence of visits, interest vectors. These stay in the private layer permanently.

> **Clarification, added 2026-09-16.** This section governs what becomes *shared knowledge*. It is not a claim about where the private layer is stored, and it does not forbid the service from processing a learner's own photo on their behalf. Those are different questions with different answers — see `DECISIONS.md` D28. The rule here is about promotion, and promotion is unchanged: a photo never becomes canon, and no learner ever sees another's material.

**Guards on promotion:**
- A sighting becomes canon only when corroborated — by *k* independent learners, or by the venue's own published data. Pick a *k* and treat it as a privacy parameter, not a tuning knob. With *k* = 1 a single visitor's itinerary becomes public record.
- Coarsen timestamps to the day. Sub-day timing plus a rare object can re-identify a visitor.
- Rate-limit per learner, so a single prolific user can't have their entire museum route inferred from the canon's growth pattern.

The pleasing consequence: the canon gets more valuable to everyone as it grows, and a learner's contribution to it is real but untraceable. Worth writing this down as a user-facing promise early, because it's a genuine differentiator and it's much harder to retrofit than to design in.

---

## 6. The curriculum problem

*The stated hardest problem: expansion that feels like a journey you can return to, not an endless uphill climb.*

The failure mode is specific and worth naming. Every discovery reveals more unexplored territory. Progress bars move backward. The learner opens the app and sees a debt. Duolingo-style completion metrics actively cause this when the denominator grows — and here the denominator is *all of art history*, so it always grows.

Five design commitments, roughly in order of how much they matter:

### 6.1 Prefer closing triangles to adding leaves

This is the central idea. When ranking what to suggest next, favor nodes that **connect two or more things the learner already knows** over nodes that extend outward into new territory.

Learning that Artemisia Gentileschi trained under her father and absorbed Caravaggio — when you already know both Caravaggio and have seen an Artemisia — is *consolidation*. It makes your existing map denser and more coherent. It feels like understanding.

Learning about a wholly unfamiliar artist in an unfamiliar period is *expansion*. It feels like more homework.

Both are necessary. But most systems only do the second, and the ratio is the lever. A frontier ranked with a strong bonus for triangle closure will feel, subjectively, like the field is getting *smaller* and more navigable even while the learner's graph grows. That inversion is the whole trick.

### 6.2 Show a horizon, not a map

Never render the full graph or the full set of available topics. Show only the immediate neighborhood of where the learner is — a handful of adjacent possibilities. The territory beyond is implied, not displayed. The unexplored should feel like an open country you're walking into, not a checklist you're behind on.

### 6.3 Threads rest, they don't lapse

Model a line of inquiry as a **thread** with states: `active` → `resting` → `active`. There is no `abandoned`, no `overdue`, no decay meter. A thread the learner touched in March and returns to in November should greet them warmly with what they'd found and the question they'd left open — not with a guilt notification.

This is the "journey you can return to" requirement, implemented as a state machine. It costs very little and does a lot.

### 6.4 Every thread has closable loops

Long arcs need short satisfying units. A thread should have natural resting points that feel like arrival: *you've now traced how Caravaggio's lighting reached Utrecht and came back to Rembrandt.* Small, complete, narratable. The learner should be able to say what they learned in one sentence.

Generating these is a real design challenge — they're story shapes, not fact lists — but they're the difference between a curriculum and a queue.

### 6.5 Measure depth, never coverage

Surface metrics that can only go up and are never relative to a total: works encountered, threads closed, connections made, places visited. Never percentages. Never "12 of 340." The denominator is unbounded and displaying it is a promise you'll break.

### 6.6 Reachability is a constraint, not a judgment

Some frontier candidates are places to go, so cost, eligibility, opening hours, and travel time belong in the ranking. A suggestion the learner can't act on is an invitation to a door that's locked.

**"Free to me" is a first-class mode, not an advanced setting**, and when it's on it genuinely filters. Surfacing things at $30 with the price attached, over and over, is a worse experience than not surfacing them — it adds scrolling and says nothing the learner doesn't already know. The filter is under the learner's control with a visible toggle; the app never decides silently in either direction.

**Cost and time are the same shape.** Someone who works Friday evenings is shut out of MoMA's free window exactly as effectively as someone who can't pay. Treating availability and eligibility as one class of constraint is both simpler to model and more accurate — there's nothing special about the money one.

**The one thing reachability never touches is the graph.** You can read about a Vermeer you can't go see. Access governs the *where to continue in person* surface, not what the curriculum is willing to teach — and that holds regardless of budget, for the learner in another country as much as the one saving money.

**Work with the rhythm rather than against the constraint.** A learner whose access is Friday evenings and free Saturdays has a *cadence*, and that's useful information rather than a limitation to route around. The interesting surface for that person isn't what's hidden — it's what opens next: which free window is coming, what's on then, which threads it would advance. Treated properly, "free to me" is a scheduling primitive, not a subtraction.

---

## 7. Data model sketch

**Canon entities:** `Artwork`, `Artist`, `Movement`, `Medium`, `Place`, `Institution`, `Exhibition`, `Theme`, `HistoricalEvent`

**Event nodes** (per §4.6): `Production`, `Acquisition`, `Sale`, `Exhibiting`, `Treatment` — each with participants, a time-span, and a place. This is the CIDOC CRM–shaped middle path: events are first-class, so ownership intervals and exhibition histories have somewhere to live, without adopting the full ontology internally.

**Canon edges:** `created_by`, `influenced_by`, `taught`, `depicts`, `commissioned_by`, `responds_to`, `held_at`, `contemporary_of`, `part_of_movement`, `on_view_during`

**Private overlay** — a parallel edge set from learner to canon nodes:
`encountered` (with photo, place, date), `noted`, `familiar_with` (weighted), `thread_open_on`, `suggested_but_declined`

The overlay is where personalization lives. It's a bipartite graph layered on the canon, which means the recommender is doing link prediction on a heterogeneous graph — exactly the knowledge-graph AI territory that's a stated learning goal.

**Exhibition matching** falls out of this cleanly: an exhibition resolves to a set of canon nodes; score it by overlap and adjacency to the learner's open threads; surface the top few within travel distance.

---

## 8. Back office

A separate application for curating the canon. Not a screen inside the learner app — a different product, different deployment, different auth, different users.

### 8.1 What it does

- **Review queue.** Claims awaiting a decision, ranked by curriculum impact. A contested attribution or a wrong birth date outranks almost everything, because those propagate into every suggestion built on top of them.
- **Entity resolution.** The same painting arrives from Wikidata, from the Met's API, and from a wall label with three title spellings. Machine-propose merges, human-confirm. This queue never empties and it is the main ongoing labor of the system.
- **Edge curation.** Assert, correct, or retire relationships. `influenced_by` is a claim, not a fact, and art historians disagree about it in ways the graph should be able to represent.
- **Provenance inspection.** For any claim, see where it came from and who has touched it.
- **Publication gate.** Move verified events into the published layer (§9). Unpublish when something changes.
- **Verifier administration.** Invite, scope, suspend.
- **Audit log.** Every action, attributable and reversible.

### 8.2 Three classes of claim, three mechanisms

Verification is not one gate. There are three kinds of claim in the canon and they are verified by fundamentally different means:

| | **Canonical facts** | **Access policy** | **Display state** |
|---|---|---|---|
| Examples | Birth and death dates, training, attribution, dating of a work, who influenced whom | Free Friday 5:30–8:30 for NY State residents; reservation required; photography permitted | Work W is hanging at venue V; exhibition E runs through March |
| Verified by | Expertise and sourcing — checked against scholarship | **Dereferencing the authority** — the institution's own page | Observation and consensus — corroborated sightings |
| Who | Human verifiers, third-party experts | Mostly a machine (§8.6) | Learners in aggregate; eventually institutions themselves (§9.5) |
| Time constant | Years. Stable once settled. | Months, but changes without notice. | Days. Constantly changing. |
| Failure cost | **High.** A wrong date corrupts every suggestion built on it. | **Medium, and acutely felt.** Someone crosses a city and is turned away. | Low. A different work than expected. |

**Access policy is the odd one out, and in a useful way.** The institution is *definitionally* the authority — there is no scholarly disagreement about whether MoMA is free on Friday, because MoMA decides. That makes verification mechanical rather than expert: fetch the page, compare to the stored claim, flag divergence. Almost all of this class can be verified without a human, which is what makes §8.6 tractable.

**Start with canonical facts** for curriculum quality. They're the priority, and it's worth being explicit about why: if the graph believes Caravaggio influenced someone who predated him, every path the recommender traces through that edge is nonsense, and the learner has no way to tell. Display errors are annoying; canonical errors are silently corrosive.

They're also the class that can be worked on immediately, with zero users, which is what makes Track B viable on its own.

**Epistemics don't cross over.** A verifier cannot verify by expertise that something is hanging on a wall today — they'd have to go look. A thousand sightings cannot establish when Artemisia Gentileschi was born. No amount of user consensus overrides an institution's own stated policy. The system should never let one mechanism launder a claim of another class, and the UI should never present them as the same kind of "verified."

**Display claims need confidence decay.** A sighting is evidence about a moment, and its value as evidence about *now* falls off fast. A sighting from yesterday is strong; one from eight months ago says almost nothing, though it may say something useful about the venue's habits. Model this as an explicit decay function on display claims rather than a boolean — and let the public calendar reflect it honestly, including by dropping entries whose confidence has decayed below the publishing threshold.

Access-policy claims decay too, but differently: not toward uncertainty about reality, toward staleness of the check. A policy claim last verified against the source eight months ago should be re-fetched, not discounted.

Canonical facts don't decay. They get *revised*, which is rarer and different — attributions are overturned, technical analysis redates a panel — and that's what supersession in §8.3 is for.

### 8.3 Provenance is the data model change

Adding verification means claims can no longer be bare edges. Every assertion carries: who asserted it, from what source, when, at what confidence, who has corroborated it, who verified it, and what superseded it.

In RDF this is named graphs or RDF-star; in a property graph it's edge properties; in the Postgres property-graph schema from §10 it's columns on the edges table. Whichever, **the shape is the same and it's worth learning under its proper name** — statement-level metadata is one of the genuinely hard parts of knowledge-graph work, and most tutorials skip it because it makes every example twice as long.

One rule follows immediately: **nothing is ever hard-deleted.** Claims are superseded, and the superseded version stays queryable. A verifier who marks an attribution wrong has added information, not removed it.

Provenance also needs a **source-type** dimension, because sources are not equally trustworthy and the ranking differs by claim class. For display state, roughly: institutional feed > corroborated sightings > single sighting > scraped listing. For canonical facts: verified scholarship > institutional catalog > Wikidata > inferred.

One caveat on that ordering, worth designing for rather than discovering: **an institutional feed is not automatically right about display state.** A feed reports what's *scheduled*; sightings report what's *actually there*. A gallery closed for renovation, a loan returned early, a work pulled for conservation — the feed lags reality and the sightings don't. When they conflict, that's signal, not error. Surface the conflict in the back office rather than letting the higher-ranked source silently win.

### 8.4 Verifiers

Trust is tiered and scoped, invitation only:

| Tier | Can do |
|---|---|
| Contributor | Propose claims and corrections |
| Verifier | Approve canonical claims within their scope |
| Steward | Invite and scope verifiers; resolve verifier disputes |

**Scope matters as much as tier**, and with fact-checking as the initial focus, scope is about **expertise domain** rather than building: period, region, medium, individual artist. Someone qualified on Italian Baroque attribution has no special standing on Edo-period woodblock prints. An unscoped verifier is an admin with extra steps.

Institutional scoping still matters, but later — it's the right model for the display-state work, where a curator's authority is over their own building. Two different scoping schemes for the two claim classes in §8.2.

Expect disputes, especially on attribution, where genuine scholarly disagreement is normal rather than exceptional. The system should record the disagreement rather than resolve it by last-write-wins. A contested claim is a legitimate state, and the curriculum can say so — "attribution is disputed" is itself a good thing to teach.

### 8.5 The hard boundary, restated

**The back office has no read path to the private layer.** Not permission-gated — absent. No query, no join, no export, no debug view. This includes you. Admin tools are the single most common place where privacy promises leak, because the leak always arrives disguised as a reasonable debugging need.

The §8.2 split makes this much easier to hold. Verifiers work on canonical facts, and canonical facts have nothing to do with any individual learner — you check a birth date against scholarship, not against anyone's photos. The privacy-sensitive class of claim is display state, and that's handled by aggregate corroboration and institutional feeds, neither of which needs a human to look at one person's evidence.

Where the tension does resurface, keep it contained:

1. Only surface sightings for review **after** they've cleared the corroboration threshold, so no single learner's presence is inferable from the queue.
2. Treat sightings as **tips rather than testimony** — a signal that prompts a check against the venue's own listing, not the proof itself.
3. If a learner photo is ever shown to a human, require explicit per-photo opt-in, strip EXIF, and never show it alongside anything else by the same learner.

Option 2 is the one to lean on, and §9.5 eventually makes it mostly moot.

### 8.6 Corrections

A correction is not a special case. It's a claim with source type `user_correction`, entering the same provenance model as everything else. That's the whole design, and it means corrections need almost no new machinery — just a good path in and a good path out.

**Make correcting cheap at the moment of failure.** The person standing outside a museum that turned them away is the one with the information and the only one with the motivation. One tap, in context, pre-filled with what the app believed. Do not make them remember to fill in a form later — they won't, and that was the highest-value signal you'll ever get.

**Failed trips outrank everything in the review queue.** They're the most acutely felt failure, they're rare, and they're the one kind of negative evidence a system like this almost never collects. Most feedback loops only hear from people for whom things worked.

**Most corrections should resolve without a human.** This is what §8.2's third class buys you:

```
correction arrives
      ▼
classify by claim class
      ▼
access policy? ──► re-fetch institution's page NOW
                         ▼
                   agrees with correction? ─► auto-apply, log both
                   agrees with stored claim? ─► reject, tell the user why
                   ambiguous or page changed shape? ─► review queue
```

A user correction *triggers* the authority check rather than waiting for the next scheduled crawl. Corrections about display state route to sighting corroboration instead; corrections about canonical facts route to a scoped verifier. Same intake, three destinations.

**Run the authority check on a schedule too**, not only on correction. Diff each institution's stated policy against the stored claim; divergence goes to the queue. This catches the silent changes nobody reports, which are the ones that rot a calendar.

**Corrections are sightings in disguise.** "I was here and it was closed" reveals presence at a place and time, so the §5 rules apply: de-identify, coarsen the timestamp, rate-limit per user. A correction system is an easy place to accidentally build a location log.

**Some corrections aren't data errors.** "The free tickets were gone" isn't a wrong claim — it's a *capacity* fact, and a useful one. "Free but you need to book a week ahead and they go fast" is exactly what a visitor needs to know and what no aggregator records. Capture practical obtainability as its own property rather than forcing it into true/false.

**Publish corrections, don't hide them.** Since citability is the goal (§9), a visible correction history is a trust asset: *corrected 3 March, source: institution's admissions page*. `dateModified` carries the signal in markup. A calendar that visibly fixes itself is more credible than one that silently edits, and it's a differentiator against the aggregators that are quietly wrong.

**Corrector weighting, minimally.** Users whose corrections keep being confirmed can carry more weight. Keep this small, never surface it, and be aware it's a per-user reputation score living in a system otherwise designed to avoid those. The auto-verification path above should make it mostly unnecessary.

---

## 9. Public calendar and AEO

A public, server-rendered, machine-readable calendar of art events the system knows about. Every entry carries links to the source and to independent corroboration, so a reader — human or machine — can check that the event is real.

It serves three purposes at once, which is why it's worth the effort:

1. **A public good.** A verifiable, well-structured exhibition calendar doesn't really exist in one place.
2. **Dogfooding.** Placard's own agents read events from here. That gives the quality bar teeth: if our own tooling can't reliably answer a question from this site, no external answer engine can either.
3. **Distribution.** Being the source that answer engines cite is a better acquisition channel for a niche tool than competing for search rank.

### 9.1 Schema.org modeling

The vocabulary is better than expected for this domain. Nothing here needs inventing.

| Concept | Type |
|---|---|
| Exhibition | `ExhibitionEvent` (and/or `VisualArtsEvent`) |
| Venue | `Museum`, `ArtGallery`, or `Place` with `PostalAddress` + `GeoCoordinates` |
| Artwork | `VisualArtwork` — has `artform`, `artMedium`, `artworkSurface` |
| Artist | `Person` |
| Institution as organizer | `Organization` |

Key properties to get right:

- **`workFeatured`** links an `ExhibitionEvent` to the `VisualArtwork`s in it. Schema.org's own documentation uses the exhibition case as the example, so this is the intended path — and it's the property that makes the calendar useful rather than decorative.
- **`startDate` / `endDate`**, with `eventStatus` (`EventScheduled`, `EventPostponed`, `EventCancelled`) and `eventAttendanceMode`.
- **`sameAs`** → the institution's official page for the exhibition. This is the primary source link.
- **`subjectOf`** → press coverage as `NewsArticle`, institutional posts as `SocialMediaPosting`. This is the social proof, expressed in vocabulary an answer engine already understands.
- **`isAccessibleForFree`**, **`offers`**, **`dateModified`**.

Note the one gap: **schema.org has no property for "how confident are we that this is true."** `additionalProperty` isn't available on `Event`, so don't bend it. Express verification status in the visible HTML, and if it must be in the JSON-LD, use a custom namespaced property rather than misusing a schema.org one. A wrong-but-valid property is worse than an honest custom one, because parsers will believe it.

### 9.2 AEO mechanics

Answer engine optimization is mostly unglamorous and mostly the opposite of the last decade of SEO advice:

- **Server-render everything.** Many crawlers don't execute JavaScript. This alone rules out a SPA for the public site. A client-rendered calendar is invisible to the audience it's built for.
- **JSON-LD in the page head**, one canonical page per event, stable semantic URLs.
- **Say it in the prose too.** Answer engines extract passages, not just markup. Dates, venue, and what's on view should appear in readable sentences, not only in structured data. Write the page so a paragraph lifted out of it is still a correct and complete answer.
- **Let the crawlers in.** `robots.txt` should explicitly allow GPTBot, ClaudeBot, PerplexityBot, Google-Extended, Applebot-Extended, CCBot. The default advice elsewhere is to block these; here they're the point.
- **Sitemap, plus a plain JSON feed and an `.ics` feed.** Cheap, and the ICS makes the calendar useful to humans in a way that generates the social signals the AEO wants anyway.
- **`llms.txt`** is an emerging convention for pointing AI tooling at clean markdown versions of content. Unofficial and unevenly supported — worth doing because it's nearly free, not worth designing around.
- **`dateModified` and genuine freshness.** Stale event data is worse than no event data, and answer engines increasingly weight recency signals.

### 9.3 The dogfood test

Define the acceptance criterion concretely and early: *an agent with only web access should be able to correctly answer "what Caravaggio is on view in Chicago in November" from this site alone.* Keep a small set of these as regression tests. They're cheap to write and they'll catch structural problems that no amount of markup validation will.

### 9.4 A caution

Publishing this makes you a publisher. Wrong dates send people across a city for nothing, and a calendar that's wrong twice is one nobody checks a third time. The verification gate in §8 isn't bureaucratic overhead — it's the thing standing between an AEO win and an authoritative-sounding source of bad information, which is exactly the failure mode answer engines amplify fastest.

Publish less, verified. The corollary: the public calendar should be comfortable saying it doesn't know.

### 9.5 The institutional path

Eventually institutions tell us directly what's on display. That's the endpoint, but it's a ladder rather than a leap, and the rungs get progressively better without needing anything from the institution until quite late.

**Rung 1 — take what's already public.** Open collection APIs, plus scraping "what's on" pages. No cooperation required. This is where B1 starts.

**Rung 2 — parse the structured data they already emit.** Here's the convergence worth noticing: **many institutions already publish schema.org `Event` markup on their own exhibition pages**, because their marketing teams did it for search. That's the same vocabulary §9.1 uses for publishing. So the ingestion format and the publication format are the same thing, and the schema.org work pays off twice — once going out, once coming in. Building the parser is mostly building the validator you need anyway.

It also gives a concrete, low-effort ask: *"add `workFeatured` to the markup you already have."* That's a request a web team can act on in an afternoon, which is a very different conversation from "adopt our API."

**Rung 3 — a real partner feed.** Object-level display status keyed by accession number. Museums already have this internally; collection management systems like TMS and eMuseum know what's on view, it just doesn't leave the building. A push endpoint or a polled feed, authenticated per institution, writing into the canon at the highest source-type tier — with the §8.3 caveat that "highest tier" still doesn't mean automatically correct about physical reality.

**Why an institution would do it.** The incentive is the same AEO argument that motivates the public calendar: *their exhibitions become citable by answer engines.* Museums are already noticing that discovery is shifting away from search, and most have no strategy for it. "Give us structured display data and your shows show up when someone asks an AI what's worth seeing this weekend" is a genuine offer, not a favor request. It's likely a better pitch than anything about the learner app.

Worth designing the data model so Rung 3 is a new source type rather than a new system — the claim shape shouldn't change depending on who asserted it.

### 9.6 Eligibility and "free to me"

"Free" is a predicate over two things: a venue's access rule and a person's circumstances. Modeling it that way makes it a filter everywhere — the calendar, the map, and the curriculum.

**Access rules are structured, not prose.** Store conditions the machine can evaluate:

```json
{
  "audience": "resident",
  "region": "US-NY",
  "recurrence": "FREQ=WEEKLY;BYDAY=FR",
  "window": "17:30-20:30",
  "reservation": { "required": true, "lead_time": "P7D" },
  "obtainability": "competitive"
}
```

The eligibility dimensions in play, from B0: state residency, city residency, age bands (under 16, under 25), student and faculty status, specific institutional affiliation, membership, SNAP/EBT, veteran or active military, teacher, disability access, and public library card — NYPL, BPL, and QPL all offer reservable culture passes, which is close to a universal unlock in this city.

**The profile never leaves the device.** SNAP/EBT status is an income proxy; disability status and age are sensitive on their own. So:

> **The canon publishes *rules*. The private layer holds the *profile*. The client computes the *intersection*.**

`freeForMe(rule, profile)` runs on the phone. The server learns which venues a person viewed, at most — never why they qualify.

This is what makes the feature buildable rather than fraught. The alternative — a server that knows who's on SNAP — would be a genuine liability, and avoiding it isn't a constraint on the feature, it's what lets the feature be as useful as it should be without anyone having to think twice about turning it on.

**Availability is an eligibility condition too**, and a less sensitive one. A free window on Friday at 5:30 is worthless to someone who works Friday evenings. The genuinely useful computation is availability × eligibility × exhibition interval × travel time, and that's what produces "when could I actually go."

**Publish the conditions in the markup.** This is where §9.1's custom eligibility property earns its place. An answer engine asked *"what can a student see free in New York on a Thursday"* needs structured conditions to reason over, not a prose sentence saying discounts may be available. Being the only source that can answer that question is a real AEO position.

#### The curriculum consequence

Access constraints reach into §6, since some frontier suggestions are places to go. The rules there:

- **When "free to me" is on, it filters.** No price-annotated teases. The toggle is visible and the learner owns it.
- **Availability and eligibility are one constraint class.** Working Friday evenings excludes you from MoMA's free window as surely as an empty wallet does.
- **The knowledge graph is never filtered.** You can learn about a work you can't visit; access governs only the go-see surface.
- **Show what opens next.** For a learner on a free-window cadence, the useful surface is the upcoming window and what it makes reachable — not a list of what's excluded.

**The constraint is also less limiting than it sounds.** New York's free tier skews contemporary, folk, outsider, non-Western, university, and community-rooted — the Bronx Museum, Queens Museum, American Folk Art, El Museo del Barrio, the Studio Museum, MoMA PS1. A free-weighted curriculum isn't a thinner version of the encyclopedic-museum canon; it's a different one, and arguably better suited to a pedagogy built on personal encounter. That's a claim worth testing rather than asserting (§12), and if it turns out free-weighted graphs really are thinner, the fix is better coverage of free venues and stronger non-visit learning paths — not weakening the filter.

---

## 10. Technology

| Layer | Choice | Note |
|---|---|---|
| Learner client | React Native + Expo, iOS first | As specified. Expo's camera and location modules cover the capture path. |
| Back office | Next.js + TypeScript, web only | Desktop, data-dense, keyboard-driven. React Native is the wrong tool. Consider Refine or React Admin to skip building CRUD scaffolding by hand — the interesting work is the review queue, not the forms. |
| Public site | Next.js, static or ISR | Server-rendered is non-negotiable per §9.2. Static generation with revalidation fits a calendar that changes daily, not hourly. |
| API | FastAPI (Python) | Keeps ML, graph, and API in one language. TypeScript for the API layer adds a boundary you'd have to maintain alone. |
| Primary store | Postgres | Three schemas — private, canon, published — with separate credentials per application. The back office credential has no grant on the private schema at all. Enforce §5 and §8.5 in the database, not the application. |
| Vectors | pgvector | Same database. Avoid a separate vector store until scale demands it. |
| Graph | Postgres, recursive CTEs at first | See note below. |
| Warehouse | DuckDB locally → BigQuery when it hurts | dbt for modeling. |
| Events | Simple append-only event table before any message broker | Sighting, note, suggestion shown, suggestion taken, thread opened/rested/closed. |

**On the graph database.** The honest engineering answer is that Postgres with recursive CTEs will handle this workload for a long time. The honest *learning* answer is that Neo4j or Memgraph would teach graph modeling, Cypher, and traversal thinking much faster. These conflict.

Suggested resolution: build v1 on Postgres, but design the schema as an explicit property graph — nodes table, edges table, typed relations — rather than as normalized relational tables. Then porting to a graph database later is a migration rather than a rewrite, and the modeling discipline is learned either way.

**On the warehouse.** The events above are what feeds personalization. Worth instrumenting from day one even though the analysis comes much later, because you cannot retroactively collect the data that tells you whether §6.1 actually works.

---

## 11. Phasing

**Revised v0.9.** Two things changed since v0.8, and together they reorder the whole plan.

First, an existing aggregator already publishes an NYC exhibition calendar (§12). Half of what B0 was for — assembling free-art listings by hand to learn how wrong the aggregators are — is now better served by using that site as a human and reading §12.2 for the failure modes. That research is largely done, by someone else, in public.

Second, the half of B0 that *isn't* redundant is the half that mattered more: **the ground-truth label corpus.** No one else has it, no one can sell it, and it is the only thing that lets §4's extraction be evaluated rather than eyeballed. That work starts with a phone and a free afternoon.

So B0 splits. Its calendar half collapses into §12.4. Its corpus half is promoted to **A0** and leads the project, which means **Track A now goes first** — a reversal of v0.8, where Track B led because it could be validated without users. The justification for that reversal is that A0 and A1 *are* the validation, with the builder as the first user, and they exercise §4 — the extraction pipeline — which is the part of this system with the most technical risk and the longest learning curve.

Track B doesn't disappear. It gets less urgent, because the calendar it was racing toward is occupied.

---

### A0 — The label corpus

**Starts immediately, with a stock camera. Runs continuously; never really finishes.**

The procedure is in [`docs/capture-protocol.md`](docs/capture-protocol.md), which is the operational version of everything below and should be treated as the source of truth for how to shoot.

**Why it can't wait for the app.** The corpus is an input to designing the app, not an output of it. Shooting a hundred labels by hand is how you find out that region detection has to handle vinyl lettering, that half of contemporary labels have no accession number, and that glare is the dominant failure — none of which is discoverable from a desk.

**What success looks like.** Unchanged from v0.8, and still the best statement of the goal:

1. **300–500 photographed labels across 15+ institutions**, each paired with the verified correct extraction. Versioned as a fixture set from day one. Deliberately include the hard cases: reflective glass, oblique angles, low light, vinyl-cut lettering, non-Latin scripts, extended labels, and every attribution qualifier you can find.
2. **First-hand knowledge of how wrong the existing data is** — which §12.2 now partly supplies for free, but seeing it yourself calibrates §8 and §9 differently.
3. **A hand-written schema.org corpus** documenting where the vocabulary breaks for this domain. Reduced in priority, since B3 is no longer a calendar rebuild, but the eligibility gap (§9.6) is still unoccupied and still worth modeling by hand before modeling it in code.

**Venue selection criteria.** Score candidate venues on research value, not prominence:

| Criterion | Why |
|---|---|
| Public collection API | **The highest-value criterion.** Lets you ground-truth an extraction against the institution's own catalog record. Without it you're eyeballing. |
| Accession number format | Each institution differs. Format diversity is what stress-tests the §4.3 parser. |
| Label convention variety | A Met tombstone and a New Museum label look nothing alike. Encyclopedic, contemporary, single-artist, decorative arts, and university galleries all differ. |
| Extended labels present | Interpretive paragraphs are the §4.6 relationship-candidate source. |
| Photography permitted | Hard constraint. Loans in special exhibitions often carry restrictions the permanent collection doesn't. |
| Non-Latin script | Asia Society, Japan Society, and similar will break naive OCR in informative ways. |

**Always-free art venues** make the best backbone because they carry no timing constraint: American Folk Art Museum, Bronx Museum, Queens Museum, the Museum at FIT, the Drawing Center, MoMA PS1 (free to everyone since January 2026), plus university galleries like Grey Art Museum, the Wallach, and Hunter.

**Timed windows** cover the majors — MoMA Friday evenings, Whitney Friday evenings and second Sundays (and free daily for under-25s), Guggenheim pay-what-you-wish Saturdays, Brooklyn Museum First Saturdays, Frick pay-what-you-wish Wednesdays, Morgan Library Tuesday and Sunday afternoons, Museum of the City of New York on Wednesdays.

**Every detail above needs verifying against the institution's own site before you go.** Treat this document as a starting hypothesis, not as data — that's the point of the MoMA example below.

**Museums give labels; galleries give calendar density.** Commercial galleries usually don't have wall labels — Chelsea and Lower East Side galleries are always free and extremely dense, but they typically hand you a printed checklist at the desk instead of putting tombstones on the wall. With the calendar half of B0 deprioritized, this resolves cleanly in favor of museums: **weight heavily toward museums with public collection APIs.** Photograph checklists when you encounter them, since it's a distinct extraction problem probably in scope eventually, but don't plan trips around galleries any more.

**The MoMA lesson, retained.** Searching for MoMA's free hours returns three different answers from three aggregators: every Friday 5:30–8:30 for New York State residents with advance reservation (MoMA's own site); first Friday of the month, NYC residents, from 4pm (Time Out); every Friday 4–8pm, free to everyone (a third aggregator). Only the first is correct. Aggregated art calendar data is systematically wrong, nobody notices, and the errors propagate because aggregators cite each other. That's the whole §9 argument, available before writing any code.

---

### Track A — the learner app

**A1 — Encounter.** Capture, OCR, location, manual identification against a small hardcoded catalog from one or two museums. No suggestions yet. Goal: is the capture ritual something you'd actually do standing in a gallery?

A1 has an obvious first milestone now that A0 is running: **the app should beat the stock camera at collecting the corpus.** That's a concrete, testable bar — paired shots enforced, venue captured automatically, accession number read on-device and shown back for confirmation — and it's a much better target than "a capture screen exists."

**A2 — Canon integration.** Real collection APIs, entity resolution, visual matching, the promotion filter. This is where Track A and Track B meet, and it's the earliest point at which B1 becomes a blocking dependency rather than parallel work.

**A3 — Curriculum.** The private overlay, frontier ranking, threads, suggestions. This is where §6 gets tested.

**A4 — Proximity.** Personalized exhibition surfacing, "where to continue" — reading from the same canon that feeds the public calendar.

### Track B — canon, back office, calendar

**B1 — Canon and minimal admin.** Ingest collection data from a few institutions, plus whatever "what's on" data is publicly available (Rung 1). A back office with exactly two screens: entity-resolution review and canonical fact review. Provenance modeled properly from the first row, including source type, since retrofitting statement-level metadata means rewriting every query.

B1 is now paced by A2 rather than racing ahead of it. The minimum viable B1 is whatever A2 needs to resolve a photographed label to a canon entity — which is a much smaller thing than the v0.8 conception.

**B2 — Fact-checking at depth.** Canonical claims for a bounded scope — one period, or one city's holdings. This is the work that curriculum quality rests on.

**B3 — Public calendar.** One city, schema.org markup, source and social-proof links, confidence decay on display claims, the dogfood tests from §9.3. **Scope revised after §12:** existing aggregators already cover NYC listings, so this is not a calendar rebuild. What's genuinely absent is structured `Event` markup, deduplicated entities, and admission and eligibility data — build those, and consider whether the right form is a published layer over the graph rather than a competing calendar.

**B4 — Verifiers.** Invitation, expertise scoping, dispute states, audit log. Invite people once there's a curated graph worth their attention — an empty review queue is a bad first impression, and so is a queue full of obvious junk.

**B5 — Institutional ingestion.** Rung 2, then Rung 3 with the first willing partner.

### Why the order changed

v0.8 led with Track B on the grounds that its risk — *can the data be kept accurate enough to publish?* — is answerable with zero users, while Track A's risk — *will anyone actually photograph and annotate work in a gallery?* — is behavioral and can't be engineered away.

Both of those remain true. What changed is the answer to "which risk is cheapest to retire first."

- Track A's behavioral risk is **retired by A0, not by A1.** If the builder won't photograph labels on a free afternoon with no app at all, no capture UI will fix that. So the behavioral test costs an afternoon and starts today.
- Track B's operational risk is **partly retired by prior art** (§12.1). Someone else has been running the Rung 1 scraper daily and it works. That's the expensive assumption, de-risked for free.
- And Track A carries the **technical** risk that neither track's original framing named: §4's extraction pipeline is the hardest engineering in the document and the one with the longest learning curve. Starting it early is worth more than sequencing it neatly.

The two-track independence still holds and is still worth exploiting. It's the starting order that flipped, and the trigger was discovering that the calendar was already built.

---

## 12. Prior art: existing exhibition aggregators

At least one free, independent guide to temporary exhibitions at NYC museums already exists, built the way §9.5 proposed: a daily scraper over the museums' own websites, each listing linked back to the institution's page, no commissions taken. Finding it after this plan was drafted is a gift rather than a setback, for reasons worth setting down.

One thing is deliberately *not* set down here. The close reading of any one site — which of its records are duplicated and by what DOM pattern, where its venue mapping has drifted — is the kind of thing to offer someone in conversation, not to publish about them. It lives in private notes until that conversation has happened (D32). What follows is the part that shapes this plan, and it holds for the category rather than for one site.

### 12.1 What it settles

**The Rung 1 hypothesis is confirmed by someone else's operational experience.** §9.5 proposed scraping museum sites daily as the zero-cooperation ingestion path. Someone has been running exactly that, daily, and it works. That's a de-risked assumption obtained for free.

**The architecture matches the plan where it counts.** Server-rendered, stable per-exhibition URLs, canonical tags, every listing sourced to the institution's own page. The §9.2 fundamentals are largely there.

**And the AEO gap is real.** The pages carry standard meta and Open Graph tags, but no `Event` JSON-LD — no `startDate`, `location`, `workFeatured`, or `organizer` in machine-readable form. The most current NYC exhibition data in existence is sitting in prose that answer engines have to guess at. That is precisely the opening §9 was betting on, and it is now observed rather than assumed.

### 12.2 What aggregator data reveals about the hard problems

Reading an aggregator's listings closely surfaces exactly the failure modes §8 is designed around — which makes any of them an unusually good natural experiment:

**Entity resolution failures are visible and frequent.** Exhibitions appear twice under slightly different titles when a scraper catches two DOM patterns on the same museum's site — a short title and a longer variant naming the artists, or one clean copy and one with the date range fused onto the front. CMS artifacts leak through: a "Protected:" prefix, a trailing colon from a truncated heading. This is the §8.1 review queue with nobody staffing it, and it's the strongest possible argument that a scraper without an entity-resolution pass produces a calendar that slowly doubles.

**Venue mapping drifts.** A show from one museum ends up under another museum's URL slug. Scraper-to-venue bindings rot silently.

**Permanent installations leak into a temporary-exhibitions list**, some with obvious sentinel end dates decades out. "Temporary" turns out to need a definition.

**No admission or eligibility data at all** — by design; the aggregators point you to the museum's page for ticket prices. That's the entire §9.6 free-to-me layer, unoccupied.

### 12.3 The strategic consequence

The public calendar was carrying two jobs in this plan: a public good, and the AEO acquisition channel. An existing aggregator does the first job, well. So:

- **Don't rebuild an NYC exhibition calendar.** That's now the redundant part.
- **The differentiators are the four things they don't do:** structured `Event` markup, entity resolution, admission and eligibility, and verification with corroboration.
- **Don't architect around a partnership that doesn't exist.** They may not be interested, may not reply, may have plans of their own. Everything in this document should stand alone; collaboration is upside, not a dependency.

Where the AEO advantage actually sits, and what that implies for positioning, is in the private strategy notes rather than here (D32).

### 12.4 Using them for B0

For the research phase, use an aggregator as a human. Open it, find a free show, go. That's exactly what it's for.

**Do not scrape them.** Two reasons, one practical and one relational. Practically, their data is itself scraped from museums, so re-scraping a scrape compounds every extraction error rather than correcting it — go to the same sources they go to. Relationally, ingesting someone's dataset before talking to them is the single most reliable way to make a later collaboration conversation impossible.

**Do use them as a benchmark**, which is different and entirely fair. Build the §8.6 authority checker, run it against the museums directly, and diff the result against what the aggregators show. Every disagreement is either a bug in your scraper, a bug in theirs, or a museum that changed something. That three-way comparison is the fastest available way to calibrate the checker, and it costs nothing.

**Test the AEO thesis early.** Ask a few AI assistants what free art is on in New York this Friday and see whether the existing aggregators get cited. Ten minutes, and it either confirms the core bet or kills it before any code is written. Either result is worth having.

### 12.5 On approaching them

*Struck 2026-09-22.* This section carried outreach tactics — how to open the
conversation, what to lead with, how to frame it. It has been removed from this document
and from the private notes alike; it was speculative advice about a conversation that
has not happened, and it aged badly against D31's rename. What survives of it is the
constraint now in §12.3: nothing here may depend on a partnership existing.

The reasoning that referenced this section (D31, and the prior-art rule in D32) is
unaffected — both record what it said at the time, which is what a decision entry is
for.

---

## 13. Open questions

Commercial and positioning questions — licensing of the published layer, and whether the
public site acknowledges the app — are held in the private strategy notes instead (D32).

- **How much does the learner see of their own graph?** A visible map is motivating and also risks becoming the coverage metric §6.5 warns against.
- **What happens with art encountered outside museums?** Street art, architecture, objects in books. Probably in scope eventually, but it breaks the location-prior in §4.
- **Cold start.** A learner's first session has no graph to grow from. Is the first suggestion generic, or does the app ask a few questions, or does it lean entirely on whatever they photographed first?
- **Does the app ever teach directly?** Reggio resists instruction, but an adult self-learner may genuinely want a straight explanation of, say, what tempera is. Where's the line between provocation and lecture?
- **What is the promotion parameter *k*?** A concrete number needs choosing, and it trades coverage against privacy.
- **What motivates a verifier?** They're doing unpaid expert labor. Attribution on the public calendar? Institutional visibility? Access to aggregate data? This needs an answer before the invitations go out, not after.
- **How far to go with CIDOC CRM?** §4.6 proposes event nodes with a homegrown ontology, aligning to Linked Art only at the boundaries. The alternative — adopt Linked Art internally — costs query ergonomics but buys free interoperability with every museum that already speaks it. This is the biggest open architectural call in the document.
- **Is provenance research in scope?** Ownership chains are curriculum-rich, and they also lead directly into Nazi-era looting, colonial acquisition, and restitution disputes. These are real art history and a self-study curriculum that routes around them is doing a disservice — but they need care, and the system should present documented gaps and disputes rather than drawing conclusions.
- **Who nudges the second photo?** The label shot is the highest-value capture and the easiest to forget. Making it feel like practice rather than a chore is a design problem, not a technical one.
- **What is the seed source for canonical facts?** Wikidata is broad and uneven; museum catalogs are accurate but narrow and disagree with each other. The starting corpus determines what verifiers spend their time on — correcting bad data or extending thin data are very different jobs.
- **Does free-weighting narrow a graph, or just reshape it?** §9.6 argues it reshapes. Testable once there's warehouse data — compare graph breadth across access modes. If it does narrow, the fix is better free-venue coverage and stronger non-visit paths, not a weaker filter.
- **How much does a correction reveal?** Corrections are sightings with extra detail attached, and a prolific corrector is a user whose movements become legible. The rate limits and timestamp coarsening need real numbers.
- **How is eligibility collected without it feeling like a form?** Not a dignity problem so much as a friction one — nobody wants to fill in nine checkboxes before seeing a calendar. Probably: ask nothing up front, infer what's inferable, let unlocks be discovered and added one at a time, and say plainly that the answers stay on the device.
- **How does a disputed claim behave in the curriculum?** §8.4 says contested is a legitimate state, but the recommender still has to decide whether to traverse a disputed edge. Probably yes, with the dispute surfaced — but that's a design decision, not a default.
- **What's the decay half-life on display claims?** Needs a real number, and it probably differs by venue type — a permanent collection hang and a rotating works-on-paper gallery decay at very different rates.
- **How are cancellations and date changes detected?** `eventStatus` handles the markup; noticing that something changed at the source is unsolved and is the main way a calendar rots. Rung 2 ingestion helps a lot here.
