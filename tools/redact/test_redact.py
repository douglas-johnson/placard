"""redact.py against a fake B2 that keeps versions and hide markers the way B2 does.

    python3 -m unittest tools/redact/test_redact.py
"""
import itertools
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import redact  # noqa: E402

C, TAKE = "abcdefgh23456789", "2026-09-20-met"
P = f"raw/{C}/{TAKE}/"


class FakeB2:
    """One shared bucket. The admin and the minted key are two views of it."""

    def __init__(self, files=None, keys=None, broken_delete=False, broken_revoke=False):
        self.files = files if files is not None else []
        self.keys = keys if keys is not None else {}
        self.ids = itertools.count(1)
        self.account_id = "acct"
        self.broken_delete = broken_delete
        self.broken_revoke = broken_revoke
        self.minted_caps = None

    # admin surface
    def bucket_id(self, name="placard-raw"):
        return "bkt"

    def call(self, name, payload):
        if name == "b2_create_key":
            self.minted_caps = payload["capabilities"]
            kid = f"key{next(self.ids)}"
            self.keys[kid] = payload
            return {"applicationKeyId": kid, "applicationKey": "secret"}
        if name == "b2_delete_key":
            if not self.broken_revoke:
                self.keys.pop(payload["applicationKeyId"], None)
            return {}
        if name == "b2_list_keys":
            return {"keys": [{"applicationKeyId": k} for k in self.keys]}
        if name == "b2_delete_file_version":
            if not self.broken_delete:
                self.files[:] = [f for f in self.files if f["fileId"] != payload["fileId"]]
            return {}
        raise AssertionError(name)

    # minted-key surface
    def versions(self, bucket_id, prefix):
        return sorted((f for f in self.files if f["fileName"].startswith(prefix)), key=lambda f: f["fileName"])

    def download_by_id(self, file_id):
        return next(f["data"] for f in self.files if f["fileId"] == file_id)

    def upload(self, bucket_id, name, data, content_type):
        self.put(name, data)

    def put(self, name, data=b"", action="upload"):
        self.files.append({"fileName": name, "fileId": f"id{next(self.ids)}", "action": action, "data": data})


def ocr(seq, frame):
    return json.dumps({"v": 1, "take": TAKE, "seq": seq, "type": "ocr", "frame": frame, "lines": [{"text": "a child's name"}]}).encode()


def rec(seq, type_, **kw):
    return json.dumps({"v": 1, "take": TAKE, "seq": seq, "type": type_, **kw}, separators=(",", ":")).encode()


def args(*extra):
    return redact.parse(["--contributor", C, "--take", TAKE, "--frame", "f0035", "--reason", "minor",
                         "--group", "g0014", "--kept", "work,exhibition_wall_text", "--fixture", "met-ps-art-2026-redacted", *extra])


class RedactTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / "data/labels").mkdir(parents=True)

    def tearDown(self):
        self.tmp.cleanup()

    def audit(self):
        f = self.root / "data/labels/redactions.ndjson"
        return [json.loads(l) for l in f.read_text().splitlines()] if f.exists() else []

    def bucket_with_take(self):
        b2 = FakeB2()
        b2.put(P + "records/000001-take_started.json", b"{}")
        b2.put(P + "f0034-work.jpg", b"work")
        b2.put(P + "f0035-label.jpg", b"label v1")
        b2.put(P + "f0035-label.jpg", b"label v2")  # a shadowing PUT (D35)
        b2.put(P + "f0035-label.jpg", action="hide")  # a plain delete: soft
        b2.put(P + "records/000040-ocr.json", ocr(40, "f0035"))
        b2.put(P + "records/000041-ocr.json", ocr(41, "f0036"))
        b2.put(P + "records/000045-group_closed.json", b'{"note":"named the child"}')
        b2.put(P + "records/000039-frame.json", rec(39, "frame", frame="f0035", file="f0035-label.jpg", kind="label", group="g0014"))
        b2.put(P + "records/000038-frame.json", rec(38, "frame", frame="f0034", file="f0034-work.jpg", kind="work", group="g0014"))
        b2.put(P + "records/000042-accession.json",
               rec(42, "accession", group="g0014", status="corrected", reading="A CHILD 4", value="2026.7", candidates=["A CHILD 4"]))
        return b2

    def body(self, b2, name):
        [v] = [f for f in b2.files if f["fileName"] == P + name]
        return json.loads(v["data"])

    def test_destroys_every_version_and_the_ocr_that_read_it(self):
        b2 = self.bucket_with_take()
        mirror = self.root / "data/labels" / P
        mirror.mkdir(parents=True)
        (mirror / "f0035-label.jpg").write_bytes(b"label v2")
        derived = self.root / "data/labels/derived" / C / TAKE
        derived.mkdir(parents=True)
        (derived / "manifest.ndjson").write_text("{}")

        self.assertEqual(redact.run(args("--record", "45"), b2, lambda *_: b2, self.root), 0)

        names = {f["fileName"] for f in b2.files}
        self.assertNotIn(P + "f0035-label.jpg", names)
        self.assertNotIn(P + "records/000040-ocr.json", names)
        self.assertNotIn(P + "records/000045-group_closed.json", names)
        self.assertIn(P + "f0034-work.jpg", names)
        self.assertIn(P + "records/000041-ocr.json", names)  # read a different frame
        marker = json.loads(next(f["data"] for f in b2.files if f["fileName"] == P + "records/redacted-f0035.json"))
        self.assertEqual(marker["removed"], ["frame", "ocr", "accession_reading", "record"])
        self.assertFalse((mirror / "f0035-label.jpg").exists())
        self.assertFalse(derived.exists())
        [line] = self.audit()
        self.assertEqual(line["versions_destroyed"], 6)
        self.assertEqual(line["kept"], ["work", "exhibition_wall_text"])
        self.assertNotIn("child", json.dumps(line))  # nothing redacted reaches the audit line
        self.assertEqual(b2.keys, {})  # revoked
        self.assertIn("deleteFiles", b2.minted_caps)

    def test_a_label_takes_the_groups_accession_readings_with_it(self):
        b2 = self.bucket_with_take()
        self.assertEqual(redact.run(redact.parse(["--contributor", C, "--take", TAKE, "--frame", "f0035", "--reason", "minor"]),
                                    b2, lambda *_: b2, self.root), 0)
        acc = self.body(b2, "records/000042-accession.json")  # exactly one version: the scrubbed one
        self.assertEqual((acc["reading"], acc["candidates"]), (None, []))
        self.assertEqual((acc["status"], acc["value"]), ("corrected", "2026.7"))  # the tester's answer stays
        self.assertNotIn(b"A CHILD", b"".join(f["data"] for f in b2.files))
        self.assertEqual(self.audit()[0]["group"], "g0014")  # from the bucket, --group not given

    def test_a_work_frame_leaves_the_accession_alone(self):
        b2 = self.bucket_with_take()
        before = [f for f in b2.files if "accession" in f["fileName"]]
        redact.run(redact.parse(["--contributor", C, "--take", TAKE, "--frame", "f0034", "--reason", "minor"]), b2, lambda *_: b2, self.root)
        self.assertEqual([f for f in b2.files if "accession" in f["fileName"]], before)

    def test_an_accession_record_asked_for_by_seq_is_not_written_back(self):
        b2 = self.bucket_with_take()
        redact.run(args("--record", "42"), b2, lambda *_: b2, self.root)
        self.assertFalse(any(f["fileName"].endswith("000042-accession.json") for f in b2.files))

    def test_refuses_before_touching_anything_if_the_derived_bucket_is_in_use(self):
        b2 = self.bucket_with_take()
        before = list(b2.files)
        redact.DERIVED_BUCKET_IN_USE = True
        try:
            self.assertEqual(redact.run(args(), b2, lambda *_: b2, self.root), 1)
        finally:
            redact.DERIVED_BUCKET_IN_USE = False
        self.assertEqual(b2.files, before)
        self.assertIsNone(b2.minted_caps)  # no key was minted
        self.assertEqual(self.audit(), [])

    def test_a_take_not_in_the_bucket_is_nothing_to_do_but_still_audited(self):
        # The Met case: the frame was deleted on the Mac before any upload existed.
        b2 = FakeB2()
        self.assertEqual(redact.run(args(), b2, lambda *_: b2, self.root), 0)
        self.assertEqual(b2.files, [])  # no marker for a take that isn't there
        [line] = self.audit()
        self.assertEqual((line["versions_destroyed"], line["removed"]), (0, []))
        self.assertEqual(b2.keys, {})

    def test_a_surviving_version_fails_and_writes_no_audit_line(self):
        b2 = self.bucket_with_take()
        b2.broken_delete = True
        self.assertEqual(redact.run(args(), b2, lambda *_: b2, self.root), 1)
        self.assertEqual(self.audit(), [])
        self.assertEqual(b2.keys, {})  # revoked even on failure

    def test_dry_run_destroys_nothing_and_cannot(self):
        b2 = self.bucket_with_take()
        before = list(b2.files)
        self.assertEqual(redact.run(args("--dry-run"), b2, lambda *_: b2, self.root), 0)
        self.assertEqual(b2.files, before)
        self.assertNotIn("deleteFiles", b2.minted_caps)
        self.assertEqual(self.audit(), [])

    def test_a_key_that_will_not_revoke_is_a_failure(self):
        b2 = self.bucket_with_take()
        b2.broken_revoke = True
        self.assertEqual(redact.run(args(), b2, lambda *_: b2, self.root), 1)

    def test_rerunning_does_not_duplicate_the_marker(self):
        b2 = self.bucket_with_take()
        redact.run(args(), b2, lambda *_: b2, self.root)
        redact.run(args(), b2, lambda *_: b2, self.root)
        self.assertEqual(sum(f["fileName"].endswith("redacted-f0035.json") for f in b2.files), 1)

    def test_a_rerun_that_destroys_nothing_does_not_audit_again(self):
        b2 = self.bucket_with_take()
        self.assertEqual(redact.run(args(), b2, lambda *_: b2, self.root), 0)
        self.assertEqual(redact.run(args(), b2, lambda *_: b2, self.root), 0)
        self.assertEqual(len(self.audit()), 1)

    def test_a_rerun_after_a_failed_revoke_does_not_audit_again(self):
        b2 = self.bucket_with_take()
        b2.broken_revoke = True
        self.assertEqual(redact.run(args(), b2, lambda *_: b2, self.root), 1)  # redacted, but exits 1
        b2.broken_revoke = False
        b2.keys.clear()  # revoked by hand, as the tool told the operator to
        self.assertEqual(redact.run(args(), b2, lambda *_: b2, self.root), 0)
        self.assertEqual(len(self.audit()), 1)

    def test_the_met_case_is_audited_once(self):
        b2 = FakeB2()
        redact.run(args(), b2, lambda *_: b2, self.root)
        redact.run(args(), b2, lambda *_: b2, self.root)
        self.assertEqual(len(self.audit()), 1)

    def test_a_rerun_that_finds_something_new_is_a_new_line(self):
        b2 = self.bucket_with_take()
        redact.run(args(), b2, lambda *_: b2, self.root)
        b2.put(P + "f0035-label.jpg", b"reappeared")  # e.g. a late retry from a phone
        redact.run(args(), b2, lambda *_: b2, self.root)
        lines = self.audit()
        self.assertEqual([l["versions_destroyed"] for l in lines], [5, 1])

    def test_refuses_names_outside_the_convention(self):
        with self.assertRaises(SystemExit):
            redact.parse(["--contributor", C, "--take", "../etc", "--frame", "f0035", "--reason", "minor"])


if __name__ == "__main__":
    unittest.main()
