"""ingest — the one service between a phone and placard-raw (field-beta §4, D38, D43).

It does four things: allocate a frame's key and sign a PUT for it, confirm the PUT
landed, accept manifest records and write each as its own object, and say whether a
take is complete. The app never holds a bucket credential. It holds a per-build token
and a contributor ID it made up, and that ID is the only identifier this service ever
sees (field-beta §3).

In raw/, every write here creates a key that did not exist (D35). B2 cannot enforce
that, so this service does it in series: a Postgres primary key claims the key, a HEAD
checks the bucket, and only then is anything signed or written. A key that already
holds different content is a conflict. It is reported and never overwritten.

    uvicorn app:from_env --factory --host 0.0.0.0 --port $PORT
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import logging
import os
import re

from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from bucket import Bucket, Head
from store import MemoryStore, PgStore, Store

log = logging.getLogger("ingest")

CONTRIBUTOR = re.compile(r"^[a-z0-9][a-z0-9-]{2,31}$")
# <date>-<venue-slug>[-n], the raw/ convention (take.ts). The slug can be empty: a
# venue named only in a non-Latin script slugifies to nothing.
TAKE = re.compile(r"^\d{4}-\d{2}-\d{2}-[a-z0-9-]{0,80}$")
FRAME = re.compile(r"^f\d{4,6}$")
FILE = re.compile(r"^(f\d{4,6})-[a-z_]{1,40}\.jpg$")
RECORD_TYPE = re.compile(r"^[a-z_]{1,40}$")

MAX_FRAME_BYTES = 40 * 1024 * 1024
MAX_RECORD_BYTES = 256 * 1024
MAX_RECORDS_PER_CALL = 200


def _md5_ok(b64: str) -> bool:
    try:
        return len(base64.b64decode(b64, validate=True)) == 16
    except (binascii.Error, ValueError):
        return False


def _etag_agrees(head: Head, md5_b64: str) -> bool:
    """B2 may or may not return an MD5 ETag for a simple PUT. If it looks like one,
    it has to match; if it doesn't, length is all there is to compare."""
    if re.fullmatch(r"[0-9a-f]{32}", head.etag):
        return head.etag == base64.b64decode(md5_b64).hex()
    return True


class FrameClaim(BaseModel):
    take: str
    frame: str
    file: str
    bytes: int = Field(gt=0, le=MAX_FRAME_BYTES)
    md5: str


class FrameRef(BaseModel):
    take: str
    frame: str


class RecordBatch(BaseModel):
    take: str
    # The device's NDJSON lines exactly as written, so the stored object is the
    # device's own bytes and not a re-serialisation of them.
    lines: list[str] = Field(max_length=MAX_RECORDS_PER_CALL)


def create_app(store: Store, bucket: Bucket, tokens: list[str]) -> FastAPI:
    app = FastAPI(title="placard ingest", docs_url=None, redoc_url=None, openapi_url=None)
    secrets = [t.encode() for t in tokens if t]

    def contributor(
        authorization: str = Header(default=""),
        x_placard_contributor: str = Header(default=""),
    ) -> str:
        token = authorization.removeprefix("Bearer ").encode()
        if not secrets or not any(hmac.compare_digest(token, s) for s in secrets):
            raise HTTPException(401, "unknown token")
        if not CONTRIBUTOR.match(x_placard_contributor):
            raise HTTPException(400, "bad contributor id")
        return x_placard_contributor

    def check_take(take: str) -> None:
        if not TAKE.match(take):
            raise HTTPException(400, "bad take id")

    def frame_key(c: str, take: str, file: str) -> str:
        return f"raw/{c}/{take}/{file}"

    @app.get("/healthz")
    def healthz():
        return {"ok": True}

    @app.post("/v1/frames")
    def allocate_frame(body: FrameClaim, c: str = Depends(contributor)):
        check_take(body.take)
        m = FILE.match(body.file)
        if not FRAME.match(body.frame) or not m or m.group(1) != body.frame:
            raise HTTPException(400, "bad frame or file name")
        if not _md5_ok(body.md5):
            raise HTTPException(400, "md5 must be base64 of 16 bytes")

        row, created = store.claim_frame(c, body.take, body.frame, body.file, body.bytes, body.md5)
        if not created and (row.file, row.bytes, row.md5) != (body.file, body.bytes, body.md5):
            log.warning("frame conflict %s/%s/%s", c, body.take, body.frame)
            raise HTTPException(409, "this frame was already allocated with different content")
        if row.stored:
            return {"status": "stored"}

        key = frame_key(c, body.take, body.file)
        head = bucket.head(key)
        if head is not None:
            # An earlier PUT landed and its confirmation didn't. Same content: done.
            # Anything else is exactly what D35 says must never be signed over.
            if head.bytes == body.bytes and _etag_agrees(head, body.md5):
                store.mark_frame_stored(c, body.take, body.frame)
                return {"status": "stored"}
            log.warning("object conflict at %s", key)
            raise HTTPException(409, "the bucket already holds different content at this key")

        url, headers = bucket.presign_put(key, "image/jpeg", body.md5)
        return {"status": "upload", "url": url, "headers": headers}

    @app.post("/v1/frames/complete")
    def complete_frame(body: FrameRef, c: str = Depends(contributor)):
        check_take(body.take)
        row = store.get_frame(c, body.take, body.frame)
        if row is None:
            raise HTTPException(404, "frame was never allocated")
        if row.stored:
            return {"status": "stored"}
        head = bucket.head(frame_key(c, body.take, row.file))
        if head is None:
            return {"status": "missing"}
        if head.bytes != row.bytes or not _etag_agrees(head, row.md5):
            log.warning(
                "stored object disagrees with its claim: %s/%s/%s", c, body.take, body.frame
            )
            raise HTTPException(409, "the stored object does not match what was declared")
        store.mark_frame_stored(c, body.take, body.frame)
        return {"status": "stored"}

    @app.post("/v1/records")
    def put_records(body: RecordBatch, c: str = Depends(contributor)):
        check_take(body.take)
        stored: list[int] = []
        conflicts: list[int] = []
        rejected: list[dict] = []
        for i, line in enumerate(body.lines):
            raw = line.rstrip("\n").encode()
            try:
                if len(raw) > MAX_RECORD_BYTES:
                    raise ValueError("record too large")
                r = json.loads(raw)
                if not isinstance(r, dict):
                    raise ValueError("not an object")
                seq, type_ = r.get("seq"), r.get("type")
                if not isinstance(seq, int) or isinstance(seq, bool) or seq < 1:
                    raise ValueError("seq must be a positive integer")
                if not isinstance(type_, str) or not RECORD_TYPE.match(type_):
                    raise ValueError("bad type")
                if r.get("take") != body.take:
                    raise ValueError("record belongs to another take")
            except ValueError as e:  # json.JSONDecodeError is a ValueError
                rejected.append({"index": i, "reason": str(e)})
                continue

            sha = hashlib.sha256(raw).hexdigest()
            row, created = store.claim_record(c, body.take, seq, type_, sha, r)
            if not created and row.sha256 != sha:
                log.warning("record conflict %s/%s seq %d", c, body.take, seq)
                conflicts.append(seq)
                continue
            if not row.stored:
                key = f"raw/{c}/{body.take}/records/{seq:06d}-{type_}.json"
                md5 = base64.b64encode(hashlib.md5(raw).digest()).decode()
                head = bucket.head(key)
                if head is None:
                    bucket.put_record(key, raw, md5)
                elif head.bytes != len(raw) or not _etag_agrees(head, md5):
                    log.warning("object conflict at %s", key)
                    conflicts.append(seq)
                    continue
                store.mark_record_stored(c, body.take, seq)
            stored.append(seq)
        return {"stored": stored, "conflicts": conflicts, "rejected": rejected}

    @app.get("/v1/takes/{take}")
    def take_status(take: str, c: str = Depends(contributor)):
        check_take(take)
        s = store.take_status(c, take)
        return {
            "records": s.records,
            "max_seq": s.max_seq,
            "missing_seqs": s.missing_seqs[:100],
            "ended_seq": s.ended_seq,
            "frames_claimed": s.frames_claimed,
            "frames_allocated": s.frames_allocated,
            "frames_stored": s.frames_stored,
            "complete": s.complete,
        }

    return app


def from_env() -> FastAPI:
    logging.basicConfig(level=logging.INFO)
    env = os.environ
    bucket = Bucket(env["B2_ENDPOINT"], env["B2_KEY_ID"], env["B2_KEY"], env["B2_BUCKET"])
    # Without Postgres, allocation is no longer create-only across restarts (D35), so
    # the in-memory index has to be asked for by name. It is for local runs only.
    url = env.get("DATABASE_URL")
    if url:
        store: Store = PgStore(url)
    elif env.get("INGEST_MEMORY_INDEX") == "1":
        log.warning("INGEST_MEMORY_INDEX=1: in-memory index, local runs only")
        store = MemoryStore()
    else:
        raise RuntimeError("DATABASE_URL is required (set INGEST_MEMORY_INDEX=1 for a local run)")
    tokens = [t.strip() for t in env.get("UPLOAD_TOKENS", "").split(",")]
    return create_app(store, bucket, tokens)
