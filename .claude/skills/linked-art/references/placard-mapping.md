# Placard's claims in Linked Art terms — provisional

> **Status: working notes, not a settled mapping.** The facets below come from the
> curriculum spike (#42, `tools/curriculum-spike/`), which is still open: the research it
> started — how much a label's interpretive text can tell us about what a work is
> *about* — is continuing. Rows marked **open** are questions that
> research, or B1's schema work, has to answer; their answers go in DECISIONS.md, and this
> file is then revised to match. Treat every row as a hypothesis about where a claim
> lands, checked against Linked Art but not yet against Placard's data at scale.

The decisions this applies are D5, D52 and D53.

## Facets of a work, as the spike used them

| Spike facet | Source so far | Linked Art | Notes |
|---|---|---|---|
| **maker** | Met constituents; label | `produced_by` → `Production` → `carried_out_by` Person or Group; the person has `equivalent` → Wikidata / ULAN | Qualifiers per `objects-and-works.md`: "attributed to" is a *Possibly By* assignment, "workshop of" a Group, "after" `influenced_by`. The spike found the Wikidata `equivalent` is the cross-institution join key (Gottscho, Q7411518) |
| **culture** | Met `culture` ("Greek, Attic") | object `classified_as` a culture concept (Linked Art's CDWA mapping) | **Open:** the Met gives strings, not URIs. The spike's "Greek, Attic" → "Greek" was a string split; in Linked Art it's a concept with `broader`. Which vocabulary (AAT's cultures and nationalities, or Wikidata) is a B1 choice |
| **period** | Met `period` ("Geometric") | the object's `Production` `during` a `Period` record | `during`, not `part_of` (`time.md`) |
| **type** | Met `objectName` ("Krater") | object `classified_as` an AAT term, itself classified *Type of Work* (aat:300435443) | The spike's first-term heuristic stands in for entity resolution to AAT |
| **material** | Met `medium`; label | `made_of` → `Material` (AAT); the text as written is a *Materials Statement* | Material, not tool. The spike's first-term split stands in for a materials parser |
| **subject** | Met tags (with AAT and Wikidata URIs); label text, linked by hand for one fixture | on the object's `VisualItem`: `represents` (an identifiable thing), `represents_instance_of_type` (a kind), or `about` (what it evokes) | **Open, and the subject of the continuing research.** The Met's tags don't say which relationship they mean: "Birds" is a depicted kind, "American Revolution" a subject. Label text ("opposition to the Tea Act") looks like `about`, but one fixture is not evidence. How often interpretive text names a linkable subject, and which relationship it supports, is what the next part of the research measures |
| **era** (dropped by the spike) | object dates | `Production` `timespan`, plus `took_place_at` | The spike found time alone is noise. Time *and* place is a Production, which Linked Art already has |

## Other claims

| Claim | Linked Art | Notes |
|---|---|---|
| Accession number | `identified_by` an `Identifier` classified *Accession Number* (aat:300312355), `assigned_by` an assignment carried out by the museum | One object, two museums' numbers: two identifiers, each with its own assignment (Linked Art's example: a Kehinde Wiley portrait jointly owned by two Yale museums) |
| Accession suffix naming parts (`48.108.14A-B`) | the whole is a `HumanMadeObject`; each piece is its own record `part_of` it | D24: the suffix is structural, not formatting |
| Object with no accession (marked "private collection" in a mixed vitrine) | an object with no accession `Identifier`; ownership stated only as the label states it | D24, D17: record that it cannot be resolved, and stop |
| Label lines as read | `referred_to_by` statements: Description, Materials Statement, Credit Line (aat:300026687), Production Statement | **Open:** how a reading of the label, and the label itself, are modelled is part of the label-interpretation research |
| Title | `identified_by` a *Primary Name* per language | Label title and catalog title can differ (Cooper Hewitt's "Poster One"); both are claims, one is primary in a projection |
| Date | EDTF string (D5, Placard's own) → derived `TimeSpan` bounds + a Display Name | BCE bounds need the year-zero convention stated (`time.md`) |
| On view in gallery N | `current_location` → a `Place` classified *Gallery* (aat:300240057); history as `Move`s | Display state (§8.2). That it goes stale is claim metadata, not vocabulary |
| Exhibition and its theme | exhibiting `Activity` (aat:300054766) `influenced_by` an idea (`PropositionalObject`) that is `about` the theme | A candidate subject source for every object shown — not yet tested |
| Event a work is about (the Tea Act) | its own `Event` / `Activity` record with `equivalent` → Wikidata; chained by `caused_by` | Linked Art: depicted or discussed events "must have [their] own record" |
| Facsimile or copy (D12, D20) | its own `HumanMadeObject`; `Production` `influenced_by` the original | The Lancelot Crane facsimile and the Haremhab tomb |
| Unknown maker | `carried_out_by` a Group for unidentified makers | Not one placeholder Person per object |
| Student of / teacher of | an `AttributeAssignment` with a Display Name | Linked Art leaves it unmodelled (`assertions.md`) |

## Placard's extensions (D53), and why each is needed

| Extension | Why Linked Art doesn't cover it |
|---|---|
| The claim envelope: source, record, retrieval time, confidence, corroboration, verification, supersession | Individual links can't carry who asserted them; `AttributeAssignment` for that is "not encouraged" |
| Belief and inference (§4.8), after CRMinf | Linked Art doesn't include CRMinf |
| Mode of depiction ("allegorically") | CRM's P138.1 is a property of a property; excluded by the profile |
| The EDTF date string | Linked Art deferred EDTF (#218); bounds lose `~` and `?` |
| Display state that goes stale | Linked Art records current location, not how sure we still are of it |
| Paths (D52) | Private-layer data |

## What must never be mapped

- **A learner's encounter** is not Linked Art's `Encounter` (a discovery). It is private
  (constraint 1).
- **A path** looks like a Linked Art `Set` (a conceptual grouping, created and never
  destroyed). It is private, lives in the learner's store, and is never exported or
  joined into a canon projection.
- **Learner notes** are not statements on canon entities.
