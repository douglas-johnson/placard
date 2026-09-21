#!/usr/bin/env python3
"""Bind an F0 manifest to the camera-roll files Image Capture imported.

The app saves each frame twice: role-named (f0007-label.jpg) in its own sandbox,
and as a camera-roll asset, which is what Image Capture hands over — under a name
like AJIG7042.JPG that carries no role. The manifest is the only thing that says
which file is which, and it never leaves the phone by the same route as the frames,
so the two are rejoined here by capture time: manifest `ts` (UTC) against EXIF
DateTimeOriginal + OffsetTimeOriginal, read by tools/exif/exif-check.swift.

Output is one JSON per take in data/labels/derived/ — regenerable from raw/, which
is why it lives there and not in fixtures/. Stock-camera frames (IMG_*.HEIC) shot
alongside the app are listed unbound with the nearest group; which group they belong
to is a human call and goes in the fixture, not here.

    python3 tools/manifest/bind-frames.py data/labels/raw/2026-09-20-met
"""
import datetime as dt
import json
import re
import subprocess
import sys
from pathlib import Path

TOLERANCE_S = 3
ROOT = Path(__file__).resolve().parents[2]
EXIF_TOOL = ROOT / "tools/exif/exif-check.swift"
LINE = re.compile(r"(\S+)\s+(\d{4}):(\d\d):(\d\d) (\d\d:\d\d:\d\d) ([+-]\d\d:\d\d)")


def exif_times(take: Path) -> dict[str, dt.datetime]:
    files = sorted(p for p in take.iterdir() if p.suffix.upper() in (".JPG", ".JPEG", ".HEIC"))
    out = subprocess.run(["swift", str(EXIF_TOOL), *map(str, files)], capture_output=True, text=True, check=True).stdout
    times = {}
    for line in out.splitlines():
        m = LINE.match(line)
        if not m:
            continue
        local = dt.datetime.fromisoformat(f"{m[2]}-{m[3]}-{m[4]}T{m[5]}{m[6]}")
        times[m[1]] = local.astimezone(dt.timezone.utc)
    return times


def main(take_dir: str) -> int:
    take = Path(take_dir)
    manifest = take / "manifest.ndjson"
    if not manifest.exists():
        print(f"no manifest in {take}", file=sys.stderr)
        return 1
    records = [json.loads(l) for l in manifest.read_text().splitlines() if l.strip()]
    frames = [r for r in records if r["type"] == "frame"]
    times = exif_times(take)

    bound, unbound, redacted, used = [], [], [], set()
    for f in frames:
        if f.get("redacted"):
            # The one edit ever made to a raw take: a frame removed because it named a
            # minor (data/README.md, "Minors"). Nothing to bind, nothing wrong.
            redacted.append({"frame": f["frame"], "kind": f["kind"], "group": f.get("group"), "note": f["redacted"]})
            continue
        t = dt.datetime.fromisoformat(f["ts"].replace("Z", "+00:00"))
        nearest = min(((abs((e - t).total_seconds()), n) for n, e in times.items() if n not in used), default=None)
        entry = {
            "frame": f["frame"],
            "kind": f["kind"],
            "group": f.get("group") or f.get("linked_group"),
            "sign_kind": f.get("sign_kind"),
            "manifest_ts": f["ts"],
            "app_file": f["file"],
        }
        if nearest and nearest[0] <= TOLERANCE_S:
            used.add(nearest[1])
            bound.append({**entry, "file": f"raw/{take.name}/{nearest[1]}", "delta_s": round(nearest[0])})
        else:
            unbound.append({**entry, "file": None, "nearest": nearest and {"file": nearest[1], "delta_s": round(nearest[0])}})

    # Anything left over is a stock-camera frame shot alongside the app. Say where it
    # falls in the group sequence so a human can place it quickly.
    opened = [(dt.datetime.fromisoformat(r["ts"].replace("Z", "+00:00")), r["group"]) for r in records if r["type"] == "group_opened"]
    extras = []
    for n in sorted(set(times) - used):
        t = times[n]
        before = [g for ts, g in opened if ts <= t]
        after = [g for ts, g in opened if ts > t]
        extras.append({
            "file": f"raw/{take.name}/{n}",
            "captured_utc": t.isoformat(),
            "after_group": before[-1] if before else None,
            "before_group": after[0] if after else None,
        })

    out = {
        "take": take.name,
        "manifest": f"raw/{take.name}/manifest.ndjson",
        "tolerance_s": TOLERANCE_S,
        "bound": bound,
        "unbound": unbound,
        "redacted": redacted,
        "not_in_manifest": extras,
    }
    dest = ROOT / "data/labels/derived" / f"{take.name}-frames.json"
    dest.write_text(json.dumps(out, indent=2) + "\n")
    print(f"{len(bound)} bound, {len(unbound)} unbound, {len(redacted)} redacted, {len(extras)} not in manifest → {dest.relative_to(ROOT)}")
    return 0 if not unbound else 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
