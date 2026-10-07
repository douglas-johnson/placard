# People, places, events, exhibitions, location

Checked 2026-10-07 at commit `bcbff17`.
Sources:
[actors](https://github.com/linked-art/linked.art/blob/bcbff1761e65f44eeaeb92b4b2b83da2783539f8/docs/model/actor/index.md) ·
[places](https://github.com/linked-art/linked.art/blob/bcbff1761e65f44eeaeb92b4b2b83da2783539f8/docs/model/place/index.md) ·
[exhibitions](https://github.com/linked-art/linked.art/blob/bcbff1761e65f44eeaeb92b4b2b83da2783539f8/docs/model/exhibition/index.md) ·
[ownership and location](https://github.com/linked-art/linked.art/blob/bcbff1761e65f44eeaeb92b4b2b83da2783539f8/docs/model/object/ownership/index.md) ·
[movement](https://github.com/linked-art/linked.art/blob/bcbff1761e65f44eeaeb92b4b2b83da2783539f8/docs/model/provenance/movement.md) ·
[events](https://github.com/linked-art/linked.art/blob/bcbff1761e65f44eeaeb92b4b2b83da2783539f8/docs/model/event/index.md)

## People and groups

- `Person` for a human; `Group` for any collective. **If unsure which, use `Group`.** A
  group needn't act coherently or know its members ("18th-century French artists" is
  fine). Only humans act; software and animals are not actors.
- **Life events:** `born` / `died` → `Birth` / `Death` (events, not carried out by
  anyone); groups are `formed_by` / `dissolved_by`.
- **Active dates:** `carried_out` → an `Activity` classified *Professional Activity*
  (aat:300393177), with a time-span and place. Useful for ruling out dubious attributions.
- **Nationality, ethnicity, gender, occupation:** all `classified_as` on the person, with
  meta-types *Nationality* (aat:300379842), gender (aat:300055147), *Occupation*
  (aat:300263369). Nationality is deliberately a Type, not a Group, because everyone of a
  nationality cannot act together. Unsure whether nationality or ethnicity: omit the
  meta-type.
- **Membership:** `member_of` → `Group` (a guild, the Memphis Group).
- **Equivalents:** `equivalent` to ULAN or Wikidata. If the external record has
  everything needed, its URI can be the person's URI directly.
- **Teacher/student and other social links are not modelled** — see `assertions.md`.

## Places

- `Place` is an extent in space, independent of time and of what's there. Hierarchy by
  `part_of` (a gallery in a building in a city), preferably delegated to a gazetteer
  (TGN, Wikidata).
- Geometry: `defined_by` a WKT string, latitude/longitude assumed. A bounding box or a
  point is fine. (The Met's footprint note in `data/venues/met.json` is the case for a
  polygon.)
- An uncertain location: a specific named `Place` that is `part_of` the broad area known.
- **A building is an object, not a place.** It has a `current_location`; activities
  happen at the place, not in the building. A gallery is a place, classified *Gallery*
  (aat:300240057).

## Events and causes

See `time.md`: `Period`, `Event`, `Activity`; `during` vs `part_of`; `caused_by`;
`before`/`after`. Historical events that works depict or are about (the eruption of
Vesuvius, the Boston Tea Party) "must have [their] own record", so objects, works and
events can all refer to the same entity.

## Exhibitions

Two entities:

1. **The exhibiting activity:** an `Activity` classified *Exhibition* (aat:300054766),
   with `timespan`, `took_place_at`, `carried_out_by` the organizer, and
   `used_specific_object` → a `Set` of the objects shown. A travelling exhibition is one
   activity per venue, each `part_of` a larger one.
2. **The idea:** a `PropositionalObject` classified aat:300417531, which the activity is
   `influenced_by`. **Subjects go here**: the idea is `about` Beauty, `about` Manet.
   Activities aren't `about` anything.

Objects are `member_of` the exhibition's Set. Exhibition-specific titles and numbers are
context-specific assertions (`assertions.md`).

**For Placard (untested):** an exhibition's idea could be a subject source for every
object shown in it — MCNY's *New York and the American Revolution* is about the
Revolution, which a path could use even when an object's own record carries no subject.
Part of the continuing label-interpretation research, not yet evidence.

## Current location, and moves

- `current_location` → a `Place` (a gallery, or just the institution). Also
  `current_permanent_location` for where it normally hangs, and the matching
  `current_owner` / `current_custodian` / `current_permanent_custodian`.
- **History of location:** a `Move` activity (`moved`, `moved_from`, `moved_to`, with a
  time-span), usually as part of a provenance entry. Linked Art names "putting an object
  on display, or taking it off display" as a use case; current location is "determined by
  the most recent time that it was moved".

**For Placard (§8.2):** "on view in gallery 151" is a display-state claim. Linked Art
gives it a home (`current_location`, `Move`); what Placard adds is that an observation of
display goes stale — works on paper rotate (the #42 spike, on PR #43, found every
engraving the 2023 Met data put in a gallery was off view in 2026) — which is claim
metadata, not vocabulary.
