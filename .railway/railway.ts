/**
 * Railway infrastructure for Placard, applied with `railway config plan` and
 * `railway config apply` (D34). This file is the source of truth for everything
 * Railway runs; it is deliberately not the source of truth for the corpus.
 *
 * Raw frames and manifest records do NOT live here. They live in Backblaze B2, for
 * the prefix- and capability-scoped keys and the soft-delete semantics D35 depends on.
 * What Railway holds is compute, regenerable derived data, and eventually B1's Postgres.
 *
 * The intended full shape — the `ingest` service and its sealed B2 variables — is in
 * docs/infrastructure.md §6. Only the bucket is declared so far, because
 * services/ingest/ does not exist yet and a service with no source would fail to build.
 */
import { bucket, defineRailway, project } from "railway/iac";

export default defineRailway(() => {
  // OCR output and intermediate parses — regenerable by definition (data/README.md),
  // so a single full-access credential is fine. Nothing in here is evidence.
  // iad is US East, nearest B2's us-east-005. Region is fixed at creation.
  const derived = bucket("derived", { region: "iad" });

  return project("placard", {
    resources: [derived],
  });
});
