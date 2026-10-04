/**
 * `npm run redaction-test` — the manifest rewrite behind removing a frame
 * (src/redaction.ts), checked under Node because the simulator can't be driven from a
 * script. The file operations around it are in take.ts redactFrame.
 */
import assert from 'node:assert/strict';
import { redact, type RedactionFs, redactManifest, type Removal, settle } from '../src/redaction';

const take = '2026-09-20-the-metropolitan-museum-of-art';
const rec = (o: object) => JSON.stringify({ v: 1, ts: '2026-09-20T19:30:20.000Z', take, ...o });
const lines = [
  rec({ seq: 90, type: 'group_opened', group: 'g0014' }),
  rec({
    seq: 91,
    type: 'frame',
    frame: 'f0035',
    file: 'f0035-label.jpg',
    kind: 'label',
    group: 'g0014',
    camera_roll: true,
  }),
  rec({
    seq: 92,
    type: 'ocr',
    frame: 'f0035',
    group: 'g0014',
    lines: [{ text: 'A CHILD, GRADE 4' }],
    warnings: [],
    candidates: ['2026.1'],
  }),
  rec({
    seq: 93,
    type: 'accession',
    group: 'g0014',
    status: 'corrected',
    reading: '2026.1',
    value: '2026.7',
    candidates: ['2026.1'],
  }),
  rec({
    seq: 94,
    type: 'frame',
    frame: 'f0036',
    file: 'f0036-work.jpg',
    kind: 'work',
    group: 'g0014',
  }),
  rec({
    seq: 95,
    type: 'ocr',
    frame: 'f0036',
    group: 'g0014',
    lines: [{ text: 'keep me' }],
    warnings: [],
    candidates: [],
  }),
  '{"v":1,"seq":96,"type":"gro', // torn by a crash
  '',
];
const text = lines.join('\n');

const r = redactManifest(text, 'f0035', 'identifies a minor', '2026-09-27');
assert.equal(r.found, true);
assert.equal(r.file, 'f0035-label.jpg');
const out = r.text.split('\n');
assert.equal(out.length, lines.length, 'no line added or dropped');

const frame = JSON.parse(out[1]);
assert.equal(frame.file, null);
assert.equal(frame.redacted, 'identifies a minor — removed on the phone 2026-09-27');
assert.equal(frame.seq, 91, 'sequence numbers hold');

const ocr = JSON.parse(out[2]);
assert.deepEqual(ocr.lines, []);
assert.deepEqual(ocr.candidates, []);
assert.match(ocr.warnings[0], /^REDACTED 2026-09-27/);
assert.ok(!r.text.includes('A CHILD'), 'the text read from the frame is gone');
assert.ok(!r.text.includes('2026.1'), 'and so is every reading derived from it');

// The locator's reading came from the label's OCR, so it goes; the tester's answer stays.
const accession = JSON.parse(out[3]);
assert.equal(accession.reading, null);
assert.deepEqual(accession.candidates, []);
assert.equal(accession.status, 'corrected');
assert.equal(accession.value, '2026.7');

for (const i of [0, 4, 5, 6, 7]) assert.equal(out[i], lines[i], `line ${i} keeps its exact bytes`);

// Removing a work frame leaves the group's accession alone: nothing was read from it.
const work = redactManifest(text, 'f0036', 'identifies a minor', '2026-09-27').text.split('\n');
assert.equal(work[3], lines[3]);
assert.equal(work[2], lines[2]);

// Running it again changes nothing and keeps the first note.
const again = redactManifest(r.text, 'f0035', 'identifies a minor', '2026-09-28');
assert.equal(again.text, r.text);
assert.equal(again.file, null);

// A Mac-side redaction already in the file is left as it was (the Met's own shape).
const mac =
  '{"v": 1, "seq": 91, "type": "frame", "frame": "f0035", "file": null, "redacted": "label of a minor — file deleted from raw/ 2026-09-20"}';
assert.equal(redactManifest(mac, 'f0035', 'identifies a minor', '2026-09-27').text, mac);

assert.equal(redactManifest(text, 'f9999', 'x', '2026-09-27').found, false);

// A retake (D48) goes the same way under its own field, so tools downstream can tell a
// thrown-away frame from one that identified a minor.
const d = redactManifest(text, 'f0035', 'retake', '2026-10-04', 'discarded');
const dOut = d.text.split('\n');
const dFrame = JSON.parse(dOut[1]);
assert.equal(dFrame.file, null);
assert.equal(dFrame.discarded, 'retake — removed on the phone 2026-10-04');
assert.equal(dFrame.redacted, undefined, 'a retake is not a redaction');
assert.match(JSON.parse(dOut[2]).warnings[0], /^DISCARDED 2026-10-04: retake/);
assert.equal(JSON.parse(dOut[3]).reading, null, 'the reading from the frame goes with it');
for (const i of [0, 4, 5, 6, 7]) assert.equal(dOut[i], lines[i], `line ${i} keeps its exact bytes`);
// Either removal finds the other already done and leaves it alone.
assert.equal(redactManifest(d.text, 'f0035', 'identifies a minor', '2026-10-05').text, d.text);
assert.equal(redactManifest(r.text, 'f0035', 'retake', '2026-10-05', 'discarded').text, r.text);

// ---------------------------------------------------------------------------
// Crashes. A file system that dies at operation N, leaving a half-written file when
// N is a write, the way a torn write looks after a crash. For every N in the
// redaction, and then for every M in the recovery that follows, one clean settle()
// must end in one of exactly two states: untouched (the crash came before anything
// was removed, and the photo still offers "Remove…"), or fully redacted. Never the
// image gone with the text left — the state the review of PR #7 found.

class Crash extends Error {}

function memoryFs(files: Map<string, string>, dieAt = Infinity): RedactionFs & { ops: number } {
  const fs = {
    ops: 0,
    tick() {
      fs.ops += 1;
      if (fs.ops === dieAt) throw new Crash();
    },
    exists: (n: string) => files.has(n),
    read: (n: string) => {
      if (!files.has(n)) throw new Error(`read of missing ${n}`);
      return files.get(n)!;
    },
    write(n: string, t: string) {
      if (fs.ops + 1 === dieAt) {
        files.set(n, t.slice(0, Math.floor(t.length / 2)));
      }
      fs.tick();
      files.set(n, t);
    },
    remove(n: string) {
      fs.tick();
      files.delete(n);
    },
    move(from: string, to: string) {
      // expo's moveSync with overwrite: delete the destination, then rename — two steps.
      fs.tick();
      files.delete(to);
      fs.tick();
      files.set(to, files.get(from)!);
      files.delete(from);
    },
  };
  return fs;
}

function crashes(removal: Removal, why: string): void {
  const start = () =>
    new Map([
      ['manifest.ndjson', text],
      ['f0035-label.jpg', '<jpeg>'],
      ['f0036-work.jpg', '<jpeg>'],
    ]);

  const clean = start();
  const total = memoryFs(clean);
  redact(total, 'f0035', why, '2026-09-27', removal);
  const want = [...clean.entries()].sort();
  const untouched = [...start().entries()].sort();
  assert.ok(!clean.has('f0035-label.jpg') && clean.has('f0036-work.jpg'));
  assert.equal(
    clean.get('manifest.ndjson'),
    redactManifest(text, 'f0035', why, '2026-09-27', removal).text,
  );

  let cases = 0;
  for (let n = 1; n <= total.ops; n += 1) {
    const files = start();
    assert.throws(() => redact(memoryFs(files, n), 'f0035', why, '2026-09-27', removal), Crash);
    const afterFirst = new Map(files);
    // …and a second crash anywhere in the recovery.
    for (let m = 1; ; m += 1) {
      const again = new Map(afterFirst);
      let recovered = true;
      try {
        settle(memoryFs(again, m));
      } catch (e) {
        if (!(e instanceof Crash)) throw e;
        recovered = false;
      }
      settle(memoryFs(again));
      const got = JSON.stringify([...again.entries()].sort());
      const outcome =
        got === JSON.stringify(want)
          ? 'redacted'
          : got === JSON.stringify(untouched)
            ? 'untouched'
            : null;
      assert.ok(outcome, `crash at redaction step ${n}, recovery step ${m}: ${got.slice(0, 300)}`);
      if (outcome === 'untouched')
        assert.ok(
          n <= 1,
          `only a crash before the intent is written may leave it untouched (step ${n})`,
        );
      cases += 1;
      if (recovered) break;
    }
  }
  console.log(`${removal}: ${total.ops} steps, ${cases} crash combinations, every one recovers`);
}

crashes('redacted', 'identifies a minor');
crashes('discarded', 'retake');

// An intent left by a build from before retakes carries no `removal`: it was a redaction.
const legacy = new Map([
  ['manifest.ndjson', text],
  ['f0035-label.jpg', '<jpeg>'],
  [
    'redacting.json',
    JSON.stringify({ frame: 'f0035', why: 'identifies a minor', day: '2026-09-27' }),
  ],
]);
settle(memoryFs(legacy));
assert.equal(legacy.get('manifest.ndjson'), r.text);
assert.ok(!legacy.has('f0035-label.jpg') && !legacy.has('redacting.json'));

console.log('redaction: all checks passed');
