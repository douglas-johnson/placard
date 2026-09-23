# Infrastructure — where the corpus, the fixtures, and the services live

**Status:** on branch `system-design`. First written 2026-09-20; revised 2026-09-22
after the Met take and the D4 amendment, and again once the design was checked against
live B2 and Railway accounts. The architectural calls proposed here are now settled as
**D34–D38**; this document holds the working detail behind them — the verification
results, the key layout, the bucket's contents, the Railway file. The reasoning and the
rejected alternatives live in those entries, and this document points at them rather
than restating them. Where it still proposes rather than records, it says so.
`placard-raw` exists; nothing else is provisioned yet.

**What it supersedes.** `docs/field-beta.md` §4 proposed Vercel for the ingest
function and Cloudflare R2 for the bucket, and asserted "bucket versioning on" as the
enforcement of raw immutability. That section was written without checking the
providers: R2 does not offer bucket versioning, so the promise could not have been
kept as written. This document replaces §4's hosting proposal and restates where
immutability is enforced. The rest of §4 — the tiny ingest service, presigned uploads,
the key layout mirroring `data/labels/raw/` — stands. Its treatment of the manifest does
not: D38 uploads it as per-record objects rather than a file, and §5.2 is what replaces
it.

---

## 1. Three data classes, and one obligation that cuts across them

The conversation that produced this document kept running three things together, and
the infrastructure only makes sense once they are apart. They are the same three tiers
`data/README.md` already names, with the guarantee each one needs made explicit.

**The corpus — raw frames and manifests — is evidence, and evidence is immutable.**
Never edited, cropped, renamed, or deleted (D4). It grows with every tester visit and,
later, with every opted-in learner. Its guarantee is that nothing any client can do
destroys a frame, and the guarantee has to hold against code that has not been written
yet.

**Derived data — OCR output, intermediate parses — is regenerable.** It needs no
guarantee beyond being cheap to store and cheap to throw away. Note that it is *not*
free of obligation: derived data contains OCR text, so anything redacted from raw must
be purged from derived too (§4).

**Fixtures are a test suite, not a record of the world.** A fixture is a curated subset
of the corpus with the verified-correct extraction attached — the answer key against
which §4 of the plan is measured, tagged by difficulty so the question can be "did the
reflective-glass cases regress" rather than "did the average move." A0 sizes the set at
300–500 labels across 15+ institutions (PLANNING.md §11). It does not grow with usage.
Early it grows with *coverage* — a new venue, a new accession format, a non-Latin
script, an attribution qualifier not yet seen — and in steady state with *discovered
difficulty*: the pipeline misreads a label in production, that label becomes a fixture,
and it cannot silently regress again. When forty learners photograph the same label and
the extractor reads it the same way forty times, that is corroboration on a claim in the
canon (§4.7), not forty fixtures and not one. The guarantees a fixture needs are a
review gate — a human vouches for it, slowly — and supersession: a corrected fixture
keeps its old version queryable (§8.3). Git provides both natively, and the repository
is already off the Mac.

The canon (B1) is a fourth class, claims about every label anyone photographed, out of
scope here except to note that the same provider can host its Postgres.

**And cutting across all of it: redaction.** The D4 amendment (2026-09-20, the Met)
settles that a frame identifying a minor is deleted from `raw/` the day it is found,
its OCR stripped from the manifest, and `derived/` regenerated. This is the one edit
ever made to a raw take. It is not a hypothetical — it has happened once, in the first
app-collected take, before any of this infrastructure exists. Every mechanism below has
to survive it, and the first draft of this document did not: it proposed that no
delete-capable credential exist at all, and said that if one were ever needed, "that is
a decision to record, not a key to mint." The decision has since been recorded, and
D35, D36 and D38 are the revision.

---

## 2. The proposal

| Tier | Guarantee | Store | Who writes | Credential |
|---|---|---|---|---|
| raw | immutable except under redaction | **Backblaze B2**, versioning on | `ingest`, via presigned PUT | `writeFiles`, no `deleteFiles` |
| derived | regenerable | Railway bucket | workers | Railway's own, full access |
| fixtures | reviewed, superseded | git, on GitHub | a drafter opens PRs; Doug merges | repo-scoped token, cannot merge |
| canon (later) | claims | Railway Postgres | B1 | the split in `db/README.md` |

**Railway for compute, derived data, and eventually Postgres.** One project, `placard`;
one environment to start, named `testflight` to match the `expo-updates` channel from
D33 so the mapping is one word; `production` when there is a public app. Services are
declared in a single `.railway/railway.ts` and applied with `railway config plan` and
`railway config apply` — a plan/apply loop with stale-plan protection and a GitHub
Action that plans on pull requests and applies on merge. TypeScript because that variant
is GA and the Python one is beta; the file is configuration, not application code, so
this does not contradict §10's choice of Python for the API. Railway's older
`railway.json` config-as-code is deprecated and dies 2026-12-01, so we start on the
right side of that line. Railway also exposes a hosted MCP server (`mcp.railway.com`)
and a `use-railway` skill installed by `railway setup agent`, which would let Claude
plan, apply, and read logs from a session once authorized.

**B2 for raw**, and the reason is now sharper than it was in the first draft. See §3.

**Git for fixtures.** F2's fixture drafter runs as a Railway worker, reads the manifest
and label frame from B2 with a read-only key, runs OCR and the accession locator, checks
the venue's catalog API where one exists, and opens a pull request against
`data/labels/fixtures/`. Merge is verification. Its GitHub credential is a fine-grained
token or App installation limited to this repository with `contents` and
`pull_requests` write, and branch protection on `main` requires review so the token
cannot merge its own work. This is the claim lifecycle of §4.8 without building B1: the
draft is an inferred claim; the merged fixture is verified with a citation. The Met take
already proves the drafter has enough to work from — all fourteen accessions resolved to
exactly one Met object when quoted to the API, and `capture` blocks in the new fixtures
carry what the locator offered and what the human settled on. The commentary in a
fixture (`traps`, `work_photo_note`, cross-references to decisions) documents why a case
is hard and stays in git even after B1.

---

## 3. What B2 enforces, and the keys

The reasoning lives in **D34** (why a second vendor) and **D35** (the invariant, the
credential rule, versioning, Object Lock, and why two buckets do not help). This section
is the working detail behind them: what the store can actually express, checked against
Backblaze's documentation and then against the live account (§8), and the keys that
implement it.

For orientation, D35 reduces to one checkable sentence:

> In `raw/`, the only operation that ever replaces or removes an existing key is a
> redaction. Every other write creates a key that did not exist.

### 3.1 What the store can express

- **Capabilities are separate and per-key.** `writeFiles`, `readFiles`, `listFiles` and
  `deleteFiles` are distinct. A key can be restricted to one bucket and one filename
  prefix, given a duration of up to 1000 days, and created and revoked through the API
  (`b2_create_key`, `b2_delete_key`). This is what D35's credential rule rests on.
- **Versioning is inherent, not a toggle.** Uploading a name that exists creates a new
  version; the old one remains, reachable by file ID. Lifecycle rules control retention —
  "keep only the last version" hides for a day and then deletes — and rules run once per
  day, so a one-day rule can take up to 48 hours to act. `placard-raw` therefore carries
  no lifecycle rule at all, and lifecycle is never a substitute for a redaction.
- **`writeFiles` alone permits creating a newer version of an existing name.** There is
  no capability meaning "create but never replace," which is why the create-only half of
  the invariant is not store-enforced.
- **A plain delete is soft; only delete-by-version-ID destroys.**
  `b2_delete_file_version` permanently removes that version and its data, and no single
  call removes every version of a name — enumeration is required, which is why D36 is a
  tool rather than a command.
- **No conditional writes.** `PutObject` with `If-None-Match: *` returns
  `NotImplemented`; the same header on a presigned URL returns HTTP 501.

### 3.2 Keys

| Holder | Capabilities | Prefix | Lifetime |
|---|---|---|---|
| `ingest` | `listFiles`, `readFiles`, `writeFiles` | `raw/` | standing |
| workers (OCR, drafter) | `listFiles`, `readFiles` | `raw/` | standing |
| Doug's Mac | `listFiles`, `readFiles` | `raw/` | standing |
| redaction | the above plus `deleteFiles` | one take | minted per redaction, ≤1 hour, revoked |

`ingest` needs `readFiles` because it HEADs a key before signing a PUT for it. Read is
not the hazard. Replacement is, and it is covered by versioning rather than by
capabilities, because B2 cannot express it.

---

## 4. Redaction, in practice

D4 settles that it happens and what it covers; D36 settles that it is a tool and what
the tool does; D38 removed its hardest step. What follows is only what those entries do
not carry.

**The loop was exercised before it was written as a tool.** On 2026-09-22, against a
throwaway bucket: four versions across two keys enumerated, deleted by ID, then
re-listed to confirm nothing survived. What remains to build is the part that makes it
hard to get wrong — the verification, the audit line, and the key that revokes itself.

**A client-side trap the tool will hit even though `ingest` may not.** Botocore adds
`Expect: 100-continue` to S3 `PutObject`; B2 answers with an interim response and an
empty HTTP reason phrase, and Python's `http.client` then reads the following header as
a status line and raises `BadStatusLine`. curl is unaffected. Any boto3 client that
uploads a body to B2 — the redaction tool, a worker writing derived data — must
unregister botocore's `add_expect_header` or strip the header in a `before-send` hook.
`ingest` itself generates presigned URLs and calls `head_object`, neither of which sends
it.

**The audit record's shape.** `data/labels/redactions.ndjson`, committed, one line per
redaction, carrying nothing identifying:

```json
{"v":1,"ts":"2026-09-20T21:14:00Z","take":"2026-09-20-met","group":"g0014",
 "frames":["f0035"],"reason":"minor","removed":["frame","ocr_lines"],
 "kept":["work","exhibition_wall_text"],"fixture":"met-ps-art-2026-redacted"}
```

The Met case is the first line. It is already documented across `DECISIONS.md`,
`data/README.md`, and the fixture's `source_note`; this is the same information in a
form a tool can check — every record marked `redacted` should have a matching line here,
and every line a matching record.

---

## 5. What the bucket holds

### 5.1 Layout

```
raw/<contributor>/<take-id>/f0007-label.jpg
raw/<contributor>/<take-id>/records/000015-ocr.json
```

The contributor sits above the take so that two phones cannot collide, and so that a
redaction key can be restricted to a single take's prefix (§3.2).

### 5.2 The manifest, as records (D38)

The manifest does not arrive as a file. Each record from the on-device NDJSON becomes
its own immutable object under `records/`, named by sequence number and type. Nothing in
`raw/` is ever rewritten, and a redaction destroys the `ocr` record's key with the same
call it uses for the frame.

The on-device format is untouched — F0's append-only NDJSON is still the app's only
state and its resume mechanism. This concerns the uploaded form only, so there is no F0
rework and no native rebuild.

Three consequences worth having in one place:

- **The commit marker is the `take_ended` record**, carrying the take's final `seq` and
  its frame counts. It is a claim about what should exist, not an assertion that all of
  it has arrived; completeness is the service's determination when observed matches
  claimed.
- **The convenient form is derived.** `corpus-pull` lists the records, sorts by `seq`,
  and writes `manifest.ndjson` into `derived/` for the Mac-side tools, which expect a
  file beside the frames. It is regenerable, so it may be freely rewritten — including
  after a redaction, which regenerates that take's `derived/` anyway.
- **Transport splits by size.** Frames go straight to B2 by presigned PUT. Records are a
  few hundred bytes, so the app POSTs them to the API and `ingest` writes them, which
  also lets the object write and the Postgres row insert happen together. The app still
  never holds a bucket credential.

Postgres is an index over these records, not the truth. A database loss is repaired by
re-ingesting from the bucket rather than by restoring a backup, and the
`UNIQUE (contributor, take, frame)` constraint is what gives `ingest` create-only key
allocation — the closest available substitute for the conditional write B2 lacks (§3.1).

### 5.3 Frame references in fixtures

Fixtures currently bind to raw by path — `raw/2026-09-16-mcny/IMG_E1308.HEIC`, and after
the Met, Image Capture's names. Once raw is a bucket the reference is a key, and it
carries a content hash (D37):

```json
"frames": {
  "label": { "key": "doug/2026-09-20-met/f0007-label.jpg", "sha256": "…" }
}
```

This covers all 23 fixtures and should be done while the frames are still on the Mac.
`tools/manifest/bind-frames.py` already computes the manifest-to-camera-roll binding;
the hash pass belongs next to it.

---

## 6. Sketch of the Railway file

```ts
// .railway/railway.ts
import { defineRailway, project, service, bucket, github, preserve } from "railway/iac";

export default defineRailway((ctx) => {
  const derived = bucket("derived", { region: "iad" }); // US East; fixed at creation

  const ingest = service("ingest", {
    source: github("douglas-johnson/placard", { branch: "main", rootDirectory: "services/ingest" }),
    start: "uvicorn app:app --host 0.0.0.0 --port $PORT",
    healthcheck: "/healthz",
    env: {
      // B2, sealed. listFiles + readFiles + writeFiles on raw/. Never deleteFiles.
      B2_ENDPOINT: preserve(),
      B2_KEY_ID: preserve(),
      B2_KEY: preserve(),
      B2_BUCKET: preserve(),
      // Rotated with every TestFlight build (field-beta §4).
      UPLOAD_TOKEN: preserve(),
    },
  });

  return project("placard", { resources: [derived, ingest] });
});
```

Whether Railway's own bucket credentials are referenced as `derived.env.*` or wired
through shared variables was the one thing the IaC reference did not settle; confirm
against what `railway config init` generates.

**Cost.** Hobby, $5/month with $5 of usage included. `ingest` idle is roughly 0.1 vCPU
and 256 MB, about $4.50 at list and less with app sleeping; Railway's bucket is
$0.015/GB-month. B2 is $6/TB-month, so cents at this scale, and B2 egress is free up to
three times stored volume. Everything fits inside the Hobby credit for the foreseeable
future.

---

## 7. Decisions — settled 2026-09-22

Recorded in `DECISIONS.md` as **D34** (the three stores and the IaC path, items 1, 5 and
6 below), **D35** (the invariant, the credential rule, versioning and Object Lock, items
2 and 3), **D36** (redaction as a tool, item 4), **D37** (fixtures and frame references,
item 7) and **D38** (the manifest as per-record objects, item 8). The list stays here as
the index; the reasoning lives in those entries.

1. **Railway for compute, derived data and Postgres; B2 for raw.** Replaces
   `field-beta.md` §4's Vercel + R2. Consolidation and free egress for Railway;
   versioning and scoped keys for B2. No single provider examined offers both.
2. **The invariant and the credential rule** (§3). In `raw/`, only a redaction ever
   replaces or removes a key; no deployed service holds a credential that can delete.
   Versioning stays at full retention, because it is what makes a plain delete soft.
3. **Object Lock is ruled out permanently**, and the cost is accepted and recorded
   rather than mitigated by a replica for now.
4. **Redaction is `tools/redact/`**, minting and revoking its own key, verifying that no
   version survives, with an audit line in `data/labels/redactions.ndjson`. This is an
   implementation of the D4 amendment, not a change to it.
5. **Infrastructure declared in `.railway/railway.ts`**, TypeScript, applied by
   plan/apply through the GitHub Action. B2 keys and the upload token enter Railway as
   sealed variables, `preserve()`d in the file.
6. **Environment `testflight`**, matching the OTA channel; `production` later.
7. **Fixtures stay in git.** Off-Mac drafting writes pull requests and never commits to
   `main`; frame references become `{key, sha256}` across all 23 fixtures.
8. **The manifest uploads as per-record objects**, not as a file, so nothing in `raw/`
   is ever rewritten and redaction is one uniform operation.

---

## 8. Verified against the real accounts, 2026-09-22

The account is `us-east-005`; the S3 endpoint is
`https://s3.us-east-005.backblazeb2.com`. Bucket `placard-raw` is `allPrivate`, with
`fileLockEnabled` off and `lifecycleRules: []`, so every version is retained (D35). Three standing keys exist, each restricted to that bucket and the `raw/`
prefix, none holding `deleteFiles`. Protocol checks ran against a throwaway
`placard-scratch` bucket, never against `placard-raw`.

| Check | Result | Consequence |
|---|---|---|
| Read with the read-only key | works | — |
| Write with the read-only key | refused, `unauthorized` | §3.2's key table is enforced, not just configured |
| Plain PUT over the S3 endpoint | works | transport is fine |
| `PutObject` with `If-None-Match: *` | **`NotImplemented`** | no store-enforced create-only; D35 revised |
| Same header on a presigned URL | **HTTP 501** | confirms it, on the path `ingest` would use |
| Unconditional PUT over an existing key | accepted | `writeFiles` alone can shadow a key |
| Prior version after an overwrite | retained, 2 versions | versioning is the backstop, as §3.2 argued |
| Presigned PUT with a write-scoped key | HTTP 200 | the upload path works |
| Delete all versions, then re-list | 4 deleted, 0 left | §4's redaction loop is sound |

Two findings changed the document: conditional writes do not exist on B2, which is
written into §3.1 and D35; and botocore's `Expect: 100-continue` breaks against B2
under Python's `http.client`, which is written into §4.

Still open, on the Railway side:

- **A Railway sealed variable referenced via `preserve()`** survives `railway config
  plan` in CI without appearing in plan output or a PR comment.
- **How the IaC file exposes a Railway bucket's credentials to a service.**

Housekeeping: delete the `placard-scratch` bucket and its key when the Railway checks
are done, and rotate any key that has been pasted anywhere but a terminal prompt.

---

## 9. Next steps, in order

1. ~~Confirm §7 and write the decisions~~ — done 2026-09-22, D34–D38.
2. ~~Run the §8 checks~~ — done 2026-09-22; the B2 answers are folded in, the two
   Railway ones remain. One late addition: confirm a plain `DeleteObject` leaves a
   marker rather than destroying, which D35 now rests on and which was not tested.
3. Rewrite `field-beta.md` §4 to point here, including that the manifest arrives as
   per-record objects and that `take_ended` is the commit marker.
4. ~~Create the B2 bucket and the three standing keys~~ — done 2026-09-22;
   `railway setup agent` and `railway config init` likewise. The `placard-scratch`
   bucket and its key still need deleting.
5. Build `tools/redact/` **before** the first upload, and re-run the Met redaction
   through it as its test case — the frame is already gone locally, so the test is that
   the tool correctly reports nothing to do and writes the audit line.
6. Rebind all 23 fixtures to `{key, sha256}`; push the MCNY and Met takes to B2 as the
   first prefixes.
7. `services/ingest/` per `services/README.md`, then F1's upload queue.

One housekeeping note: the Vercel plugin hooks in Claude Code sessions will keep
steering toward Vercel now that the proposal has moved off it. Remove the plugin from
this project's settings when the decision is recorded.
