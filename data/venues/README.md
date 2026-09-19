# Venue registry

One file per institution, `<slug>.json`. Hand-authored.

Three jobs, all from PLANNING.md:

1. **§4.1b — the location prior.** GPS narrows the candidate set from "all art" to
   the objects this institution has on view. This is the single largest prior in the
   identification problem.
2. **§4.3 — accession format.** Knowing the venue means knowing the accession pattern,
   which is what makes accession recognition tunable rather than generic.
3. **§9.6 — access rules.** Structured conditions the client can evaluate against a
   local eligibility profile. The canon publishes *rules*; the profile never leaves
   the device.

See `_example.json` for the shape. Every field is a claim, not a fact — `verified`
records when it was last checked against the institution's own page, per §8.2.
