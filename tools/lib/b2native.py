"""Backblaze B2's native API, standard library only.

The native API rather than S3 because tools/redact needs what only it offers:
minting and revoking keys (D36) and listing every version of a name. Standard library so the tools run interpreted with the system python3,
like tools/manifest, and nothing is installed from Homebrew (CLAUDE.md).
"""
from __future__ import annotations

import base64
import hashlib
import json
import urllib.error
import urllib.parse
import urllib.request

AUTH_URL = "https://api.backblazeb2.com/b2api/v2/b2_authorize_account"
RAW_BUCKET = "placard-raw"


class B2Error(Exception):
    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(f"{status} {code}: {message}")
        self.status, self.code = status, code


def _request(req: urllib.request.Request) -> bytes:
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        try:
            body = json.loads(e.read())
        except (ValueError, OSError):
            body = {}
        raise B2Error(e.code, body.get("code", "http_error"), body.get("message", str(e))) from None


class B2:
    def __init__(self, key_id: str, key: str) -> None:
        basic = base64.b64encode(f"{key_id}:{key}".encode()).decode()
        auth = json.loads(_request(urllib.request.Request(AUTH_URL, headers={"Authorization": f"Basic {basic}"})))
        self.account_id: str = auth["accountId"]
        self.token: str = auth["authorizationToken"]
        self.api_url: str = auth["apiUrl"]
        self.download_url: str = auth["downloadUrl"]
        self.allowed: dict = auth.get("allowed", {})

    def call(self, name: str, payload: dict) -> dict:
        req = urllib.request.Request(
            f"{self.api_url}/b2api/v2/{name}",
            data=json.dumps(payload).encode(),
            headers={"Authorization": self.token, "Content-Type": "application/json"},
            method="POST",
        )
        return json.loads(_request(req))

    def bucket_id(self, name: str = RAW_BUCKET) -> str:
        allowed = self.allowed.get("bucketId")
        if allowed and self.allowed.get("bucketName") == name:
            return allowed
        buckets = self.call("b2_list_buckets", {"accountId": self.account_id, "bucketName": name})["buckets"]
        if not buckets:
            raise B2Error(404, "no_bucket", name)
        return buckets[0]["bucketId"]

    def versions(self, bucket_id: str, prefix: str) -> list[dict]:
        """Every version of every name under prefix, hide markers included."""
        out, start_name, start_id = [], None, None
        while True:
            payload = {"bucketId": bucket_id, "prefix": prefix, "maxFileCount": 1000}
            if start_name:
                payload["startFileName"] = start_name
                if start_id:
                    payload["startFileId"] = start_id
            r = self.call("b2_list_file_versions", payload)
            out.extend(r["files"])
            start_name, start_id = r.get("nextFileName"), r.get("nextFileId")
            if not start_name:
                return out

    def download_by_id(self, file_id: str) -> bytes:
        q = urllib.parse.urlencode({"fileId": file_id})
        req = urllib.request.Request(f"{self.download_url}/b2api/v2/b2_download_file_by_id?{q}", headers={"Authorization": self.token})
        return _request(req)

    def upload(self, bucket_id: str, name: str, data: bytes, content_type: str) -> dict:
        target = self.call("b2_get_upload_url", {"bucketId": bucket_id})
        req = urllib.request.Request(
            target["uploadUrl"],
            data=data,
            headers={
                "Authorization": target["authorizationToken"],
                "X-Bz-File-Name": urllib.parse.quote(name, safe="/"),
                "Content-Type": content_type,
                "X-Bz-Content-Sha1": hashlib.sha1(data).hexdigest(),
            },
            method="POST",
        )
        return json.loads(_request(req))

