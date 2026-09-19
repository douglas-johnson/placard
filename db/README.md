# db/

Postgres. Schemas, migrations, seed data. Not yet created — B1.

## The shape, decided in advance

**Three schemas, separate credentials per application** (§10). This is how §5's tier
model and §8.5's hard boundary get enforced in the database rather than in the
application, which is the only place they can be enforced reliably:

| Schema | Holds | Who can read it |
|---|---|---|
| `private` | photos, notes, reactions, interest weights, thread state | the learner app's credential only |
| `canon` | artworks, artists, venues, events, claims, provenance | canon service, back office |
| `published` | verified events, what the public site serves | public site (read-only) |

**The back office credential has no grant on `private` at all.** Not a revoked
permission — no grant. §8.5: admin tools are the most common place privacy promises
leak, and the leak always arrives disguised as a reasonable debugging need.

## Model as an explicit property graph

Nodes table, edges table, typed relations — *not* normalized relational tables (§10).
Two reasons: porting to Neo4j or Memgraph later becomes a migration rather than a
rewrite, and the modeling discipline is learned either way.

## Statement-level metadata from the first row

Every edge carries who asserted it, from what source, when, at what confidence, who
corroborated it, who verified it, and what superseded it (§8.3). This cannot be
retrofitted — adding it later means rewriting every query.

**Nothing is ever hard-deleted.** Claims are superseded, and the superseded version
stays queryable. Marking an attribution wrong adds information; it doesn't remove any.

## Events are first-class nodes

`Production`, `Acquisition`, `Sale`, `Exhibiting`, `Treatment` — each with participants,
a time-span, and a place (§4.6). The CIDOC CRM–shaped middle path: homegrown ontology,
CRM-shaped, aligned to Linked Art at the ingestion and publication boundaries rather
than internally. How far to take that is the largest open architectural question in
the plan (§13) — see DECISIONS.md.

## Extensions

`pgvector`, same database, for §4.1c visual embeddings. Avoid a separate vector store
until scale actually demands it.
