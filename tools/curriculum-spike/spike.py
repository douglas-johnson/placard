#!/usr/bin/env python3
"""Rank what to suggest next from one learner's encounters, by triangle closure (#42).

A spike, not the canon: it exists so §13's two schema questions — how far to take
CIDOC CRM, and what seeds canonical facts — get argued from evidence before B1. The
verified fixtures stand in for one learner's `encountered` set (§7), their
neighbourhood comes from the museums' own records and from Wikidata, and candidates
are ranked with §6.1's bonus for connecting two things the learner already knows.

Every edge is held as a claim with its source, record and retrieval time (constraint 2),
and on-view status is kept apart as a display-state claim (§8.2), because that is the
shape B1 will have to store. Nothing here writes to the corpus or leaves the Mac except
public catalog lookups, which are cached under cache/ so a rerun is offline.

    python3 tools/curriculum-spike/spike.py [--refresh] [--claims out.ndjson]
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import UTC, datetime
from itertools import combinations
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
FIXTURES = ROOT / "data/labels/fixtures"
CACHE = HERE / "cache"
UA = "placard-curriculum-spike/0.1 (https://placard.pics)"
MET = "https://collectionapi.metmuseum.org/public/collection"
WDQS = "https://query.wikidata.org/sparql"

VENUE_NAMES = {"met": "the Met", "mcny": "MCNY", "cooper-hewitt": "Cooper Hewitt"}

# How many Wikidata people to pull per shared value.
PER_VALUE = 12
# §6.1: the lever is the ratio of consolidation to expansion. A candidate that links two
# encounters which shared nothing before is worth this much more per pair.
BRIDGE_BONUS = 3.0

# Wikidata properties that make a person a neighbour of another (§7's influenced_by,
# taught, part_of_movement), and ones that only describe them.
LINKING = {
    "P135": "movement",
    "P1066": "student of",
    "P802": "teacher of",
    "P737": "influenced by",
    "P463": "member of",
}
# Schools were linking until the first run put Michael Graves's high school, shared with a
# Second Lady and a basketball player, above the Memphis Group: rare is not relevant.
DESCRIBING = {
    "P69": "educated at",
    "P106": "occupation",
    "P27": "citizenship",
    "P136": "genre",
    "P101": "field",
}


# ── fetching, cached ─────────────────────────────────────────────────────────


class Fetcher:
    def __init__(self, refresh: bool):
        self.refresh = refresh
        self.calls = 0
        CACHE.mkdir(exist_ok=True)

    def json(self, url: str, headers: dict | None = None, pace: float = 0.2) -> dict:
        path = CACHE / (hashlib.sha1(url.encode()).hexdigest() + ".json")
        if path.exists() and not self.refresh:
            return json.loads(path.read_text())["body"]
        req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
        for attempt in range(5):
            try:
                with urllib.request.urlopen(req, timeout=60) as r:
                    body = json.load(r)
                break
            except urllib.error.HTTPError as e:
                if e.code == 404:
                    body = None
                    break
                # 403 is a block, not a hiccup: retrying it is how a block gets longer.
                if e.code not in (429, 500, 502, 503, 504) or attempt == 4:
                    raise
                time.sleep(2**attempt)
        self.calls += 1
        time.sleep(pace)
        retrieved = datetime.now(UTC).isoformat(timespec="seconds")
        path.write_text(json.dumps({"url": url, "retrieved": retrieved, "body": body}))
        return body

    def retrieved(self, url: str) -> str:
        path = CACHE / (hashlib.sha1(url.encode()).hexdigest() + ".json")
        return json.loads(path.read_text())["retrieved"] if path.exists() else ""

    def sparql(self, query: str) -> list[dict]:
        url = WDQS + "?" + urllib.parse.urlencode({"query": query, "format": "json"})
        body = self.json(url, {"Accept": "application/sparql-results+json"})
        return body["results"]["bindings"] if body else []


# ── claims ───────────────────────────────────────────────────────────────────


@dataclass
class Claims:
    """The spike's whole graph: (subject, predicate, object) plus where it came from."""

    rows: list[dict] = field(default_factory=list)

    def add(self, s, p, o, *, source, record, retrieved, cls="canonical", confidence="catalog"):
        self.rows.append(
            {
                "s": s,
                "p": p,
                "o": o,
                "source": source,
                "record": record,
                "retrieved": retrieved,
                "class": cls,
                "confidence": confidence,
            }
        )


# ── dates, as EDTF (D5) ──────────────────────────────────────────────────────


def edtf_year(y: int) -> str:
    return f"{y:05d}" if y < 0 else f"{y:04d}"


def met_edtf(begin: int, end: int, display: str) -> str | None:
    """The Met's begin/end years as an EDTF interval.

    The Met counts BCE years as negatives with no year zero (-375 is 375 BCE); EDTF is
    astronomical, so 375 BCE is -0374. The fixtures were written the same way.
    "ca." in the display date is the approximation the integers drop.
    """
    if begin == 0 and end == 0 and not re.search(r"\d", display or ""):
        return None
    b, e = (y + 1 if y < 0 else y for y in (begin, end))
    q = "~" if re.search(r"\bca\.|\bcirca\b|\babout\b", display or "", re.I) else ""
    if b == e:
        return edtf_year(b) + q
    return f"{edtf_year(b)}{q}/{edtf_year(e)}{q}"


# ── facets ───────────────────────────────────────────────────────────────────


def norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().lower())


def first_term(s: str) -> str:
    """'Marble, Pentelic' → 'marble'; 'Offset lithograph on paper' → 'offset lithograph'."""
    return norm(re.split(r",| on | and |;|\(", s or "", maxsplit=1)[0])


@dataclass
class Work:
    id: str
    title: str
    venue: str
    visit: str
    date: str | None
    facets: dict[str, str] = field(default_factory=dict)  # facet id → human phrase
    gallery: str | None = None
    url: str | None = None


def met_facets(obj: dict) -> dict[str, str]:
    f: dict[str, str] = {}
    culture = obj.get("culture") or ""
    if culture:
        f[f"culture:{norm(culture)}"] = culture
        broad = culture.split(",")[0].strip()
        if broad != culture:
            f[f"culture:{norm(broad)}"] = broad
    if obj.get("period"):
        f[f"period:{norm(obj['period'])}"] = obj["period"]
    if obj.get("objectName"):
        t = first_term(obj["objectName"])
        f[f"type:{t}"] = t
    if obj.get("medium"):
        m = first_term(obj["medium"])
        f[f"material:{m}"] = m
    for c in obj.get("constituents") or []:
        qid = (c.get("constituentWikidata_URL") or "").rsplit("/", 1)[-1]
        key = f"agent:{qid}" if qid else f"agent:{norm(c['name'])}"
        f[key] = re.sub(r"^(Attributed to|Workshop of|Circle of) the ", "the ", c["name"])
    for t in obj.get("tags") or []:
        qid = (t.get("Wikidata_URL") or "").rsplit("/", 1)[-1]
        f[f"subject:{qid or norm(t['term'])}"] = t["term"]
    return f


def facet_kind(key: str) -> str:
    return key.split(":", 1)[0]


# ── the learner ──────────────────────────────────────────────────────────────


def load_learner(fx: Fetcher, claims: Claims) -> list[Work]:
    identities = json.loads((HERE / "identities.json").read_text())["makers"]
    works = []
    for path in sorted(FIXTURES.glob("*.json")):
        d = json.loads(path.read_text())
        e = d.get("expected") or {}
        if not (e.get("title") or e.get("artist")):
            continue  # nothing to connect from (a redacted frame, an untitled fragment)
        w = Work(
            id=f"work:{d['id']}",
            title=e.get("title") or "untitled",
            venue=d["venue"],
            visit=f"{d['captured']}-{d['venue']}",
            date=e.get("date_edtf"),
        )
        rec = f"data/labels/fixtures/{path.name}"
        claims.add(
            w.id, "encountered_by", "learner", source="fixture", record=rec,
            retrieved=d["captured"], cls="private", confidence="verified",
        )  # fmt: skip
        obj_id = (d.get("catalog") or {}).get("object_id")
        if d["venue"] == "met" and obj_id:
            url = f"{MET}/v1/objects/{obj_id}"
            obj = fx.json(url)
            w.facets = met_facets(obj)
            w.url = obj.get("objectURL")
            for k in w.facets:
                claims.add(
                    w.id, facet_kind(k), k, source="met_api", record=url,
                    retrieved=fx.retrieved(url),
                )  # fmt: skip
        else:
            if e.get("medium"):
                m = first_term(e["medium"])
                w.facets[f"material:{m}"] = m
            if e.get("artist"):
                qid = (identities.get(e["artist"]) or {}).get("qid")
                w.facets[f"agent:{qid}" if qid else f"agent:{norm(e['artist'])}"] = e["artist"]
            for k in w.facets:
                claims.add(
                    w.id, facet_kind(k), k, source="fixture", record=rec,
                    retrieved=d["captured"], confidence="verified",
                )  # fmt: skip
        works.append(w)
    return works


# ── the Met: candidate works, and how common each facet is ───────────────────
#
# From the Met's Open Access CSV, not its search API. The API's bot protection blocked
# this Mac after ~80 searches at 20 a second (2026-10-04), and the Met's own docs send
# anyone enumerating the collection to the dataset. It is one download, it gives exact
# facet counts across all 470,000 objects, and it is the museum's own data (constraint 6
# does not apply). It was last published 2023-06-17, which is fine for canonical facts
# and stale for display state, so its gallery numbers only nominate candidates; the few
# that are suggested are confirmed live (confirm_on_view).

MET_CSV = CACHE / "MetObjects.csv"
MET_CSV_URL = "https://media.githubusercontent.com/media/metmuseum/openaccess/master/MetObjects.csv"
MET_CSV_AS_OF = "2023-06-17"


def csv_obj(row: dict) -> dict:
    """A CSV row in the API's shape, so both go through met_facets."""
    split = lambda s: s.split("|") if s else []  # noqa: E731
    names, wd = split(row["Artist Display Name"]), split(row["Artist Wikidata URL"])
    terms, tag_wd = split(row["Tags"]), split(row["Tags Wikidata URL"])
    return {
        "culture": row["Culture"],
        "period": row["Period"],
        "objectName": row["Object Name"],
        "medium": row["Medium"],
        "constituents": [
            {"name": n, "constituentWikidata_URL": wd[i] if i < len(wd) else ""}
            for i, n in enumerate(names)
            if n
        ],
        "tags": [
            {"term": t, "Wikidata_URL": tag_wd[i] if i < len(tag_wd) else ""}
            for i, t in enumerate(terms)
            if t
        ],
    }


def met_candidates(learner: list[Work], claims: Claims) -> tuple[list[Work], dict]:
    if not MET_CSV.exists():
        sys.exit(f"Missing {MET_CSV}; fetch it once with\n  curl -L -o '{MET_CSV}' {MET_CSV_URL}")
    seen = {w.url for w in learner if w.url}
    wanted = {k for w in learner for k in w.facets}
    totals: Counter = Counter()
    out = []
    with MET_CSV.open(encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            facets = met_facets(csv_obj(row))
            totals.update(facets.keys())
            url = f"https://www.metmuseum.org/art/collection/search/{row['Object ID']}"
            if not row["Gallery Number"] or url in seen or not (facets.keys() & wanted):
                continue
            begin, end = int(row["Object Begin Date"] or 0), int(row["Object End Date"] or 0)
            w = Work(
                id=f"work:met:{row['Object ID']}",
                title=row["Title"] or row["Object Name"] or "untitled",
                venue="met",
                visit="",
                date=met_edtf(begin, end, row["Object Date"]),
                facets=facets,
                gallery=row["Gallery Number"],
                url=url,
            )
            out.append(w)
    for w in out:
        for k in w.facets:
            claims.add(
                w.id, facet_kind(k), k, source="met_open_access",
                record=f"MetObjects.csv#{w.id[9:]}", retrieved=MET_CSV_AS_OF,
            )  # fmt: skip
        # Where the dataset said the object was in 2023: a display-state claim (§8.2),
        # and an old one. confirm_on_view adds today's for the few that get suggested.
        claims.add(
            w.id, "on_view_at", f"met gallery {w.gallery}", source="met_open_access",
            record=f"MetObjects.csv#{w.id[9:]}", retrieved=MET_CSV_AS_OF, cls="display",
        )  # fmt: skip
    return out, dict(totals)


class Blocked(Exception):
    pass


def confirm_on_view(fx: Fetcher, w: Work, claims: Claims) -> str:
    """Today's gallery from the live API, one request a second; stop at the first block."""
    url = f"{MET}/v1/objects/{w.id[9:]}"
    try:
        obj = fx.json(url, pace=1.0)
    except urllib.error.HTTPError as e:
        if e.code == 403:
            raise Blocked from e
        raise
    gallery = (obj or {}).get("GalleryNumber") or ""
    claims.add(
        w.id, "on_view_at", f"met gallery {gallery}" if gallery else "not on view",
        source="met_api", record=url, retrieved=fx.retrieved(url), cls="display",
    )  # fmt: skip
    return "confirmed" if gallery else "off view"


# ── Wikidata: what the learner's makers are connected to ─────────────────────


def wd_values(fx: Fetcher, qids: list[str], claims: Claims) -> dict[str, dict[str, set]]:
    """For each maker, the values of the linking and describing properties."""
    props = " ".join(f"wdt:{p}" for p in [*LINKING, *DESCRIBING])
    vals = " ".join(f"wd:{q}" for q in qids)
    rows = fx.sparql(
        f"SELECT ?a ?p ?v ?vLabel WHERE {{ VALUES ?a {{ {vals} }} VALUES ?p {{ {props} }} "
        f'?a ?p ?v . SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }} }}'
    )
    out: dict[str, dict[str, set]] = defaultdict(lambda: defaultdict(set))
    labels: dict[str, str] = {}
    for r in rows:
        a = r["a"]["value"].rsplit("/", 1)[-1]
        p = r["p"]["value"].rsplit("/", 1)[-1]
        v = r["v"]["value"].rsplit("/", 1)[-1]
        out[a][p].add(v)
        labels[v] = r["vLabel"]["value"]
        claims.add(
            f"agent:{a}", (LINKING | DESCRIBING)[p], f"wd:{v}", source="wikidata",
            record=f"https://www.wikidata.org/wiki/{a}#{p}", retrieved="(query cache)",
        )  # fmt: skip
    out["_labels"] = labels  # type: ignore[assignment]
    return out


@dataclass
class Person:
    qid: str
    label: str
    description: str
    sitelinks: int
    # learner work → (property, shared value, how rare that value is)
    via: dict[str, tuple[str, str, float]] = field(default_factory=dict)

    @property
    def weight(self) -> float:
        return sum(w for _, _, w in self.via.values())


def wd_neighbours(fx: Fetcher, learner: list[Work], values: dict, claims: Claims):
    """Other people who share a linking value with one of the learner's makers."""
    labels = values["_labels"]
    makers_of: dict[str, list[Work]] = defaultdict(list)
    for w in learner:
        for k in w.facets:
            if k.startswith("agent:Q"):
                makers_of[k[6:]].append(w)
    people: dict[str, Person] = {}
    totals: dict[tuple[str, str], int] = {}
    for qid, props in values.items():
        if qid == "_labels":
            continue
        for p, vs in props.items():
            if p not in LINKING:
                continue
            for v in vs:
                count = fx.sparql(f"SELECT (COUNT(?x) AS ?n) WHERE {{ ?x wdt:{p} wd:{v} }}")
                totals[(p, v)] = int(count[0]["n"]["value"]) if count else 0
                rows = fx.sparql(
                    f"SELECT ?x ?xLabel ?xDescription ?s WHERE {{ ?x wdt:{p} wd:{v} ; "
                    f"wdt:P31 wd:Q5 ; wikibase:sitelinks ?s . FILTER(?x != wd:{qid}) "
                    f'SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en". }} }} '
                    f"ORDER BY DESC(?s) LIMIT {PER_VALUE}"
                )
                for r in rows:
                    x = r["x"]["value"].rsplit("/", 1)[-1]
                    if f"agent:{x}" in makers_of:
                        continue
                    person = people.setdefault(
                        x,
                        Person(
                            x,
                            r.get("xLabel", {}).get("value", x),
                            r.get("xDescription", {}).get("value", ""),
                            int(r["s"]["value"]),
                        ),
                    )
                    # Harvard and the American Academy of Arts and Letters are hubs, not
                    # neighbourhoods: weigh a shared value by how few people share it.
                    weight = 1 / math.log2(2 + totals[(p, v)])
                    for w in makers_of[qid]:
                        if weight > person.via.get(w.id, ("", "", 0.0))[2]:
                            person.via[w.id] = (p, labels.get(v, v), weight)
                    claims.add(
                        f"agent:{x}", LINKING[p], f"wd:{v}", source="wikidata",
                        record=f"https://www.wikidata.org/wiki/{x}#{p}", retrieved="(query cache)",
                    )  # fmt: skip
    return list(people.values()), totals


# ── ranking (§6.1) ───────────────────────────────────────────────────────────


def specificity(key: str, totals: dict[str, int]) -> float:
    """A facet shared by a handful of things says more than one shared by thousands."""
    n = totals.get(key)
    if n is None:
        return 0.5
    return 1 / math.log2(2 + n)


@dataclass
class Ranked:
    work: Work
    score: float
    anchors: dict[str, tuple[str, float]]  # learner work id → (facet, specificity)
    bridges: list[tuple[str, str]]


def rank(candidates: list[Work], learner: list[Work], totals: dict[str, int]) -> list[Ranked]:
    by_id = {w.id: w for w in learner}

    def shared(a: Work, b: Work) -> set[str]:
        return a.facets.keys() & b.facets.keys()

    out = []
    for c in candidates:
        anchors = {}
        for e in learner:
            common = c.facets.keys() & e.facets.keys()
            if common:
                best = max(common, key=lambda k: specificity(k, totals))
                anchors[e.id] = (best, specificity(best, totals))
        if not anchors:
            continue
        # The two strongest links only: a generic object that touches twenty encounters
        # through "terracotta" is not twenty times as interesting.
        strongest = sorted((s for _, s in anchors.values()), reverse=True)
        score = sum(strongest[:2])
        # A bridge: reached by different facets, between two encounters that had nothing
        # in common before. That is a new edge in the learner's map (§6.1), and the bonus
        # is paid once, for the best one.
        bridges = [
            (a, b)
            for a, b in combinations(sorted(anchors), 2)
            if anchors[a][0] != anchors[b][0] and not shared(by_id[a], by_id[b])
        ]
        bridges.sort(key=lambda ab: -min(anchors[ab[0]][1], anchors[ab[1]][1]))
        if bridges:
            a, b = bridges[0]
            score += BRIDGE_BONUS * min(anchors[a][1], anchors[b][1])
        out.append(Ranked(c, score, anchors, bridges))
    return sorted(out, key=lambda r: -r.score)


# ── the voice (§1): proposes, never assigns ──────────────────────────────────


def phrase(key: str, label: str) -> str:
    return {
        "culture": f"also {label}",
        "period": f"from the same {label} period",
        "type": f"another {label}",
        "material": f"also {label}",
        "subject": f"it shows {label.lower()} too",
        "agent": f"also by {label}",
    }.get(facet_kind(key), label)


def say(r: Ranked, by_id: dict[str, Work]) -> str:
    w = r.work
    where = f"in gallery {w.gallery} at the Met"
    parts = []
    order = [x for pair in r.bridges for x in pair] or list(r.anchors)
    for eid in dict.fromkeys(order):
        e = by_id[eid]
        key, _ = r.anchors[eid]
        parts.append(f"{phrase(key, w.facets[key])}, like the {e.title} at {VENUE_NAMES[e.venue]}")
        if len(parts) == 2:
            break
    joined = " — and ".join(parts) if len(parts) == 2 else parts[0]
    tail = " Want to see what they have in common?" if r.bridges else ""
    return f"{w.title}, {where}: {joined}.{tail}"


def say_person(p: Person, by_id: dict[str, Work]) -> str:
    links = []
    for wid, (prop, value, _) in sorted(p.via.items(), key=lambda kv: -kv[1][2])[:2]:
        rel = {
            "P135": f"was part of {value} too",
            "P1066": f"also studied with {value}",
            "P802": f"also taught {value}",
            "P737": f"was also influenced by {value}",
            "P463": f"was also a member of {value}",
        }[prop]
        links.append(f"{rel} (from the {by_id[wid].title})")
    desc = f", {p.description}" if p.description else ""
    return f"{p.label}{desc}, " + "; ".join(links) + "."


# ── report ───────────────────────────────────────────────────────────────────


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--refresh", action="store_true", help="refetch instead of using cache/")
    ap.add_argument("--claims", type=Path, help="write every claim as NDJSON here")
    ap.add_argument("--top", type=int, default=10)
    args = ap.parse_args()

    fx = Fetcher(args.refresh)
    claims = Claims()
    log = lambda m: print(m, file=sys.stderr)  # noqa: E731

    learner = load_learner(fx, claims)
    by_id = {w.id: w for w in learner}
    log(f"learner: {len(learner)} encounters over {len({w.visit for w in learner})} visits")

    candidates, totals = met_candidates(learner, claims)
    log(f"met: {len(candidates)} candidate works in a gallery as of {MET_CSV_AS_OF}")

    qids = sorted({k[6:] for w in learner for k in w.facets if k.startswith("agent:Q")})
    values = wd_values(fx, qids, claims)
    people, wd_totals = wd_neighbours(fx, learner, values, claims)
    log(f"wikidata: {len(qids)} makers, {len(people)} neighbours ({fx.calls} requests)")

    if args.claims:
        with args.claims.open("w") as f:
            for row in claims.rows:
                f.write(json.dumps(row) + "\n")

    p = print
    p("# Curriculum spike (#42)\n")

    # 1. What the learner's own visits already share — latent threads.
    p("## Already in your visits\n")
    p("Facets that two or more encounters share, across different visits.\n")
    holders: dict[str, list[Work]] = defaultdict(list)
    for w in learner:
        for k in w.facets:
            holders[k].append(w)
    latent = [(k, ws) for k, ws in holders.items() if len({w.visit for w in ws}) >= 2]
    for k, ws in sorted(latent, key=lambda kv: -specificity(kv[0], totals)):
        p(f"- **{k}** — " + "; ".join(f"{w.title} ({VENUE_NAMES[w.venue]})" for w in ws))
    if not latent:
        p("- nothing: no two visits share a maker, culture, period, type, material or subject")
    p()

    ranked = rank(candidates, learner, totals)
    closing = [r for r in ranked if r.bridges]
    leaves = [r for r in ranked if len(r.anchors) == 1]

    # 2. Go see: closures first, with a few leaves for contrast. Each is checked against
    # the live API before it's shown, since the dataset's galleries are from 2023.
    blocked = False

    def show(r: Ranked) -> bool:
        nonlocal blocked
        status = "unconfirmed: the API is blocking this Mac"
        if not blocked:
            try:
                status = confirm_on_view(fx, r.work, claims)
            except Blocked:
                blocked = True
        if status == "off view":
            return False
        p(f"- {say(r, by_id)}  \n  `score {r.score:.2f}` · on view {status} · {r.work.url}")
        return True

    def section(title: str, rs: list[Ranked], top: int) -> None:
        p(f"## {title}\n")
        shown: Counter = Counter()
        n = 0
        for r in rs:
            pair = r.bridges[0] if r.bridges else tuple(sorted(r.anchors)[:2])
            key = frozenset((eid, r.anchors[eid][0]) for eid in pair)
            if shown[key] >= 2:
                continue  # ten kraters for the same pair is a list, not a horizon (§6.2)
            if show(r):
                shown[key] += 1
                n += 1
            if n >= top:
                break
        p()

    consolidating = [r for r in ranked if len(r.anchors) > 1 and not r.bridges]
    section(
        "Go see — connects two encounters that shared nothing (§6.1 closure)", closing, args.top
    )
    section("Go see — deepens a link two encounters already share", consolidating, 5)
    section("Go see — a leaf, for contrast", leaves, 3)

    # The graph is not limited to what's on view (§6.6): the Met holds work by makers
    # met elsewhere, joinable when both sides carry the same Wikidata identifier.
    p("## The Met holds more by makers you met elsewhere\n")
    elsewhere = {k: ph for w in learner if w.venue != "met" for k, ph in w.facets.items()}
    held = [
        (ph, totals[k]) for k, ph in elsewhere.items() if k.startswith("agent:") and k in totals
    ]
    for ph, n_held in sorted(held, key=lambda x: -x[1]):
        p(f"- {ph}: {n_held} in the Met's open access data")
    if not held:
        p("- none joinable by identifier")
    p()

    # 3. Look into: people, ranked by how many encounters they reach.
    p("## Look into — people near your makers (Wikidata)\n")
    people.sort(key=lambda x: (-x.weight, -x.sitelinks))
    for person in people[: args.top]:
        p(f"- {say_person(person, by_id)}")

    # 4. The numbers that answer #42's questions.
    p("\n## What the spike found\n")
    p(f"- Encounters: {len(learner)}, over {len({w.visit for w in learner})} visits.")
    p(
        f"- Met candidates on view: {len(candidates)}; reaching one encounter: {len(leaves)}; "
        f"deepening an existing link: {len(consolidating)}; bridging two that shared "
        f"nothing: {len(closing)}."
    )
    kinds: Counter = Counter()
    for r in closing[:50]:
        for a, b in r.bridges:
            kinds[facet_kind(r.anchors[a][0])] += 1
            kinds[facet_kind(r.anchors[b][0])] += 1
    p(f"- Facets carrying the top 50 closures: {dict(kinds.most_common())}.")
    reached = Counter(eid for r in closing for eid in r.anchors)
    by_venue = Counter(by_id[eid].venue for eid in reached)
    p(f"- Encounters any closure reaches, by venue: {dict(by_venue)}.")
    alone = [w for w in learner if w.id not in reached]
    p(f"- Encounters no closure reaches ({len(alone)}): " + ", ".join(w.title for w in alone))
    makers = [w for w in learner if any(k.startswith("agent:") for k in w.facets)]
    p(f"- Encounters with a named maker: {len(makers)}; with a Wikidata link: {len(qids)} makers.")
    linking = {(q, pr) for q, props in values.items() if q != "_labels" for pr in props}
    linking = {x for x in linking if x[1] in LINKING}
    p(
        f"- Makers with any linking property on Wikidata (movement, teacher, influence, "
        f"membership): {len({q for q, _ in linking})} of {len(qids)}."
    )
    sources = Counter(r["source"] for r in claims.rows)
    classes = Counter(r["class"] for r in claims.rows)
    p(f"- Claims: {len(claims.rows)} by source {dict(sources)}, by class {dict(classes)}.")
    p(f"- Requests this run: {fx.calls} (the rest from cache/).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
