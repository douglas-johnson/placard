"""corpus-pull.py against a fake bucket.

    python3 -m unittest tools/corpus-pull/test_corpus_pull.py
"""
import hashlib
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("corpus_pull", Path(__file__).with_name("corpus-pull.py"))
cp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cp)

C, TAKE = "abcdefgh23456789", "2026-09-27-the-met"
P = f"raw/{C}/{TAKE}/"


class FakeB2:
    def __init__(self, objects, corrupt=()):
        self.objects = objects  # name -> bytes
        self.corrupt = set(corrupt)
        self.fetched = []

    def listing(self):
        return [
            {"fileName": n, "fileId": n, "contentLength": len(b), "contentSha1": hashlib.sha1(b).hexdigest(), "action": "upload"}
            for n, b in sorted(self.objects.items())
        ]

    def download_to(self, file_id, dest):
        self.fetched.append(file_id)
        data = self.objects[file_id]
        Path(dest).write_bytes(data[:-1] if file_id in self.corrupt else data)


def rec(seq, type_, **kw):
    return json.dumps({"v": 1, "take": TAKE, "seq": seq, "type": type_, **kw})


class PullTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def objects(self, ended=True):
        o = {
            P + "records/000001-take_started.json": rec(1, "take_started").encode(),
            P + "records/000002-frame.json": rec(2, "frame", frame="f0001", file="f0001-label.jpg").encode(),
            P + "records/000003-frame.json": rec(3, "frame", frame="f0002", file="f0002-work.jpg").encode(),
            P + "f0001-label.jpg": b"label-bytes",
            P + "f0002-work.jpg": b"work-bytes",
        }
        if ended:
            o[P + "records/000004-take_ended.json"] = rec(4, "take_ended", counts={"frames": 2}).encode()
        return o

    def test_mirrors_the_bucket_and_derives_the_manifest(self):
        b2 = FakeB2(self.objects())
        self.assertEqual(cp.pull_take(b2, b2.listing(), self.root, False), [])
        self.assertEqual((self.root / "data/labels" / P / "f0001-label.jpg").read_bytes(), b"label-bytes")
        status = cp.derive(C, TAKE, self.root)
        self.assertIn("complete", status)
        out = self.root / "data/labels/derived" / C / TAKE
        seqs = [json.loads(l)["seq"] for l in (out / "manifest.ndjson").read_text().splitlines()]
        self.assertEqual(seqs, [1, 2, 3, 4])
        frames = json.loads((out / "frames.json").read_text())
        self.assertEqual(frames[0], {"key": f"{C}/{TAKE}/f0001-label.jpg", "sha256": hashlib.sha256(b"label-bytes").hexdigest(), "bytes": 11})

    def test_second_run_fetches_nothing(self):
        b2 = FakeB2(self.objects())
        cp.pull_take(b2, b2.listing(), self.root, False)
        b2.fetched.clear()
        cp.pull_take(b2, b2.listing(), self.root, False)
        self.assertEqual(b2.fetched, [])

    def test_never_overwrites_a_local_raw_file(self):
        b2 = FakeB2(self.objects())
        local = self.root / "data/labels" / P / "f0001-label.jpg"
        local.parent.mkdir(parents=True)
        local.write_bytes(b"different")
        problems = cp.pull_take(b2, b2.listing(), self.root, False)
        self.assertEqual(local.read_bytes(), b"different")
        self.assertEqual(len(problems), 1)

    def test_a_download_that_fails_its_checksum_is_not_kept(self):
        b2 = FakeB2(self.objects(), corrupt={P + "f0002-work.jpg"})
        problems = cp.pull_take(b2, b2.listing(), self.root, False)
        self.assertFalse((self.root / "data/labels" / P / "f0002-work.jpg").exists())
        self.assertFalse((self.root / "data/labels" / P / "f0002-work.jpg.part").exists())
        self.assertEqual(len(problems), 1)

    def test_an_open_take_with_a_gap_says_so(self):
        o = self.objects(ended=False)
        del o[P + "records/000002-frame.json"]
        del o[P + "f0002-work.jpg"]
        b2 = FakeB2(o)
        cp.pull_take(b2, b2.listing(), self.root, False)
        status = "; ".join(cp.derive(C, TAKE, self.root))
        self.assertIn("seq 2", status)
        self.assertIn("1 frame(s) not yet up", status)
        self.assertIn("still open", status)
        self.assertNotIn("complete", status)

    def test_redaction_markers_follow_the_records(self):
        o = self.objects()
        o[P + "records/redacted-f0001.json"] = json.dumps({"v": 1, "type": "redacted", "frame": "f0001"}).encode()
        del o[P + "f0001-label.jpg"]
        b2 = FakeB2(o)
        cp.pull_take(b2, b2.listing(), self.root, False)
        status = "; ".join(cp.derive(C, TAKE, self.root))
        self.assertIn("complete", status)  # a redacted frame is not a missing one
        self.assertIn("redacted: f0001", status)
        last = (self.root / "data/labels/derived" / C / TAKE / "manifest.ndjson").read_text().splitlines()[-1]
        self.assertEqual(json.loads(last)["type"], "redacted")


if __name__ == "__main__":
    unittest.main()
