#!/usr/bin/env python3
"""Can a label's interpretive text carry the subject facet? (#42)

Reads label-subjects.json — what each encounter's interpretive text names, annotated by
hand and linked to Wikidata — and measures three things:

1. Coverage: how many encounters have interpretive text, and how many name something
   linkable, by venue.
2. What the text names: mentions by relationship (about, depicts, influence, context…),
   and how many link to a Wikidata item.
3. Reach: with the linked subjects added as facets, which encounters any closure (§6.1)
   now reaches, compared with the spike's catalog-only run.

    python3 tools/curriculum-spike/label-subjects.py [--relations about,depicts] [--examples 8]

Subjects enter as inferred claims (§4.8): the label says it, a person linked it, and no
catalog confirms it. Uses the spike's cache; run spike.py once first.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import spike  # noqa: E402

HERE = Path(__file__).resolve().parent
VENUES = ["cooper-hewitt", "mcny", "met"]


def venue_of(fixture: str) -> str:
    return next(v for v in VENUES if fixture.startswith(v))


def reached(ranked: list[spike.Ranked]) -> set[str]:
    return {eid for r in ranked if r.bridges for eid in r.anchors}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument(
        "--relations",
        default="about,depicts",
        help="which relationships count as subject facets (default: about,depicts)",
    )
    ap.add_argument("--examples", type=int, default=8)
    args = ap.parse_args()
    use = set(args.relations.split(","))

    data = json.loads((HERE / "label-subjects.json").read_text())
    res = data["resolutions"]
    enc = data["encounters"]
    p = print

    # 1. Coverage.
    p("# Label subjects (#42)\n")
    p(f"Annotated by hand, unreviewed. Subject facets here: {', '.join(sorted(use))}.\n")
    p("## Coverage, by venue\n")
    p(
        "| | encounters | with interpretive text | names anything | names a linked item | "
        "a linked subject (" + "/".join(sorted(use)) + ") | from the object's own text |"
    )
    p("|---|---|---|---|---|---|---|")
    totals: Counter = Counter()
    for v in VENUES:
        row: Counter = Counter()
        for fid, e in enc.items():
            if venue_of(fid) != v:
                continue
            ms = e["mentions"]
            linked = [m for m in ms if res.get(m["search"])]
            subj = [m for m in linked if m["relation"] in use]
            row["n"] += 1
            row["text"] += bool(e["texts"])
            row["any"] += bool(ms)
            row["linked"] += bool(linked)
            row["subj"] += bool(subj)
            row["own"] += any(m["scope"] == "object" for m in subj)
        totals.update(row)
        p(
            f"| {spike.VENUE_NAMES[v]} | {row['n']} | {row['text']} | {row['any']} | "
            f"{row['linked']} | {row['subj']} | {row['own']} |"
        )
    t = totals
    p(
        f"| **all** | {t['n']} | {t['text']} | {t['any']} | {t['linked']} | "
        f"{t['subj']} | {t['own']} |"
    )
    p()

    # 2. What the text names.
    p("## What the text names\n")
    p("| relationship | mentions | linked | from the object's own text |")
    p("|---|---|---|---|")
    by_rel: dict[str, Counter] = defaultdict(Counter)
    for e in enc.values():
        for m in e["mentions"]:
            c = by_rel[m["relation"]]
            c["n"] += 1
            c["linked"] += bool(res.get(m["search"]))
            c["own"] += m["scope"] == "object"
    for rel in sorted(by_rel, key=lambda r: -by_rel[r]["n"]):
        c = by_rel[rel]
        p(f"| {rel} | {c['n']} | {c['linked']} | {c['own']} |")
    unresolved = sorted(t for t, q in res.items() if q is None)
    p(
        f"\nUnresolved ({len(unresolved)}): "
        + "; ".join(f"{t} — {data['resolution_notes'].get(t, '')}" for t in unresolved)
    )
    p()

    # 3. Reach, before and after.
    claims = spike.Claims()
    fx = spike.Fetcher(refresh=False)
    learner = spike.load_learner(fx, claims)
    by_id = {w.id: w for w in learner}
    candidates, totals_met = spike.met_candidates(learner, claims)
    before = spike.rank(candidates, learner, totals_met)

    catalog_keys = {w.id: set(w.facets) for w in learner}
    added = 0
    for w in learner:
        e = enc.get(w.id[5:])
        if not e:
            continue
        for m in e["mentions"]:
            q = res.get(m["search"])
            if q and m["relation"] in use:
                key = f"subject:{q}"
                if key not in w.facets:
                    w.facets[key] = m["text"]
                    added += 1
    # Candidates are filtered by the learner's facets, so collect them again.
    candidates, totals_met = spike.met_candidates(learner, claims)
    after = spike.rank(candidates, learner, totals_met)

    p("## Reach: which encounters a closure reaches\n")
    p(
        f"{added} linked subjects added as facets. Candidates are Met objects in a gallery "
        f"in the Open Access data; only the Met supplies candidates.\n"
    )
    p("| | encounters | reached, catalog only | reached, with label subjects |")
    p("|---|---|---|---|")
    rb, ra = reached(before), reached(after)
    for v in VENUES:
        ids = [w.id for w in learner if w.venue == v]
        p(
            f"| {spike.VENUE_NAMES[v]} | {len(ids)} | {sum(i in rb for i in ids)} | "
            f"{sum(i in ra for i in ids)} |"
        )
    p()
    newly = [by_id[i] for i in sorted(ra - rb)]
    p(
        "Newly reached: "
        + (", ".join(f"{w.title} ({spike.VENUE_NAMES[w.venue]})" for w in newly) or "none")
    )
    still = [w for w in learner if w.id not in ra]
    p(
        "\nStill reached by no closure: "
        + ", ".join(f"{w.title} ({spike.VENUE_NAMES[w.venue]})" for w in still)
    )
    p()

    p("## Label subjects that carried a closure\n")
    # Only subjects the label adds: one the Met's own tags already gave is not the label's.
    label_keys = {
        (w.id, f"subject:{res[m['search']]}")
        for w in learner
        for m in enc.get(w.id[5:], {}).get("mentions", [])
        if res.get(m["search"])
        and m["relation"] in use
        and f"subject:{res[m['search']]}" not in catalog_keys[w.id]
    }
    carried: Counter = Counter()
    for r in after:
        if not r.bridges:
            continue
        a, b = r.bridges[0]
        for eid in (a, b):
            key = r.anchors[eid][0]
            if (eid, key) in label_keys:
                carried[(by_id[eid].title, by_id[eid].facets[key])] += 1
    for (title, subject), n in carried.most_common(15):
        p(f"- {subject} — {title}: {n} closures")
    if not carried:
        p("- none")
    p()

    # Examples that reach a non-Met encounter through a label subject.
    p("## Examples: closures that reach Cooper Hewitt or MCNY\n")
    shown = 0
    seen: set = set()
    for r in after:
        if not r.bridges:
            continue
        a, b = r.bridges[0]
        if not any(by_id[x].venue != "met" for x in (a, b)):
            continue
        key = frozenset(r.anchors[x][0] for x in (a, b))
        if key in seen:
            continue
        seen.add(key)
        p(f"- {spike.say(r, by_id)}  \n  `score {r.score:.2f}` · {r.work.url}")
        shown += 1
        if shown >= args.examples:
            break
    if not shown:
        p("- none")
    return 0


if __name__ == "__main__":
    sys.exit(main())
