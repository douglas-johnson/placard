"""The create-only rules, against moto's S3 and the in-memory index.

moto stands in for B2's S3 API. It does not check presigned signatures, so a
phone's PUT is simulated with put_object, and whether B2 enforces a signed
Content-MD5 is a live check (D43), not something these tests can show.
"""
import base64
import hashlib
import json

import boto3
import pytest
from fastapi.testclient import TestClient
from moto import mock_aws

from app import create_app
from bucket import Bucket
from store import MemoryStore

TOKEN = "t0ken"
C = "abcdefgh23456789"
TAKE = "2026-09-27-the-met"
AUTH = {"Authorization": f"Bearer {TOKEN}", "X-Placard-Contributor": C}


def md5(b: bytes) -> str:
    return base64.b64encode(hashlib.md5(b).digest()).decode()


@pytest.fixture
def env():
    with mock_aws():
        s3 = boto3.client("s3", region_name="us-east-1")
        s3.create_bucket(Bucket="placard-raw")
        s3.put_bucket_versioning(Bucket="placard-raw", VersioningConfiguration={"Status": "Enabled"})
        store = MemoryStore()
        app = create_app(store, Bucket("", "", "", "placard-raw", client=s3), [TOKEN])
        yield TestClient(app), s3, store


def versions(s3, key):
    r = s3.list_object_versions(Bucket="placard-raw", Prefix=key)
    return [v for v in r.get("Versions", []) if v["Key"] == key]


def claim(client, body=b"jpeg-bytes", frame="f0001", file="f0001-label.jpg"):
    return client.post(
        "/v1/frames",
        headers=AUTH,
        json={"take": TAKE, "frame": frame, "file": file, "bytes": len(body), "md5": md5(body)},
    )


def test_needs_token_and_contributor(env):
    client, _, _ = env
    assert client.post("/v1/frames", json={}).status_code == 401
    bad = {**AUTH, "X-Placard-Contributor": "Doug!"}
    r = client.post("/v1/frames", headers=bad, json={"take": TAKE, "frame": "f0001", "file": "f0001-label.jpg", "bytes": 1, "md5": md5(b"x")})
    assert r.status_code == 400


def test_rejects_names_outside_the_convention(env):
    client, _, _ = env
    assert claim(client, frame="f0001", file="f0002-label.jpg").status_code == 400
    assert claim(client, frame="f0001", file="../f0001-label.jpg").status_code == 400
    r = client.post("/v1/frames", headers=AUTH, json={"take": "../x", "frame": "f0001", "file": "f0001-label.jpg", "bytes": 1, "md5": md5(b"x")})
    assert r.status_code == 400


def test_signs_with_the_declared_md5_and_retries_are_idempotent(env):
    client, _, _ = env
    first = claim(client).json()
    assert first["status"] == "upload"
    assert first["headers"] == {"Content-Type": "image/jpeg", "Content-MD5": md5(b"jpeg-bytes")}
    assert f"raw/{C}/{TAKE}/f0001-label.jpg" in first["url"]
    # The phone retries after a dropped connection: same content, signed again.
    assert claim(client).json()["status"] == "upload"


def test_different_content_for_an_allocated_frame_is_a_conflict(env):
    client, _, _ = env
    claim(client)
    assert claim(client, body=b"other-bytes").status_code == 409


def test_complete_confirms_what_landed(env):
    client, s3, _ = env
    claim(client)
    ref = {"take": TAKE, "frame": "f0001"}
    assert client.post("/v1/frames/complete", headers=AUTH, json=ref).json() == {"status": "missing"}
    s3.put_object(Bucket="placard-raw", Key=f"raw/{C}/{TAKE}/f0001-label.jpg", Body=b"jpeg-bytes")
    assert client.post("/v1/frames/complete", headers=AUTH, json=ref).json() == {"status": "stored"}
    assert claim(client).json() == {"status": "stored"}


def test_a_landed_put_whose_confirmation_was_lost_is_recognised(env):
    client, s3, _ = env
    claim(client)
    s3.put_object(Bucket="placard-raw", Key=f"raw/{C}/{TAKE}/f0001-label.jpg", Body=b"jpeg-bytes")
    assert claim(client).json() == {"status": "stored"}


def test_never_signs_over_different_content_already_in_the_bucket(env):
    client, s3, _ = env
    # e.g. the index was lost and rebuilt, and a different phone bug reuses the name
    s3.put_object(Bucket="placard-raw", Key=f"raw/{C}/{TAKE}/f0001-label.jpg", Body=b"somebody-else")
    r = claim(client)
    assert r.status_code == 409
    assert "url" not in r.json()


def test_complete_refuses_a_mismatched_object(env):
    client, s3, _ = env
    claim(client)
    s3.put_object(Bucket="placard-raw", Key=f"raw/{C}/{TAKE}/f0001-label.jpg", Body=b"truncated")
    assert client.post("/v1/frames/complete", headers=AUTH, json={"take": TAKE, "frame": "f0001"}).status_code == 409


def rec(seq, type_="group_opened", take=TAKE, **extra):
    return json.dumps({"v": 1, "ts": "2026-09-27T14:00:00.000Z", "take": take, "seq": seq, "type": type_, **extra})


def test_records_become_one_object_each_with_the_devices_bytes(env):
    client, s3, _ = env
    lines = [rec(1, "take_started"), rec(2, "group_opened", group="g0001")]
    r = client.post("/v1/records", headers=AUTH, json={"take": TAKE, "lines": lines}).json()
    assert r == {"stored": [1, 2], "conflicts": [], "rejected": []}
    key = f"raw/{C}/{TAKE}/records/000002-group_opened.json"
    body = s3.get_object(Bucket="placard-raw", Key=key)["Body"].read()
    assert body == lines[1].encode()


def test_record_retries_write_nothing_new(env):
    client, s3, _ = env
    lines = [rec(1, "take_started")]
    client.post("/v1/records", headers=AUTH, json={"take": TAKE, "lines": lines})
    r = client.post("/v1/records", headers=AUTH, json={"take": TAKE, "lines": lines}).json()
    assert r["stored"] == [1]
    assert len(versions(s3, f"raw/{C}/{TAKE}/records/000001-take_started.json")) == 1


def test_a_changed_record_is_a_conflict_and_is_not_written(env):
    client, s3, _ = env
    client.post("/v1/records", headers=AUTH, json={"take": TAKE, "lines": [rec(1, "take_started")]})
    changed = rec(1, "take_started", note="edited")
    r = client.post("/v1/records", headers=AUTH, json={"take": TAKE, "lines": [changed]}).json()
    assert r["conflicts"] == [1]
    assert len(versions(s3, f"raw/{C}/{TAKE}/records/000001-take_started.json")) == 1


def test_bad_records_are_rejected_individually(env):
    client, _, _ = env
    lines = ["{torn", rec(1, "take_started", take="2026-09-27-elsewhere"), rec(0), rec(2)]
    r = client.post("/v1/records", headers=AUTH, json={"take": TAKE, "lines": lines}).json()
    assert r["stored"] == [2]
    assert [x["index"] for x in r["rejected"]] == [0, 1, 2]


def test_take_is_complete_when_observed_matches_claimed(env):
    client, s3, _ = env
    body = b"jpeg-bytes"
    claim(client, body=body)
    lines = [
        rec(1, "take_started"),
        rec(2, "frame", frame="f0001", file="f0001-label.jpg"),
        rec(3, "take_ended", counts={"frames": 1}),
    ]
    client.post("/v1/records", headers=AUTH, json={"take": TAKE, "lines": lines[:2]})
    assert client.get(f"/v1/takes/{TAKE}", headers=AUTH).json()["complete"] is False
    client.post("/v1/records", headers=AUTH, json={"take": TAKE, "lines": lines[2:]})
    assert client.get(f"/v1/takes/{TAKE}", headers=AUTH).json()["complete"] is False  # frame not stored yet
    s3.put_object(Bucket="placard-raw", Key=f"raw/{C}/{TAKE}/f0001-label.jpg", Body=body)
    client.post("/v1/frames/complete", headers=AUTH, json={"take": TAKE, "frame": "f0001"})
    status = client.get(f"/v1/takes/{TAKE}", headers=AUTH).json()
    assert status["complete"] is True and status["missing_seqs"] == []


def test_contributors_are_separate_namespaces(env):
    client, _, _ = env
    claim(client)
    other = {**AUTH, "X-Placard-Contributor": "zzzzzzzzzzzzzzzz"}
    r = client.post("/v1/frames", headers=other, json={"take": TAKE, "frame": "f0001", "file": "f0001-label.jpg", "bytes": 5, "md5": md5(b"other")})
    assert r.json()["status"] == "upload"
    assert "raw/zzzzzzzzzzzzzzzz/" in r.json()["url"]
