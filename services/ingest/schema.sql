-- The corpus index (D43). An index over placard-raw, not the truth: the bucket is
-- canonical, and losing this database is repaired by re-ingesting from it (D38).
--
-- Its own schema, apart from db/README.md's private/canon/published, because a
-- contributed frame is neither a learner's private material nor a claim
-- (field-beta §8.1). Applied at startup; every statement is idempotent.

CREATE SCHEMA IF NOT EXISTS corpus;

-- One row per frame key, inserted BEFORE a PUT is signed. The primary key is what
-- makes allocation create-only, standing in for the conditional write B2 lacks (D35).
CREATE TABLE IF NOT EXISTS corpus.frames (
    contributor  text        NOT NULL,
    take         text        NOT NULL,
    frame        text        NOT NULL,
    file         text        NOT NULL,
    bytes        bigint      NOT NULL,
    md5          text        NOT NULL,   -- base64, as sent in Content-MD5
    allocated_at timestamptz NOT NULL DEFAULT now(),
    stored_at    timestamptz,            -- set once the object is seen in the bucket
    PRIMARY KEY (contributor, take, frame)
);

-- One row per manifest record, which becomes one object under records/ (D38).
CREATE TABLE IF NOT EXISTS corpus.records (
    contributor text        NOT NULL,
    take        text        NOT NULL,
    seq         integer     NOT NULL,
    type        text        NOT NULL,
    sha256      text        NOT NULL,    -- of the exact bytes stored
    body        jsonb       NOT NULL,
    received_at timestamptz NOT NULL DEFAULT now(),
    stored_at   timestamptz,
    PRIMARY KEY (contributor, take, seq)
);
