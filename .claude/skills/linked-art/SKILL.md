---
name: linked-art
description: How Linked Art (the CIDOC CRM profile Placard's claims use, D53) says things — objects and their visual content, depiction versus subject, production and attribution qualifiers, time-spans and BCE dates, assertions, people, places, events, exhibitions, location — and how Placard's facets map onto it. Use when designing the canon schema (B1), a claim type, an ingestion mapping from a museum's data, or a Linked Art projection; or when someone asks how Linked Art or CIDOC CRM models something.
---

# Linked Art

Linked Art is a profile of CIDOC CRM: a subset of its classes and properties, typed with
Getty AAT terms, serialized as JSON-LD, with an API pattern of one record per entity.
D53 makes it the vocabulary *inside* Placard's claims. The claim envelope (source,
retrieval time, confidence, verification, supersession) is Placard's own, and Linked Art
documents are one projection rebuilt from the claims. Decisions live in DECISIONS.md;
this skill says what Linked Art itself says, and cites it.

**Source of truth.** Everything here was checked against Linked Art's own documentation
at the commit in `upstream.txt` (model 1.0, API 1.0), published at https://linked.art/
under CC BY 4.0. Each reference file cites permalinks at that commit. Before relying on a
detail for a decision, open the permalink. To see what has changed upstream since the
pin, run `scripts/upstream-changes.sh`.

## Which reference to read

| Question | File |
|---|---|
| Classes, `type` vs `classified_as`, names, identifiers, `equivalent`, statements, parts, required AAT terms | `references/core-patterns.md` |
| The object vs its image, depicts vs about, style, materials, production, "attributed to" / "workshop of" / "after", copies and reproductions | `references/objects-and-works.md` |
| Time-spans, the four date bounds, BCE dates, EDTF, periods, `during` vs `part_of`, causes between events | `references/time.md` |
| Who said what: `AttributeAssignment`, uncertain and former attributions, sources, AI-generated content, relationships Linked Art doesn't model | `references/assertions.md` |
| People and groups, nationality, occupation, membership; places; events; exhibitions; current location and moves | `references/people-places-events.md` |
| How Placard's claims might map onto all of the above, and Placard's extensions — **provisional**: the curriculum spike (#42, PR #43) and its label-interpretation research are still open | `references/placard-mapping.md` |

## The five things most likely to go wrong

1. **The object is not the image.** A `HumanMadeObject` `shows` a `VisualItem`; depiction
   (`represents`) and subject (`about`) sit on the `VisualItem`, not the object. Style
   does too. Materials and object type sit on the object.
2. **Linked Art's `Encounter` is a discovery** — a find, as in archaeology — not a person
   seeing a work. A learner's encounter is private-layer data (constraint 1) and must not
   be mapped onto it.
3. **BCE dates don't validate.** The API 1.0 JSON schema types every date bound as
   `date-time` (RFC 3339: years 0000–9999, no sign). Linked Art declined EDTF (issue
   #218). Placard's EDTF string (D5) is the authoritative date; time-span bounds are
   derived from it, and the year-zero convention must be stated. See `references/time.md`.
4. **One relationship can't carry who asserted it.** Linked Art says so itself: individual
   links "cannot be reified" to add who asserted them, and `AttributeAssignment` for that
   is "possible but not encouraged". That is why D53 keeps the claim envelope outside
   Linked Art. Don't try to store Placard's provenance inside the vocabulary.
5. **No properties of properties.** CRM's ".1" properties (role in an activity, mode of
   depiction) are excluded by design. Roles become classified parts of an activity;
   "allegorically" has no standard home and is a Placard extension (D53).

## When this skill is not enough

Linked Art is designed to cover "90% of the use cases of 90% of the organizations". For
something it doesn't cover, the profile's rule is to avoid new classes and properties
unless there is an exceptional reason, and to reuse existing patterns. Placard's rule
(D53) is the same: extend only where Linked Art is silent, and record the extension in
DECISIONS.md. The extension mechanism page upstream (`api/1.0/json-ld/extensions.md`) is
a stub at the pinned commit.
