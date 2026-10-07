# Time

Checked 2026-10-07 at commit `bcbff17`.
Sources:
[base: time-span details](https://github.com/linked-art/linked.art/blob/bcbff1761e65f44eeaeb92b4b2b83da2783539f8/docs/model/base/index.md) ·
[API: TimeSpan](https://github.com/linked-art/linked.art/blob/bcbff1761e65f44eeaeb92b4b2b83da2783539f8/docs/api/1.0/shared/timespan/index.md) ·
[JSON schema, core](https://github.com/linked-art/linked.art/blob/bcbff1761e65f44eeaeb92b4b2b83da2783539f8/docs/api/1.0/schema/core.json) ·
[events and periods](https://github.com/linked-art/linked.art/blob/bcbff1761e65f44eeaeb92b4b2b83da2783539f8/docs/model/event/index.md) ·
[issue #218, "EDTF dates"](https://github.com/linked-art/linked.art/issues/218)

## TimeSpan

Every event or activity can have a `timespan`:

| Property | Meaning | CRM |
|---|---|---|
| `begin_of_the_begin` | earliest possible start | P82a |
| `end_of_the_begin` | latest possible start | P81a |
| `begin_of_the_end` | earliest possible end | P81b |
| `end_of_the_end` | latest possible end | P82b |
| `duration` | a `Dimension`: how long it took, within the span | |
| `identified_by` | a `Name` (often *Display Name*) giving the human-readable date: "ca. 1774" | |

A time-span MUST have at least one of `identified_by`, `begin_of_the_begin`,
`end_of_the_end`. Values are full `xsd:dateTime` (year through seconds; assume `Z`). The
end bound is *included*: the last moment of the 1400s is `1499-12-31T23:59:59Z`, not
`1500-01-01T00:00:00Z`. Linked Art's example for "about 1750" uses all four bounds
(start 1720–1751, end 1749–1780) plus a Name, which is how an approximation is
expressed — by widening bounds, not by a flag.

## BCE dates: the gap

- CRM specifies `xsd:dateTime`, which allows negative years. Linked Art's stated intent
  is to follow CRM (issue #218: "There would need to be a very convincing reason to start
  to contradict the spec").
- **The API 1.0 JSON schema** declares each bound `"format": "date-time"`, which is RFC
  3339: four-digit years 0000–9999, no sign. A validator that enforces `format` rejects
  every BCE bound.
- **Year zero differs.** XSD 1.0 has no year 0 (`-0001` is 1 BCE); XSD 1.1 and ISO 8601
  have year 0 = 1 BCE, which is EDTF's convention too. Collaborators in #218 report
  triplestores and JavaScript disagreeing with each other, and Fuseki rejecting year 0.
- The docs' only BCE example (the Early Roman Empire, 31 BCE–193 CE) gives no time-span
  at all.
- **EDTF:** "Defer until there's a standard with broader support both in RDF and in
  implementations." Closed.

**What this means for Placard (D5, D53).** The EDTF string is the authoritative date,
kept beside the bounds as a Placard extension. Bounds are *derived* from it in
projections, using EDTF's astronomical years (1 BCE = `0000`, 375 BCE = `-0374`), which
match XSD 1.1, and a Linked Art export must say so. The Met's API counts BCE without a
year zero (`-375` is 375 BCE). The curriculum spike's `met_edtf`
(`tools/curriculum-spike/spike.py`) converts it and is tested; whatever ingests Met dates
in B1 needs the same. EDTF's `~` (approximate) and `?` (uncertain) have no Linked Art
equivalent beyond wider bounds and a Name; the EDTF string is what keeps them.

## Periods, events, activities

| Class | Is | Example |
|---|---|---|
| `Period` | a span of time, often arbitrarily bounded | the 19th century, the Bronze Age, the Met's "Geometric" |
| `Event` | something that happens, not intentionally carried out | the eruption of Vesuvius |
| `Activity` | something people did | the Boston Tea Party, an exhibition |

- **`during` vs `part_of`:** `part_of` is strict partition (Early, Middle and Late Bronze
  Age are parts of the Bronze Age). `during` is inclusion without partition: an object's
  `Production` happened `during` the Bronze Age. A Met "period" on an object becomes the
  object's Production `during` a `Period` record. Mixing them up "will become very
  confusing" in search and display.
- **`caused_by`:** an event or activity caused by a preceding one — the destruction of
  Pompeii `caused_by` the eruption. This is the shape of Wikidata's "has effect" chain
  from the #42 spike: the Tea Act → the Boston Tea Party → the American Revolution.
- **`before` / `after`:** relative order when dates are unknown (a statue in Pompeii was
  produced `before` the eruption).
