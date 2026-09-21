# data/

Everything the A0 corpus work produces or consumes. See `docs/capture-protocol.md`
for how the raw material is collected, and PLANNING.md §11 A0 for why it leads.

```
data/
├── labels/
│   ├── raw/         Photographs, straight off the phone. GITIGNORED.
│   ├── fixtures/    Verified extractions. COMMITTED. The actual asset.
│   └── derived/     OCR output, intermediate JSON. GITIGNORED, regenerable.
└── venues/          Venue registry — one JSON per institution. COMMITTED.
```

## labels/raw/ — immutable

One directory per trip: `raw/<YYYY-MM-DD>-<venue-slug>/`. Photographs go in exactly
as they came off the phone. **Never edit, crop, rotate, or rename them.** The pipeline
has to handle the real case, and a corpus of tidied-up images would make every
evaluation optimistic.

Gitignored — a few hundred HEICs is several gigabytes, and binary blobs in git are
a mistake that's painful to undo. Back them up outside the repo.

## labels/fixtures/ — the asset

One JSON per photographed label: the file it came from, and the **verified correct**
extraction. Verified means checked against the institution's own catalog record via
the accession number (§4.3) where an API exists, and carefully by hand where it doesn't.

This is the artifact that "can't be bought or scraped" (§11 A0). It's what lets §4 be
*evaluated* rather than eyeballed, so it is the one directory in the repo where being
slow and correct beats being fast.

A fixture records what's true, and also what was hard about it:

```json
{
  "source_image": "raw/2026-09-16-moma/IMG_4412.HEIC",
  "venue": "moma",
  "verified_against": "catalog_api",
  "difficulty": ["reflective_glass", "low_light"],
  "expected": {
    "accession_number": "1925.708",
    "artist": "Artemisia Gentileschi",
    "artist_nationality": "Italian",
    "artist_dates": "1593/1656",
    "title": "Judith Slaying Holofernes",
    "date_edtf": "1620~",
    "medium": "oil on canvas",
    "credit_line": "Gift of Mr. and Mrs. R. H. McCormick",
    "attribution_qualifier": null
  }
}
```

Note `date_edtf`: dates are stored as EDTF (§4.5), so "about 1620" is `1620~` and the
approximation survives. Storing `1620` as an integer silently loses the *about*, which
then propagates into a curriculum that speaks with more confidence than the evidence
supports.

`difficulty` tags are what make the fixture set useful for regression rather than just
accuracy — they let you ask "did the reflective-glass cases get worse" instead of only
"did the average get better."

`source_image` is the frame the transcription came from — the label, or for a
distributed label system (D18) the tombstone. A fixture usually rests on more than one
frame, so `frames` names each one by its role:

```json
"frames": {
  "work": "raw/2026-09-16-mcny/IMG_1295.HEIC",
  "label": "raw/2026-09-16-mcny/IMG_1296.HEIC",
  "accession_crop": "raw/2026-09-16-mcny/IMG_1297.HEIC"
}
```

Roles are free text but reuse the ones already in the set (`work`, `label`,
`accession_crop`, `tombstone`, `numbered_panel_key`, `artist_biography_panel`,
`exhibition_wall_text`, `case_panel`). The `work` frame matters for D15's pairing tests
and as a negative case — OCR of a work frame is never label data, and two fixtures show
the two ways it goes wrong (fabricated text from a window grid; real signage that is
correct and still irrelevant).

Three blocks arrived with the first app-collected take (the Met, 2026-09-20) and are
now part of the format:

- **`capture`** — what the F0 build recorded on the spot: the build, the manifest
  group, `on_device_candidates` (what the locator offered), `accession_status`
  (`confirmed` / `corrected` / `none` / `unread`), `machine_reading`, `human_value`,
  the flags and hard-case tags the tester set, and their note. This is the
  evaluation set for `apps/learner/src/accession.ts` — `npm run locator-eval` there
  reads it — and it is the only record of what the human saw the machine get wrong.
- **`shared_panel`**, with `label_kind: "shared_panel"` — one card governing several
  objects. `count`, then `objects[]`, each with its accession, what the card says
  about it, and its own `catalog` record. The fixture's top-level `expected` is the
  object the tester confirmed; the panel is the unit, and any of its accessions first
  is a correct locate.
- **`catalog`** and **`label_vs_catalog`** — for `verified_against: catalog_api`, a
  snapshot of the institution's record (object ID, URL, title, date, medium, credit
  line, gallery, the date it was checked) and a diff against the label: `agree` lists
  the fields that match, `differ` explains each that doesn't. Two claims from one
  institution about one object, kept side by side (§4.7).

`frame_metadata` says what the files actually carry. `gps: false` is the honest state of
the first visit — the camera had no location permission — and a fixture without GPS
establishes its venue from the bookend frames and shot order instead, which is what the
bookends are for.

### Minors

A fixture never carries the name of a child, or the name of a child's teacher or school,
whatever the label said. This applies to the `expected` block, the `traps`, the notes —
all of it. The first case was a P.S. Art label at the Met on 2026-09-20 (group g0014):
the label frame was deleted from `raw/`, its OCR lines were stripped from the manifest
(the record stays, marked `redacted`, so replay and sequence numbers are intact), and
`derived/` was regenerated. The fixture for that group records the work and the
exhibition wall text, and `expected.artist` is `null` with a note saying why. This is
the one edit that is ever made to a raw take, and the capture protocol says not to shoot
the label in the first place.

## labels/derived/ — regenerable

OCR output and intermediate parses. Gitignored on purpose: anything here must be
reproducible from `raw/` by running the pipeline. If something in `derived/` can't be
regenerated, it belongs in `fixtures/`.

```sh
./tools/ocr/build.sh
./tools/ocr/bin/placard-ocr data/labels/raw/2026-09-16-moma \
  > data/labels/derived/2026-09-16-moma.ndjson
```

## venues/ — the registry

One JSON per institution. This is the GPS→candidate-set prior from §4.1b and the
accession-format hint from §4.3, and it eventually carries the structured access rules
from §9.6. Hand-authored; it's small and it's reference data, so it's committed.
