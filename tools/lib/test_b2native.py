"""b2native against the v4 response shapes, with urlopen stubbed.

    python3 -m unittest tools/lib/test_b2native.py

The tools' own tests use fake clients, so they could not catch the first live run's
failure: the client spoke v2, and a multi-bucket key only authorizes at v4. This pins
the request version and the v4 shape of b2_authorize_account's answer.
"""

import io
import json
import sys
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))
import b2native  # noqa: E402

V4_AUTH = {
    "accountId": "acct",
    "authorizationToken": "tok",
    "applicationKeyExpirationTimestamp": None,
    "apiInfo": {
        "storageApi": {
            "apiUrl": "https://api005.backblazeb2.com",
            "downloadUrl": "https://f005.backblazeb2.com",
            "s3ApiUrl": "https://s3.us-east-005.backblazeb2.com",
            "absoluteMinimumPartSize": 5000000,
            "recommendedPartSize": 100000000,
            "allowed": {
                "buckets": [{"id": "bkt123", "name": "placard-raw"}],
                "capabilities": ["listFiles"],
                "namePrefix": "raw/",
            },
        },
        "groupsApi": {
            "capabilities": [],
            "groupsApiUrl": "https://example",
            "infoType": "groupsApi",
        },
    },
}


class Response(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


class B2NativeTest(unittest.TestCase):
    def setUp(self):
        self.urls = []

        def urlopen(req, timeout=None):
            self.urls.append(req.full_url)
            if req.full_url.endswith("b2_authorize_account"):
                return Response(json.dumps(V4_AUTH).encode())
            return Response(
                json.dumps({"buckets": [{"bucketId": "listed", "bucketName": "other"}]}).encode()
            )

        patcher = mock.patch.object(b2native.urllib.request, "urlopen", urlopen)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_authorizes_at_v4_and_reads_the_nested_storage_api(self):
        b2 = b2native.B2("id", "key")
        self.assertIn("/b2api/v4/b2_authorize_account", self.urls[0])
        self.assertEqual(
            (b2.api_url, b2.download_url, b2.token),
            ("https://api005.backblazeb2.com", "https://f005.backblazeb2.com", "tok"),
        )

    def test_calls_are_made_at_v4(self):
        b2 = b2native.B2("id", "key")
        b2.call("b2_list_buckets", {"accountId": "acct"})
        self.assertEqual(self.urls[-1], "https://api005.backblazeb2.com/b2api/v4/b2_list_buckets")

    def test_a_restricted_key_names_its_bucket_in_allowed_buckets(self):
        b2 = b2native.B2("id", "key")
        self.assertEqual(b2.bucket_id("placard-raw"), "bkt123")
        self.assertEqual(len(self.urls), 1)  # no list call needed

    def test_other_buckets_are_looked_up(self):
        b2 = b2native.B2("id", "key")
        self.assertEqual(b2.bucket_id("other"), "listed")


if __name__ == "__main__":
    unittest.main()
