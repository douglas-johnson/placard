"""The corpus index: Postgres in production, a dict in tests.

Both implement the same claim-then-mark shape. A claim either creates the row or
returns the one already there, and the caller decides what an existing row means:
the same content is a retry, while different content is a conflict that must never
be signed (D35).
"""
from __future__ import annotations

import json
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol


@dataclass(frozen=True)
class FrameRow:
    file: str
    bytes: int
    md5: str
    stored: bool


@dataclass(frozen=True)
class RecordRow:
    type: str
    sha256: str
    stored: bool


@dataclass(frozen=True)
class TakeStatus:
    records: int
    max_seq: int | None
    missing_seqs: list[int]
    ended_seq: int | None
    frames_claimed: int | None
    frames_allocated: int
    frames_stored: int

    @property
    def complete(self) -> bool:
        # A claim about what should exist, checked against what does (D38). No
        # take_ended, no completeness: the tester may still be in the gallery.
        return (
            self.ended_seq is not None
            and not self.missing_seqs
            and self.max_seq == self.ended_seq
            and self.frames_claimed is not None
            and self.frames_stored >= self.frames_claimed
            and self.frames_stored == self.frames_allocated
        )


class Store(Protocol):
    def claim_frame(self, c: str, take: str, frame: str, file: str, size: int, md5: str) -> tuple[FrameRow, bool]: ...
    def mark_frame_stored(self, c: str, take: str, frame: str) -> None: ...
    def get_frame(self, c: str, take: str, frame: str) -> FrameRow | None: ...
    def claim_record(self, c: str, take: str, seq: int, type: str, sha256: str, body: dict) -> tuple[RecordRow, bool]: ...
    def mark_record_stored(self, c: str, take: str, seq: int) -> None: ...
    def take_status(self, c: str, take: str) -> TakeStatus: ...


def _status(seqs: list[int], ended: dict | None, allocated: int, stored: int) -> TakeStatus:
    seqs = sorted(seqs)
    top = seqs[-1] if seqs else None
    have = set(seqs)
    missing = [s for s in range(1, (top or 0) + 1) if s not in have]
    claimed = None
    if ended is not None:
        counts = ended.get("counts")
        if isinstance(counts, dict) and isinstance(counts.get("frames"), int):
            claimed = counts["frames"]
    return TakeStatus(
        records=len(seqs),
        max_seq=top,
        missing_seqs=missing,
        ended_seq=ended["seq"] if ended is not None else None,
        frames_claimed=claimed,
        frames_allocated=allocated,
        frames_stored=stored,
    )


class MemoryStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.frames: dict[tuple[str, str, str], FrameRow] = {}
        self.records: dict[tuple[str, str, int], tuple[RecordRow, dict]] = {}

    def claim_frame(self, c, take, frame, file, size, md5):
        with self._lock:
            key = (c, take, frame)
            if key in self.frames:
                return self.frames[key], False
            row = FrameRow(file=file, bytes=size, md5=md5, stored=False)
            self.frames[key] = row
            return row, True

    def mark_frame_stored(self, c, take, frame):
        with self._lock:
            row = self.frames[(c, take, frame)]
            self.frames[(c, take, frame)] = FrameRow(row.file, row.bytes, row.md5, True)

    def get_frame(self, c, take, frame):
        return self.frames.get((c, take, frame))

    def claim_record(self, c, take, seq, type, sha256, body):
        with self._lock:
            key = (c, take, seq)
            if key in self.records:
                return self.records[key][0], False
            row = RecordRow(type=type, sha256=sha256, stored=False)
            self.records[key] = (row, body)
            return row, True

    def mark_record_stored(self, c, take, seq):
        with self._lock:
            row, body = self.records[(c, take, seq)]
            self.records[(c, take, seq)] = (RecordRow(row.type, row.sha256, True), body)

    def take_status(self, c, take):
        mine = {k[2]: v for k, v in self.records.items() if k[:2] == (c, take)}
        ended = next((body for row, body in mine.values() if row.type == "take_ended"), None)
        frames = [v for k, v in self.frames.items() if k[:2] == (c, take)]
        return _status(list(mine), ended, len(frames), sum(f.stored for f in frames))


class PgStore:
    def __init__(self, url: str) -> None:
        from psycopg_pool import ConnectionPool

        self.pool = ConnectionPool(url, min_size=1, max_size=4, open=True)
        with self.pool.connection() as conn:
            conn.execute((Path(__file__).with_name("schema.sql")).read_text())

    def claim_frame(self, c, take, frame, file, size, md5):
        with self.pool.connection() as conn:
            created = conn.execute(
                """INSERT INTO corpus.frames (contributor, take, frame, file, bytes, md5)
                   VALUES (%s, %s, %s, %s, %s, %s)
                   ON CONFLICT DO NOTHING RETURNING 1""",
                (c, take, frame, file, size, md5),
            ).fetchone() is not None
            row = conn.execute(
                "SELECT file, bytes, md5, stored_at IS NOT NULL FROM corpus.frames WHERE contributor=%s AND take=%s AND frame=%s",
                (c, take, frame),
            ).fetchone()
        return FrameRow(*row), created

    def mark_frame_stored(self, c, take, frame):
        with self.pool.connection() as conn:
            conn.execute(
                "UPDATE corpus.frames SET stored_at = now() WHERE contributor=%s AND take=%s AND frame=%s AND stored_at IS NULL",
                (c, take, frame),
            )

    def get_frame(self, c, take, frame):
        with self.pool.connection() as conn:
            row = conn.execute(
                "SELECT file, bytes, md5, stored_at IS NOT NULL FROM corpus.frames WHERE contributor=%s AND take=%s AND frame=%s",
                (c, take, frame),
            ).fetchone()
        return FrameRow(*row) if row else None

    def claim_record(self, c, take, seq, type, sha256, body):
        with self.pool.connection() as conn:
            created = conn.execute(
                """INSERT INTO corpus.records (contributor, take, seq, type, sha256, body)
                   VALUES (%s, %s, %s, %s, %s, %s)
                   ON CONFLICT DO NOTHING RETURNING 1""",
                (c, take, seq, type, sha256, json.dumps(body)),
            ).fetchone() is not None
            row = conn.execute(
                "SELECT type, sha256, stored_at IS NOT NULL FROM corpus.records WHERE contributor=%s AND take=%s AND seq=%s",
                (c, take, seq),
            ).fetchone()
        return RecordRow(*row), created

    def mark_record_stored(self, c, take, seq):
        with self.pool.connection() as conn:
            conn.execute(
                "UPDATE corpus.records SET stored_at = now() WHERE contributor=%s AND take=%s AND seq=%s AND stored_at IS NULL",
                (c, take, seq),
            )

    def take_status(self, c, take):
        with self.pool.connection() as conn:
            seqs = [r[0] for r in conn.execute(
                "SELECT seq FROM corpus.records WHERE contributor=%s AND take=%s", (c, take)
            ).fetchall()]
            ended = conn.execute(
                "SELECT body FROM corpus.records WHERE contributor=%s AND take=%s AND type='take_ended' ORDER BY seq DESC LIMIT 1",
                (c, take),
            ).fetchone()
            allocated, stored = conn.execute(
                "SELECT count(*), count(stored_at) FROM corpus.frames WHERE contributor=%s AND take=%s", (c, take)
            ).fetchone()
        return _status(seqs, ended[0] if ended else None, allocated, stored)
