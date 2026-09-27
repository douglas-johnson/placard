/**
 * Railway infrastructure for Placard, applied with `railway config plan` and
 * `railway config apply` (D34). This file is the source of truth for everything
 * Railway runs; it is deliberately not the source of truth for the corpus.
 *
 * Raw frames and manifest records do NOT live here. They live in Backblaze B2, for
 * the prefix- and capability-scoped keys and the soft-delete semantics D35 depends on.
 * What Railway holds is compute, regenerable derived data, and the corpus index —
 * which is an index over B2, not the truth (D38), and eventually B1's Postgres too.
 */
import { bucket, defineRailway, github, postgres, preserve, project, service } from "railway/iac";

export default defineRailway(() => {
  // OCR output and intermediate parses — regenerable by definition (data/README.md),
  // so a single full-access credential is fine. Nothing in here is evidence.
  // iad is US East, nearest B2's us-east-005. Region is fixed at creation.
  const derived = bucket("derived", { region: "iad" });

  // The corpus index (D43): `ingest` claims a frame's key here before it signs a PUT,
  // which is what makes allocation create-only where B2 cannot (D35). Schema `corpus`,
  // created by services/ingest/schema.sql at startup.
  const db = postgres("postgres");

  const ingest = service("ingest", {
    source: github("douglas-johnson/placard", { branch: "main", rootDirectory: "services/ingest" }),
    start: "uvicorn app:from_env --factory --host 0.0.0.0 --port $PORT",
    healthcheck: "/healthz",
    env: {
      // B2, sealed and set by hand at a prompt, never in a file. The key is ingest's:
      // listFiles + readFiles + writeFiles on raw/, never deleteFiles (§3.2).
      B2_ENDPOINT: preserve(),
      B2_KEY_ID: preserve(),
      B2_KEY: preserve(),
      B2_BUCKET: preserve(),
      // Comma-separated, so a new build's token can overlap the old one's while
      // phones update (field-beta §4).
      UPLOAD_TOKENS: preserve(),
      DATABASE_URL: db.env.DATABASE_URL,
    },
  });

  return project("placard", {
    resources: [derived, db, ingest],
  });
});
