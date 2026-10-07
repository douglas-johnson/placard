#!/usr/bin/env python3
"""Candidate Wikidata items for each subject in label-subjects.json (#42).

Prints the top three matches per search term, for a person to choose from. Matching a
phrase to an item is entity resolution, so nothing is accepted automatically: the
chosen item goes into the file's "resolutions" by hand, or null when nothing fits.
Responses are cached with the spike's other lookups.

    python3 tools/curriculum-spike/resolve-subjects.py [--all]

Without --all, only terms that have no resolution yet are shown.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from spike import Fetcher  # noqa: E402

HERE = Path(__file__).resolve().parent
API = "https://www.wikidata.org/w/api.php"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--all", action="store_true", help="show resolved terms too")
    args = ap.parse_args()

    data = json.loads((HERE / "label-subjects.json").read_text())
    done = data.get("resolutions", {})
    terms = sorted({m["search"] for e in data["encounters"].values() for m in e["mentions"]})
    fx = Fetcher(refresh=False)
    for term in terms:
        if term in done and not args.all:
            continue
        q = {"action": "wbsearchentities", "search": term, "language": "en"}
        body = fx.json(API + "?" + urllib.parse.urlencode({**q, "format": "json", "limit": 3}))
        hits = (body or {}).get("search", [])
        chosen = f"  → {done[term]}" if term in done else ""
        print(f"{term}{chosen}")
        for h in hits:
            print(
                f"    {h['id']:<11} {h.get('label', '')[:40]:<40} {h.get('description', '')[:70]}"
            )
        if not hits:
            print("    (no match)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
