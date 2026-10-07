# Core patterns

Checked 2026-10-07 at commit `bcbff17` (see `../upstream.txt`).
Sources:
[base](https://github.com/linked-art/linked.art/blob/bcbff1761e65f44eeaeb92b4b2b83da2783539f8/docs/model/base/index.md) ·
[intro](https://github.com/linked-art/linked.art/blob/bcbff1761e65f44eeaeb92b4b2b83da2783539f8/docs/model/intro/index.md) ·
[profile](https://github.com/linked-art/linked.art/blob/bcbff1761e65f44eeaeb92b4b2b83da2783539f8/docs/model/profile/index.md) ·
[required vocabulary](https://github.com/linked-art/linked.art/blob/bcbff1761e65f44eeaeb92b4b2b83da2783539f8/docs/model/vocab/required/index.md) ·
[recommended vocabulary](https://github.com/linked-art/linked.art/blob/bcbff1761e65f44eeaeb92b4b2b83da2783539f8/docs/model/vocab/recommended/index.md) ·
[concepts](https://github.com/linked-art/linked.art/blob/bcbff1761e65f44eeaeb92b4b2b83da2783539f8/docs/model/concept/index.md) ·
[collections](https://github.com/linked-art/linked.art/blob/bcbff1761e65f44eeaeb92b4b2b83da2783539f8/docs/model/collection/index.md)

## Every entity

- `id`: exactly one URI. `type`: exactly one class. `_label`: a developer-facing string,
  never shown to users.
- **Core classes:** `HumanMadeObject` (physical things), `DigitalObject`, `Person`,
  `Group`, `Place`, `VisualItem` (image content), `LinguisticObject` (text content),
  `PropositionalObject` (abstract works, e.g. the idea of an exhibition), `Type` (and its
  subclasses `Material`, `Language`, `Currency`, `MeasurementUnit`), `Set`, `Activity`.
- **Terminology the docs use:** *Object* = physical thing; *Work* = conceptual content an
  object carries (`VisualItem`, `LinguisticObject`, `PropositionalObject`); *Concept* = a
  categorization that is not a work.

## `type` versus `classified_as`

`type` is the ontology class, from a short fixed list. `classified_as` points to a
controlled-vocabulary term — AAT "whenever possible" — and carries everything more
specific: painting, accession number, museum, gallery. Never put a vocabulary term in
`type` or a class in `classified_as`. Core entities SHOULD have at least one
classification.

**Meta-types ("types of types").** When the set of possible classifications isn't
enumerable, the classification itself is classified so software can recognize what sort
it is: "Painting" is classified as *Type of Work* (aat:300435443); "Dutch" as
*Nationality* (aat:300379842). Where a required term exists for the meta-type, it MUST be
used.

**Broader vs classified.** A concept's `broader` is a more general concept that
encompasses it (visual works ⊃ paintings). Its `classified_as` is the category it belongs
to (painting is a *type of work*). Concepts should have both. Compound concepts ("history
of France") use `influenced_by` on the concept's `Creation`, because France is a `Place`,
not a `Type`. Linked Art concepts align with SKOS; concept schemes are `Set`s.

## Names, identifiers, equivalents

- **Names:** `identified_by` → `Name` with `content`. Exactly one *Primary Name*
  (aat:300404670) per language. *Display Name* (aat:300404669) labels a statement or
  stands in for structured data such as a time-span.
- **Identifiers:** `identified_by` → `Identifier` with `content`, classified as e.g.
  *Accession Number* (aat:300312355). Identifiers carry no language. When two
  institutions assign their own numbers to one object, each identifier is `assigned_by`
  an `AttributeAssignment` carried out by its institution (see `assertions.md`). Linked
  Art's example is a Kehinde Wiley portrait jointly owned by the Yale University Art
  Gallery (`2021.25.1`) and the Yale Center for British Art (`B2021.5`).
- **Equivalents:** `equivalent` links to the *same entity* in another dataset — Wikidata,
  ULAN, LOC. The URI MUST identify the entity, not a web page about it
  (`http://vocab.getty.edu/ulan/500011051`, never `.../page/ulan/...`;
  `http://www.wikidata.org/entity/Q…`, not `/wiki/`). This is where the spike's Wikidata
  join keys go.

## Statements

When data is a human-readable string rather than structure, it is a `LinguisticObject`
reached by `referred_to_by`, with `content`, optional `language`, and a classification:
*Description* (aat:300435416), *Materials Statement* (aat:300435429), *Credit Line*
(aat:300026687), *Production Statement* (aat:300435436), *Provenance Statement*
(aat:300435438), *Inscription Statement* (aat:300435414), *Signature Statement*
(aat:300028705). The meta-type for all statement types is aat:300418049.

A label's text, read by OCR, is naturally a set of statements: the materials line is a
Materials Statement, the credit line a Credit Line, the interpretive paragraph a
Description.

## Events and activities as connectors

Linked Art connects entities through an intermediate activity rather than a direct link:
the object is `produced_by` a `Production` that is `carried_out_by` the artist, has a
`timespan`, `took_place_at` a place, may happen `during` a period, may be `caused_by`
another event, and has a `technique`. Beginnings and endings by class:

| Class | Beginning | Ending |
|---|---|---|
| `HumanMadeObject` | `Production` | `Destruction` |
| `DigitalObject` | `Creation` | `Erasure` |
| works, `Type`, `Set` | `Creation` | none |
| `Person` | `Birth` | `Death` |
| `Group` | `Formation` | `Dissolution` |

## Parts and membership

- `part_of` points from a part to its whole: a frame to its painting, a battle to its war,
  a neighbourhood to its city. Wholes don't list their parts; the API finds them. An
  accession suffix naming physical pieces (`48.108.14A-B`, the two halves of a mold) is
  this pattern: D24 keeps the accession whole and parsed into base and suffix.
- Inside one record, an activity is split with `part` (e.g. one `Production` with a part
  per artist and role), because there is no separate record to point `part_of` at.
- `member_of` is for sets and groups, which can exist with no members.
- `Set` is a conceptual grouping, created by a `Creation`, never destroyed. Members point
  to the set with `member_of`; the set doesn't list members.

## Required terms worth knowing by heart

*Primary Name* 300404670 · *Display Name* 300404669 · *Type of Work* 300435443 · *Style*
300015646 · *Nationality* 300379842 · *Occupation* 300263369 · *Exhibition* 300054766 ·
*Provenance Activity* 300055863 · *Professional Activity* 300393177 · *Collection Item*
300404024 · *Artwork* 300133025. All AAT, written in data as full URIs
(`http://vocab.getty.edu/aat/300404670`). "If a term is listed here then you MUST NOT use
a different term for the same concept."

## Design principles that explain the shape

From the profile page: scope by real use cases with real data; as simple as possible and
no simpler; avoid extensions, including CRM's own, "without an exceptional reason";
"expansions" — the simple pattern carries the current belief, and complexity (former
attributions, sources) is layered on without changing it; JSON-LD first, so JSON keys
often differ from ontology names; features of CRM that conflict with linked-data practice
are avoided, "such as .1 properties on properties".
