#!/usr/bin/env python3
"""Bring uploaded takes from placard-raw down to data/labels/raw/, replacing USB.

The bucket is mirrored as it is laid out (infrastructure.md §5.1):

    data/labels/raw/<contributor>/<take>/f0007-label.jpg
    data/labels/raw/<contributor>/<take>/records/000015-ocr.json

and for each take, two regenerable files are written to derived/:

    data/labels/derived/<contributor>/<take>/manifest.ndjson   records sorted by seq (D38)
    data/labels/derived/<contributor>/<take>/frames.json       {key, sha256, bytes} per frame (D37)

Only what is missing is downloaded, and a local raw file is never overwritten: raw is
immutable (data/README.md), so a local file that disagrees with the bucket is reported,
not "fixed". Each download is checked against B2's own SHA-1 before it is kept.

Takes pushed before the bucket (2026-09-16-mcny, 2026-09-20-met) stay where they are
until the fixture rebinding in infrastructure.md §9 moves them.

    python3 tools/corpus-pull/corpus-pull.py [--contributor <id>] [--take <take-id>] [--dry-run]

Reads the Mac's read-only key (listFiles + readFiles on raw/) from the login keychain,
stored once with:

    security add-generic-password -s placard-b2-mac -a placard -w
    (type keyId:applicationKey at the hidden prompt)
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools/lib"))
from b2native import B2, keychain_secret  # noqa: E402

RECORD = re.compile(r"^records/(\d{6})-[a-z_]+\.json$")
MARKER = re.compile(r"^records/redacted-f\d{4,6}\.json$")
FRAME_FILE = re.compile(r"^f\d{4,6}-[a-z_]+\.jpg$")


def digest(path: Path, algo: str) -> str:
    h = hashlib.new(algo)
    with path.open("rb") as f:
        while chunk := f.read(1 << 20):
            h.update(chunk)
    return h.hexdigest()


def expected_sha1(info: dict) -> str | None:
    s = info.get("contentSha1") or ""
    s = s.removeprefix("unverified:")
    return s if re.fullmatch(r"[0-9a-f]{40}", s) else None


def pull_take(b2: B2, files: list[dict], root: Path, dry: bool) -> list[str]:
    """Download what's missing; return problems (never raises on a single bad file)."""
    problems = []
    for info in files:
        dest = root / "data/labels" / info["fileName"]
        sha1 = expected_sha1(info)
        if dest.exists():
            if dest.stat().st_size != info["contentLength"] or (sha1 and digest(dest, "sha1") != sha1):
                problems.append(f"{info['fileName']}: local copy differs from the bucket; left alone")
            continue
        if dry:
            print(f"  would fetch {info['fileName']}")
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        part = dest.with_name(dest.name + ".part")
        b2.download_to(info["fileId"], part)
        if part.stat().st_size != info["contentLength"] or (sha1 and digest(part, "sha1") != sha1):
            part.unlink()
            problems.append(f"{info['fileName']}: download failed its checksum; not kept")
            continue
        part.rename(dest)
    return problems


def derive(c: str, take: str, root: Path) -> list[str]:
    """Rebuild manifest.ndjson and frames.json from the local mirror; return a status line's parts."""
    src = root / "data/labels/raw" / c / take
    out = root / "data/labels/derived" / c / take
    records = sorted(
        (int(m.group(1)), p) for p in (src / "records").glob("*.json") if (m := RECORD.match(f"records/{p.name}"))
    ) if (src / "records").exists() else []
    markers = sorted(p for p in (src / "records").glob("redacted-*.json")) if (src / "records").exists() else []

    lines = [p.read_text().rstrip("\n") for _, p in records] + [p.read_text().rstrip("\n") for p in markers]
    out.mkdir(parents=True, exist_ok=True)
    (out / "manifest.ndjson").write_text("".join(l + "\n" for l in lines))

    frames = sorted(p for p in src.glob("*.jpg") if FRAME_FILE.match(p.name))
    (out / "frames.json").write_text(json.dumps([
        {"key": f"{c}/{take}/{p.name}", "sha256": digest(p, "sha256"), "bytes": p.stat().st_size} for p in frames
    ], indent=1) + "\n")

    # Completeness: take_ended is a claim about what should exist (D38); compare.
    parsed = [json.loads(l) for l in lines]
    seqs = [s for s, _ in records]
    missing = sorted(set(range(1, (max(seqs) if seqs else 0) + 1)) - set(seqs))
    ended = next((r for r in parsed if r.get("type") == "take_ended"), None)
    redacted = {r["frame"] for r in parsed if r.get("type") == "redacted"}
    have = {p.name for p in frames}
    wanted = [r["file"] for r in parsed if r.get("type") == "frame" and r.get("file") and r["frame"] not in redacted]
    absent = [f for f in wanted if f not in have]

    parts = [f"{len(frames)} frames, {len(records)} records"]
    if missing:
        parts.append(f"records not yet up: seq {', '.join(map(str, missing[:8]))}{'…' if len(missing) > 8 else ''}")
    if absent:
        parts.append(f"{len(absent)} frame(s) not yet up")
    if ended is None:
        parts.append("still open")
    elif not missing and not absent and ended["seq"] == (max(seqs) if seqs else None):
        parts.append("complete")
    if redacted:
        parts.append(f"redacted: {', '.join(sorted(redacted))}")
    return parts


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--contributor")
    p.add_argument("--take")
    p.add_argument("--dry-run", action="store_true")
    a = p.parse_args(argv)

    key_id, _, key = keychain_secret("placard-b2-mac").partition(":")
    b2 = B2(key_id, key)
    prefix = "raw/" + (f"{a.contributor}/" if a.contributor else "") + (f"{a.take}/" if a.contributor and a.take else "")
    takes: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for info in b2.names(b2.bucket_id(), prefix):
        parts = info["fileName"].split("/", 3)
        if len(parts) == 4 and (a.take is None or parts[2] == a.take):
            takes[(parts[1], parts[2])].append(info)

    if not takes:
        print(f"nothing under {prefix}")
        return 0
    problems = []
    for (c, take), files in sorted(takes.items()):
        problems += pull_take(b2, files, ROOT, a.dry_run)
        if not a.dry_run:
            print(f"{c}/{take}: " + "; ".join(derive(c, take, ROOT)))
    for msg in problems:
        print(f"PROBLEM {msg}", file=sys.stderr)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
