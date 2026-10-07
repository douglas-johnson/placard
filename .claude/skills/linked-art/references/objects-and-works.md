# Objects and the works they carry

Checked 2026-10-07 at commit `bcbff17`.
Sources:
[aboutness](https://github.com/linked-art/linked.art/blob/bcbff1761e65f44eeaeb92b4b2b83da2783539f8/docs/model/object/aboutness/index.md) ·
[production](https://github.com/linked-art/linked.art/blob/bcbff1761e65f44eeaeb92b4b2b83da2783539f8/docs/model/object/production/index.md) ·
[physical](https://github.com/linked-art/linked.art/blob/bcbff1761e65f44eeaeb92b4b2b83da2783539f8/docs/model/object/physical/index.md) ·
[rights and credit](https://github.com/linked-art/linked.art/blob/bcbff1761e65f44eeaeb92b4b2b83da2783539f8/docs/model/object/rights/index.md) ·
[encounters](https://github.com/linked-art/linked.art/blob/bcbff1761e65f44eeaeb92b4b2b83da2783539f8/docs/model/provenance/encounters.md) ·
[CDWA mapping](https://github.com/linked-art/linked.art/blob/bcbff1761e65f44eeaeb92b4b2b83da2783539f8/docs/cookbook/mappings/cdwa/index.md)

## The object and its image are two things

A `HumanMadeObject` is the physical thing. It `shows` a `VisualItem`: "the image or
visual impression that the object gives when looking at it, regardless of the materiality
of the object". Many objects can show one visual item — every print from a plate, every
photograph from a negative, the Mona Lisa on a t-shirt — and one object can show several
(a painting with a sketch on the reverse). Text content is a `LinguisticObject` the object
`carries`. A poster's text is `part_of` its visual item, because they can't be separated.

**Why Placard cares (D12, D20):** what hangs on the wall and the catalog object can be
different physical things showing related or identical images. A facsimile and the tomb
wall it copies are two objects; the facsimile's `Production` is `influenced_by` the
original (see *Copies* below).

## On the object

| What | How |
|---|---|
| Type of object (painting, print, vase) | `classified_as` an AAT term, itself classified as *Type of Work* |
| Materials | `made_of` → `Material` (AAT). The material, not the tool: graphite, not pencil |
| Materials as written | `referred_to_by` a *Materials Statement* (aat:300435429) |
| Culture (Met's "Greek, Attic") | `classified_as` — per Linked Art's CDWA mapping, "Object/Work Culture → classified_as" |
| Credit line | `referred_to_by` a *Credit Line* statement (aat:300026687) |
| Dimensions, shape, colour | `dimension`; shape and colour are classified dimensions/types |
| Parts | separate records, `part_of` the whole; can have their own materials and dimensions |

## On the visual item: depicts, about, style

| Relationship | Property (on `VisualItem`) | Means |
|---|---|---|
| **Depicts an identifiable thing** | `represents` → Person, Place, Object, Event… | *what is in the image*: the sitter, the battle, Washington |
| **Depicts an instance of a kind** | `represents_instance_of_type` → `Type` | a parasol, a beach, a horse — no identity of its own |
| **Subject** | `about` → `Type` (and, per the API relations, also people, places, objects, events, sets, works) | "what the artwork evokes… *why* the content is present": a portrait on a battlefield is about war |
| **Style** | `classified_as` a term classified as *Style* (aat:300015646) | how the content is presented: impressionist, geometric |
| **Other content classification** | `classified_as` | portrait, landscape, genre, "Allusion" |

Linked Art states that all styles are aesthetic, not cultural, which "simplifies the
model significantly at very little cost". **There is no "mode of depiction"**: CRM's
P138.1 ("represents Liberty, allegorically") is a property of a property, and the profile
excludes those. The nearest is classifying the content as an allusion. Placard's
allegorical depiction is an extension (D53).

**Activities aren't `about` anything.** An exhibition's subject sits on the
`PropositionalObject` that is the idea of the exhibition, not on the exhibiting activity
(see `people-places-events.md`).

## Production

`produced_by` → `Production`, with `carried_out_by`, `timespan`, `took_place_at`,
`during`, `technique` (a specific method, separate from `classified_as`), `caused_by` (a
commission), `influenced_by`, `used_specific_object`.

- **Several makers or roles:** one `Production` with a `part` per contributor, each
  `carried_out_by` that person and classified or given a `technique` for their role.
  Linked Art RECOMMENDS this shape even when only one artist is known, so others can be
  added without restructuring. This is how CRM's P14.1 "in the role of" is expressed.
- **Unknown maker:** `carried_out_by` a `Group` standing for unidentified artists (e.g.
  "Unidentified Italian"), not a fake Person per object.
- **Copies, studies, "inspired by":** `influenced_by` → the other object on the
  `Production`. The kind of influence isn't modelled.
- **Reproduction from a source** (print from a plate, photograph from a negative, cast):
  `used_specific_object` → the source; all the copies `show` the same `VisualItem`.

## Attribution qualifiers

| Label says | Linked Art |
|---|---|
| *after*, *in the style of*, *in the manner of* | `influenced_by` → the Person, on the `Production` |
| *workshop of*, *studio of*, *circle of*, *follower of*, *pupils of* | `carried_out_by` a `Group` (the docs' example is a Studio); the Group's `Formation` is `influenced_by` the master, who need not have been a member or alive. The recommended vocabulary has no terms for these group kinds (aat:300263827 is the *shape* "circle", not an artist's circle) |
| *attributed to*, *possibly by* | an `AttributeAssignment` on the `Production`, classified *Possibly By* (aat:300404272), assigning a `part` `Production` carried out by the artist (see `assertions.md`) |
| a former attribution | the same `AttributeAssignment` pattern, for the superseded opinion; `carried_out_by` on the main Production is the current one |

The fixture `mcny-38.447.4` ("Attributed to Henry Dawkins") is the third row.
Constraint: §4.6 says the qualifier must survive; these patterns are how it survives in
Linked Art terms.

## Encounter means discovery

`Encounter` is how an object enters documented history by being *found* — fossils,
archaeological finds, rediscoveries — recorded with `encountered_by` on the object (the
discovery) or as a provenance event. **It is not a person seeing a work in a gallery.** A
learner's encounter is private-layer data (constraint 1) and is never mapped onto it.

## Removal and destruction

A page cut from a manuscript is `removed_by` a `PartRemoval` that `diminished` the whole.
`destroyed_by` → `Destruction`, which is `caused_by` an event (a fire, a crash), never
`carried_out_by` someone.
