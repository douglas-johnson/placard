"""placard-raw, through B2's S3-compatible API.

`ingest`'s key holds listFiles, readFiles and writeFiles on raw/ and never deleteFiles
(D35, infrastructure.md §3.2). Nothing here deletes, and nothing could.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from botocore.handlers import add_expect_header


@dataclass(frozen=True)
class Head:
    bytes: int
    etag: str


class Bucket:
    def __init__(self, endpoint: str, key_id: str, key: str, name: str, client=None) -> None:
        self.name = name
        if client is None:
            m = re.search(r"s3\.([a-z0-9-]+)\.backblazeb2\.com", endpoint)
            client = boto3.client(
                "s3",
                endpoint_url=endpoint,
                region_name=m.group(1) if m else "us-east-005",
                aws_access_key_id=key_id,
                aws_secret_access_key=key,
                config=Config(
                    signature_version="s3v4", retries={"max_attempts": 3, "mode": "standard"}
                ),
            )
        # botocore sends Expect: 100-continue on uploads with a body; B2 answers with an
        # empty reason phrase and http.client then fails with BadStatusLine
        # (infrastructure.md §4). put_record is the one call here that sends a body.
        client.meta.events.unregister("before-call.s3", add_expect_header)
        self.s3 = client

    def head(self, key: str) -> Head | None:
        try:
            r = self.s3.head_object(Bucket=self.name, Key=key)
        except ClientError as e:
            if e.response.get("Error", {}).get("Code") in ("404", "NoSuchKey", "NotFound"):
                return None
            raise
        return Head(bytes=r["ContentLength"], etag=r.get("ETag", "").strip('"'))

    def presign_put(
        self, key: str, content_type: str, md5_b64: str, expires: int = 900
    ) -> tuple[str, dict[str, str]]:
        """A URL that accepts exactly one body: the one whose MD5 was declared (D43).

        Content-Type and Content-MD5 are signed, so the client must send both headers
        unchanged. The store is then asked to reject a body that doesn't match the hash.
        """
        url = self.s3.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": self.name,
                "Key": key,
                "ContentType": content_type,
                "ContentMD5": md5_b64,
            },
            ExpiresIn=expires,
        )
        return url, {"Content-Type": content_type, "Content-MD5": md5_b64}

    def put_record(self, key: str, body: bytes, md5_b64: str) -> None:
        self.s3.put_object(
            Bucket=self.name, Key=key, Body=body, ContentType="application/json", ContentMD5=md5_b64
        )
