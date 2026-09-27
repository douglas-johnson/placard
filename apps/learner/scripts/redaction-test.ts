/**
 * `npm run redaction-test` — the manifest rewrite behind removing a frame
 * (src/redaction.ts), checked under Node because the simulator can't be driven from a
 * script. The file operations around it are in take.ts redactFrame.
 */
import assert from 'node:assert/strict';
import { redactManifest } from '../src/redaction';

const take = '2026-09-20-the-metropolitan-museum-of-art';
const rec = (o: object) => JSON.stringify({ v: 1, ts: '2026-09-20T19:30:20.000Z', take, ...o });
const lines = [
  rec({ seq: 90, type: 'group_opened', group: 'g0014' }),
  rec({ seq: 91, type: 'frame', frame: 'f0035', file: 'f0035-label.jpg', kind: 'label', group: 'g0014', camera_roll: true }),
  rec({ seq: 92, type: 'ocr', frame: 'f0035', group: 'g0014', lines: [{ text: 'A CHILD, GRADE 4' }], warnings: [], candidates: ['2026.1'] }),
  rec({ seq: 93, type: 'accession', group: 'g0014', status: 'none', reading: null, value: null, candidates: [] }),
  rec({ seq: 94, type: 'frame', frame: 'f0036', file: 'f0036-work.jpg', kind: 'work', group: 'g0014' }),
  rec({ seq: 95, type: 'ocr', frame: 'f0036', group: 'g0014', lines: [{ text: 'keep me' }], warnings: [], candidates: [] }),
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

for (const i of [0, 3, 4, 5, 6, 7]) assert.equal(out[i], lines[i], `line ${i} keeps its exact bytes`);

// Running it again changes nothing and keeps the first note.
const again = redactManifest(r.text, 'f0035', 'identifies a minor', '2026-09-28');
assert.equal(again.text, r.text);
assert.equal(again.file, null);

// A Mac-side redaction already in the file is left as it was (the Met's own shape).
const mac = '{"v": 1, "seq": 91, "type": "frame", "frame": "f0035", "file": null, "redacted": "label of a minor — file deleted from raw/ 2026-09-20"}';
assert.equal(redactManifest(mac, 'f0035', 'identifies a minor', '2026-09-27').text, mac);

assert.equal(redactManifest(text, 'f9999', 'x', '2026-09-27').found, false);
console.log('redaction: all checks passed');
