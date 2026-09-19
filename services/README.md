# services/

| Directory | What | Phase | Stack | Status |
|---|---|---|---|---|
| `canon/` | Graph, extraction, ingestion, API | B1 | FastAPI + Python | not started |

Python, so that ML, graph work, and the API stay in one language — §10 notes that a
TypeScript API layer would add a boundary a solo developer has to maintain alone.

**Not needed for A1.** The capture app resolves against a small hardcoded catalog
first (§11 A1). Stand this up when A2 needs real collection APIs and entity resolution,
which is also when B1 stops being parallel work and becomes a dependency.

**Note on Python version:** the machine currently has 3.14, which is ahead of some
scientific and ML wheels. Pin this service to 3.12 or 3.13 when it's created rather
than discovering the gap mid-build.
