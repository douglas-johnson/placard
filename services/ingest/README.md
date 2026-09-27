# services/ingest

The one service between a phone and `placard-raw` (field-beta §4; D34, D35, D38, D43).
It signs a PUT for each frame so the frame goes straight to B2, writes each manifest
record as its own object, and reports whether a take is complete. The app holds a
per-build token and its own random contributor ID, and never a bucket credential.

## The rule it exists to keep

In `raw/`, every write creates a key that did not exist (D35). B2 has no conditional
write, so this service enforces it in three steps, in order: a Postgres primary key
claims the key (`schema.sql`), a HEAD checks the bucket, and only then is a URL signed
or an object written. The same content arriving twice is a retry and succeeds. Different
content under a claimed key is a **409**, and it is never overwritten.

## API

All `/v1` calls carry `Authorization: Bearer <token>` and `X-Placard-Contributor: <id>`.

| Call | Body | Result |
|---|---|---|
| `POST /v1/frames` | `{take, frame, file, bytes, md5}` (md5 base64) | `{status: "upload", url, headers}` or `{status: "stored"}`; 409 on conflict |
| `POST /v1/frames/complete` | `{take, frame}` | `{status: "stored" \| "missing"}`; 409 if what landed disagrees |
| `POST /v1/records` | `{take, lines: [<ndjson line>, …]}` ≤ 200 | `{stored: [seq], conflicts: [seq], rejected: [{index, reason}]}` |
| `GET /v1/takes/<take>` | — | counts, missing seqs, `complete` (observed matches `take_ended`'s claim) |
| `GET /healthz` | — | `{ok: true}` |

The signed PUT requires the phone to send the returned `Content-Type` and
`Content-MD5` headers unchanged.

## Local

```sh
cd services/ingest
/usr/local/bin/python3.13 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
.venv/bin/pytest -q
```

A full local run uses moto as the bucket and the in-memory index:

```sh
.venv/bin/pip install 'moto[server]'
.venv/bin/moto_server -p 5055 &     # then create placard-raw in it with boto3
B2_ENDPOINT=http://127.0.0.1:5055 B2_KEY_ID=x B2_KEY=x B2_BUCKET=placard-raw \
  UPLOAD_TOKENS=localtoken INGEST_MEMORY_INDEX=1 \
  .venv/bin/uvicorn app:from_env --factory --port 8055
```

**moto checks neither the signature nor the Content-MD5.** A local run proves the flow,
not the store's enforcement. That can only be checked against B2 (infrastructure §8).

## Deploy

Declared in `.railway/railway.ts` alongside its Postgres, and deployed from `main`.
Secrets go in at a hidden prompt and reach the CLI on stdin, so they never pass
through a file or the process list:

```sh
railway config apply                         # creates postgres + ingest
for v in B2_ENDPOINT B2_KEY_ID B2_KEY B2_BUCKET; do
  read -rs "val?$v: "; echo
  printf %s "$val" | railway variable set "$v" --stdin --service ingest --skip-deploys
done; unset val
openssl rand -hex 32 | railway variable set UPLOAD_TOKENS --stdin --service ingest
railway domain --service ingest              # generates and prints the public URL
```

The app sends to **`https://ingest.placard.pics`** (D44), a custom domain on the service
that CNAMEs to Railway. Railway's configuration can't register a custom domain, so it
was added by hand and isn't in `railway.ts`; `railway config plan` leaves it alone. It
is re-created like this, and the command prints the CNAME and `_railway-verify` TXT
records to add at the domain registrar:

```sh
railway domain ingest.placard.pics --service ingest --environment testflight
railway domain status ingest.placard.pics --service ingest --environment testflight
```

`ingest-testflight.up.railway.app` stays up too, for any phone whose update predates
the switch.

`B2_KEY` is **ingest's** key from infrastructure §3.2: `listFiles`, `readFiles` and
`writeFiles` on `raw/`, never `deleteFiles`.
