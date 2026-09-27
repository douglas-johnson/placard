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
    that read it (D38: the OCR text is its own object), plus any --record given. For a
    label or accession crop, also the group's `accession` record, whose reading and
    candidates the locator took from that OCR (D41).
 3. Deletes each version by ID, re-lists, and fails if anything survives. The
    accession record is then written back once, without reading and candidates; the
    tester's status and value stay, as they do on the phone.
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
# that writes derived/ must flip this and add its purge here. Until then run() refuses
# before minting a key: a redaction that ignored the bucket would claim a completeness
# it had not checked, and one that failed after deleting would leave no audit line.
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


def _latest(k: B2, bucket_id: str, name: str) -> dict | None:
    """The newest upload version of a record, parsed; None if it has none."""
    for v in k.versions(bucket_id, name):
        if v["fileName"] == name and v.get("action") == "upload":
            try:
                return json.loads(k.download_by_id(v["fileId"]))
            except ValueError:
                raise Failed(f"cannot parse {name} ({v['fileId']}); refusing to guess what it holds") from None
    return None


def _record_names(k: B2, bucket_id: str, prefix: str, suffix: str) -> list[str]:
    return sorted({v["fileName"] for v in k.versions(bucket_id, f"{prefix}records/") if v["fileName"].endswith(suffix)})


def targets(k: B2, bucket_id: str, prefix: str, frames: list[str], seqs: list[int]):
    """Every version to destroy, grouped by name; the records to write back scrubbed
    once they are destroyed; what kinds were removed; and the frames' groups."""
    found: dict[str, list[dict]] = {}
    rewrites: dict[str, bytes] = {}
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
    for name in _record_names(k, bucket_id, prefix, "-ocr.json"):
        for v in k.versions(bucket_id, name):
            if v["fileName"] != name or v.get("action") != "upload":
                continue
            try:
                rec = json.loads(k.download_by_id(v["fileId"]))
            except ValueError:
                raise Failed(f"cannot parse {name} ({v['fileId']}); refusing to guess whether it names the frame") from None
            if rec.get("frame") in frames:
                add(name)
                if "ocr" not in removed:
                    removed.append("ocr")
                break

    # The group's accession record carries the locator's reading and candidates, read
    # from a label's (or accession crop's) OCR — text from the photo, as D41 found on the
    # phone. A bucket object can't be edited, so every version is destroyed and the
    # record is written back without them. The tester's status and value stay, as on
    # the phone. The frame's own record says its kind and group.
    groups: dict[str, str] = {}
    for name in _record_names(k, bucket_id, prefix, "-frame.json"):
        rec = _latest(k, bucket_id, name)
        if rec and rec.get("frame") in frames and rec.get("kind") in ("label", "accession_crop") and rec.get("group"):
            groups[rec["frame"]] = rec["group"]
    if groups:
        for name in _record_names(k, bucket_id, prefix, "-accession.json"):
            rec = _latest(k, bucket_id, name)
            if not rec or rec.get("group") not in groups.values():
                continue
            if rec.get("reading") is None and not rec.get("candidates"):
                continue  # nothing read from the photo in it
            add(name)
            rewrites[name] = json.dumps({**rec, "reading": None, "candidates": []}, separators=(",", ":"), ensure_ascii=False).encode()
        if rewrites:
            removed.append("accession_reading")

    before = len(found)
    for seq in seqs:
        for v in k.versions(bucket_id, f"{prefix}records/{seq:06d}-"):
            add(v["fileName"])
            rewrites.pop(v["fileName"], None)  # asked for in full: nothing comes back
    if len(found) > before:
        removed.append("record")
    return found, rewrites, removed, sorted(set(groups.values()))


def run(a: argparse.Namespace, admin: B2, mint_client=B2, root: Path = ROOT) -> int:
    if DERIVED_BUCKET_IN_USE:
        # A precondition, not a late check: failing after the deletions would leave a
        # redaction with no audit line, the one thing D36's record must never lack.
        say("FAILED: the derived bucket is in use and this tool does not purge it yet; nothing was touched")
        return 1
    prefix = f"raw/{a.contributor}/{a.take}/"
    bucket_id = admin.bucket_id()
    caps = ["listFiles", "readFiles"] + ([] if a.dry_run else ["writeFiles", "deleteFiles"])
    key = admin.call("b2_create_key", {
        "accountId": admin.account_id,
        "capabilities": caps,
        "keyName": re.sub(r"[^A-Za-z0-9-]", "-", f"redact-{a.take}")[:100],
        "validDurationInSeconds": 3600,
        "bucketIds": [bucket_id],  # v4: a list, even for one bucket
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
    found, rewrites, removed, groups = targets(k, bucket_id, prefix, a.frame, a.record)
    n = sum(len(vs) for vs in found.values())
    in_bucket = bool(k.versions(bucket_id, prefix))
    for name, vs in sorted(found.items()):
        say(f"  {name}: {len(vs)} version(s)")
    if not found:
        say(f"nothing for {', '.join(a.frame)} under {prefix}" + ("" if in_bucket else " (the take is not in the bucket)"))
    for name in sorted(rewrites):
        say(f"  {name}: written back without the locator's reading and candidates")
    if a.group and groups and a.group not in groups:
        say(f"  note: --group {a.group}, but the bucket puts {', '.join(a.frame)} in {', '.join(groups)}")
    if a.dry_run:
        say(f"dry run: {n} version(s) would be destroyed, {len(rewrites)} record(s) written back scrubbed")
        return 0

    for name, vs in found.items():
        for v in vs:
            k.call("b2_delete_file_version", {"fileName": name, "fileId": v["fileId"]})
    survivors = {name: len([v for v in k.versions(bucket_id, name) if v["fileName"] == name]) for name in found}
    if any(survivors.values()):
        raise Failed(f"versions survived deletion: {survivors}")
    if found:
        say(f"destroyed {n} version(s); re-listed, none remain")

    # Only now, with every version gone, does the scrubbed record go back: a key that
    # no longer exists, written once, under the redaction (D35's one exception).
    for name, body in sorted(rewrites.items()):
        k.upload(bucket_id, name, body, "application/json")
        back = [v for v in k.versions(bucket_id, name) if v["fileName"] == name]
        if len(back) != 1:
            raise Failed(f"{name}: expected exactly one version after writing it back, found {len(back)}")
        say(f"  wrote back {name}")

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

    line = {
        "v": 1,
        "ts": ts,
        "contributor": a.contributor,
        "take": a.take,
        "group": a.group or (groups[0] if len(groups) == 1 else None),
        "frames": a.frame,
        "reason": a.reason,
        "removed": removed,
        "kept": [s for s in a.kept.split(",") if s],
        "fixture": a.fixture,
        "versions_destroyed": n,
    }
    # One line per redaction (D36): a marked record should have a line, and a line a
    # marked record. A rerun that destroys nothing — after a failed revoke, say, which
    # exits non-zero and invites one — must not audit the same event twice. A rerun
    # that does destroy something is a new event and gets its own line.
    audit = root / "data/labels/redactions.ndjson"
    done = [json.loads(l) for l in audit.read_text().splitlines() if l.strip()] if audit.exists() else []
    audited = {f for d in done if (d.get("contributor"), d.get("take")) == (a.contributor, a.take) for f in d.get("frames", [])}
    if n == 0 and not rewrites and set(a.frame) <= audited:
        say(f"already audited in {audit.relative_to(root)}; nothing new to record")
        return 0
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
