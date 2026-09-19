# Placard

A curriculum planner and guide for art appreciation and self-study. `placard.pics`.

A learner photographs works that genuinely interest them, and the app grows a course of
study outward from those encounters. The pedagogy is borrowed from Reggio Emilia:
curriculum emerges from the learner rather than being delivered to them. The app
proposes; it never assigns.

Solo project, in progress.

## Where things are

| | |
|---|---|
| [`PLANNING.md`](PLANNING.md) | The strategy document. Long and argued; it has a section map at the top. |
| [`DECISIONS.md`](DECISIONS.md) | Settled architectural calls, with the reasoning that settled them. |
| [`CLAUDE.md`](CLAUDE.md) | Working context and the constraints that override convenience. |
| [`docs/capture-protocol.md`](docs/capture-protocol.md) | Field procedure for collecting wall labels. |

## Current phase — A0, the label corpus

The ground-truth corpus is the one asset in this project that can't be bought or
scraped: photographed wall labels paired with their verified correct extraction. It's
what lets the identification pipeline be *evaluated* rather than eyeballed.

It's being collected with a stock iPhone camera and a written protocol, ahead of the
app existing — see [`DECISIONS.md`](DECISIONS.md) D1 and D2 for why that ordering.

```sh
./tools/ocr/build.sh
./tools/ocr/bin/placard-ocr data/labels/raw/<date>-<venue> > out.ndjson
```

## Next — A1, the capture app

`apps/learner/` — Expo + React Native, iOS first. Scaffolded, not yet built out. Its
first milestone is to beat the stock camera at collecting the corpus.

```sh
cd apps/learner && npm install && npm run ios
```

## License

[GPL-3.0](LICENSE). The label fixtures under `data/` are short transcriptions of
museum label text, published as part of the corpus; the photographs they were taken
from are not in the repository.
