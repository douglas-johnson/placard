#!/usr/bin/env python3
"""Remove a frame from placard-raw for good — the one edit ever made to a raw take.

D4's amendment settles *that* a frame identifying a minor is removed; D36 settles
that it is this tool; D38 made it one uniform operation. The failure it exists to
prevent is silent: you delete the object, the console shows it gone, and every prior
version is still there. So every step is checked, and the tool exits non-zero if any
step could not be verified.

    python3 tools/redact/redact.py --contributor <id> --take 2026-09-20-met \\
        --frame f0035 --reason minor --group g0014 \\
        --kept work,exhibition_wall_text --fixture met-ps-art-2026-redacted

What it does, in order:

 1. Asks for an account key that can create keys (hidden prompt, never a file) and
    mints one with deleteFiles restricted to this one take's prefix, for an hour.
 2. Finds every version of the frame's key, and every version of every `ocr` record
    that read it (D38: the OCR text is its own object), plus any --record given.
 3. Deletes each version by ID, re-lists, and fails if anything survives.
 4. Appends records/redacted-<frame>.json (D38, D42), if the take is in the bucket.
 5. Removes the frame and those records from the local mirror of the bucket
    (data/labels/raw/<contributor>/<take>/) and the take's derived/ output, which is
    regenerable by definition.
 6. Appends a line to data/labels/redactions.ndjson, carrying nothing identifying.
 7. Revokes the key, whatever happened above, and checks that it is gone.

--dry-run mints a key without deleteFiles and stops after step 2.
"""
from __future__ import annotations

import argparse
import datetime as dt
import getpass
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools/lib"))
from b2native import B2, B2Error  # noqa: E402

# Railway's derived bucket (D34). Nothing writes to it yet: every derived output so far
# is on the Mac, under data/labels/derived/, and step 5 handles those. The first worker
# that writes derived/ must flip this and add its purge here. Until then, a redaction
# that ignored it would be claiming a completeness it had not checked.
DERIVED_BUCKET_IN_USE = False

FRAME = re.compile(r"^f\d{4,6}$")
TAKE = re.compile(r"^\d{4}-\d{2}-\d{2}-[a-z0-9-]{0,80}$")
CONTRIBUTOR = re.compile(r"^[a-z0-9][a-z0-9-]{2,31}$")


class Failed(Exception):
    pass


def say(msg: str) -> None:
    print(msg, file=sys.stderr)


def parse(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--contributor", required=True)
    p.add_argument("--take", required=True)
    p.add_argument("--frame", required=True, action="append", help="repeatable")
    p.add_argument("--reason", required=True, choices=["minor"])
    p.add_argument("--group", help="the label group, for the audit line")
    p.add_argument("--record", type=int, action="append", default=[], help="also destroy this record seq (e.g. a note that named the child)")
    p.add_argument("--kept", default="", help="comma-separated: what the group keeps, for the audit line")
    p.add_argument("--fixture", help="the fixture that records the group, for the audit line")
    p.add_argument("--dry-run", action="store_true")
    a = p.parse_args(argv)
    if not CONTRIBUTOR.match(a.contributor) or not TAKE.match(a.take) or not all(FRAME.match(f) for f in a.frame):
        p.error("contributor, take or frame is not in the raw/ naming convention")
    return a


def targets(k: B2, bucket_id: str, prefix: str, frames: list[str], seqs: list[int]) -> tuple[dict[str, list[dict]], list[str]]:
    """Every version to destroy, grouped by name, and what kinds were found."""
    found: dict[str, list[dict]] = {}
    removed: list[str] = []

    def add(name: str) -> None:
        found.setdefault(name, [v for v in k.versions(bucket_id, name) if v["fileName"] == name])

    for f in frames:
        for v in k.versions(bucket_id, f"{prefix}{f}-"):
            add(v["fileName"])
    if found:
        removed.append("frame")

    # An ocr record names the frame it read. Check every version of every ocr record,
    # hidden ones included, because a hidden version still holds the text.
    ocr_names = {v["fileName"] for v in k.versions(bucket_id, f"{prefix}records/") if v["fileName"].endswith("-ocr.json")}
    for name in sorted(ocr_names):
        for v in k.versions(bucket_id, name):
            if v["fileName"] != name or v.get("action") != "upload":
                continue
            try:
                rec = json.loads(k.download_by_id(v["fileId"]))
            except ValueError:
                raise Failed(f"cannot parse {name} ({v['fileId']}); refusing to guess whether it names the frame")
            if rec.get("frame") in frames:
                add(name)
                if "ocr" not in removed:
                    removed.append("ocr")
                break

    before = len(found)
    for seq in seqs:
        for v in k.versions(bucket_id, f"{prefix}records/{seq:06d}-"):
            add(v["fileName"])
    if len(found) > before:
        removed.append("record")
    return found, removed


def run(a: argparse.Namespace, admin: B2, mint_client=B2, root: Path = ROOT) -> int:
    prefix = f"raw/{a.contributor}/{a.take}/"
    bucket_id = admin.bucket_id()
    caps = ["listFiles", "readFiles"] + ([] if a.dry_run else ["writeFiles", "deleteFiles"])
    key = admin.call("b2_create_key", {
        "accountId": admin.account_id,
        "capabilities": caps,
        "keyName": re.sub(r"[^A-Za-z0-9-]", "-", f"redact-{a.take}")[:100],
        "validDurationInSeconds": 3600,
        "bucketId": bucket_id,
        "namePrefix": prefix,
    })
    say(f"minted {key['applicationKeyId']} ({', '.join(caps)}) on {prefix} for one hour")
    status = 1
    try:
        status = _redact(a, mint_client(key["applicationKeyId"], key["applicationKey"]), bucket_id, prefix, root)
    except (Failed, B2Error) as e:
        say(f"FAILED: {e}")
        status = 1
    finally:
        try:
            admin.call("b2_delete_key", {"applicationKeyId": key["applicationKeyId"]})
            left = admin.call("b2_list_keys", {"accountId": admin.account_id, "maxKeyCount": 1000})["keys"]
            if any(k["applicationKeyId"] == key["applicationKeyId"] for k in left):
                raise Failed("key still listed after delete")
            say(f"revoked {key['applicationKeyId']}")
        except (Failed, B2Error) as e:
            say(f"FAILED TO REVOKE {key['applicationKeyId']}: {e}\n"
                f"  revoke it by hand now: b2 key delete {key['applicationKeyId']} (or the web console, App Keys)")
            status = 1
    return status


def _redact(a: argparse.Namespace, k: B2, bucket_id: str, prefix: str, root: Path) -> int:
    found, removed = targets(k, bucket_id, prefix, a.frame, a.record)
    n = sum(len(vs) for vs in found.values())
    in_bucket = bool(k.versions(bucket_id, prefix))
    for name, vs in sorted(found.items()):
        say(f"  {name}: {len(vs)} version(s)")
    if not found:
        say(f"nothing for {', '.join(a.frame)} under {prefix}" + ("" if in_bucket else " (the take is not in the bucket)"))
    if a.dry_run:
        say(f"dry run: {n} version(s) would be destroyed")
        return 0

    for name, vs in found.items():
        for v in vs:
            k.call("b2_delete_file_version", {"fileName": name, "fileId": v["fileId"]})
    survivors = {name: len([v for v in k.versions(bucket_id, name) if v["fileName"] == name]) for name in found}
    if any(survivors.values()):
        raise Failed(f"versions survived deletion: {survivors}")
    if found:
        say(f"destroyed {n} version(s); re-listed, none remain")

    ts = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    if in_bucket:
        for f in a.frame:
            marker = f"{prefix}records/redacted-{f}.json"
            if k.versions(bucket_id, marker):
                say(f"  {marker} already present")
                continue
            body = {"v": 1, "ts": ts, "type": "redacted", "take": a.take, "frame": f, "reason": a.reason, "removed": removed}
            k.upload(bucket_id, marker, json.dumps(body).encode(), "application/json")
            if not k.versions(bucket_id, marker):
                raise Failed(f"marker {marker} not visible after upload")
            say(f"  wrote {marker}")

    # The local mirror of the bucket, if one exists, and everything derived from the take.
    mirror = root / "data/labels" / prefix
    for name in found:
        local = root / "data/labels" / name
        if local.exists():
            local.unlink()
            say(f"  removed local {local.relative_to(root)}")
    derived = root / "data/labels/derived" / a.contributor / a.take
    if derived.exists():
        shutil.rmtree(derived)
        say(f"  removed {derived.relative_to(root)}; it is regenerable")
    for name in found:
        if (root / "data/labels" / name).exists():
            raise Failed(f"local copy of {name} still present")
    if not mirror.exists():
        say(f"  no local mirror at {mirror.relative_to(root)}")
    if DERIVED_BUCKET_IN_USE:
        raise Failed("the derived bucket is in use and this tool does not purge it yet")

    line = {
        "v": 1,
        "ts": ts,
        "contributor": a.contributor,
        "take": a.take,
        "group": a.group,
        "frames": a.frame,
        "reason": a.reason,
        "removed": removed,
        "kept": [s for s in a.kept.split(",") if s],
        "fixture": a.fixture,
        "versions_destroyed": n,
    }
    audit = root / "data/labels/redactions.ndjson"
    with audit.open("a") as f:
        f.write(json.dumps(line) + "\n")
    say(f"appended to {audit.relative_to(root)}; commit it")
    return 0


def main(argv: list[str]) -> int:
    a = parse(argv)
    say("An account key that can create keys (writeKeys). Typed here, never stored.")
    key_id = input("keyID: ").strip()
    key = getpass.getpass("applicationKey: ")
    return run(a, B2(key_id, key))


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
