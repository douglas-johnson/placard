/**
 * Runs the accession locator over every reading the corpus holds and reports whether
 * the right number comes first. Two kinds of reading, because the phone's Vision
 * model is not the Mac's (D30):
 *
 *   device  — the `ocr` records in each take's manifest: what the app actually saw,
 *             scored against what the human confirmed or typed on the spot.
 *   mac     — data/labels/derived/<take>.ndjson from tools/ocr, joined to the
 *             fixtures by source_image, scored against `expected.accession_number`.
 *
 * A fixture whose accession is null (a loan with no number) passes when nothing is
 * offered, or when what's offered is at least not a date — the D17 degraded path.
 *
 *   npm run locator-eval
 *
 * No Metro, no simulator: tsc compiles this and src/accession.ts to the scratch
 * directory and node runs it. Raw takes are gitignored, so device rows only appear
 * on a machine that has them.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { findAccessionCandidates } from '../src/accession';

// Resolved from the working directory (apps/learner), not __dirname — the compiled
// copy runs from a scratch directory.
const ROOT = path.resolve(process.cwd(), '../..');
const DATA = path.join(ROOT, 'data/labels');

type Row = { take: string; source: 'device' | 'mac'; frame: string; expected: string | null; got: string[]; ok: boolean };

function shapesFor(slug: string): RegExp[] {
  const file = path.join(ROOT, 'data/venues', `${slug}.json`);
  if (!fs.existsSync(file)) return [];
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')).accession_formats;
  const list = Array.isArray(raw) ? raw : raw?.shapes ?? [];
  return list.flatMap((s: { pattern: string }) => {
    try {
      return [new RegExp(s.pattern)];
    } catch {
      return [];
    }
  });
}

const DATE_SHAPED = /^\d{2,4}-\d{2,4}$/;
/** `accepted` is every number that is genuinely on the label — a shared panel has several, and any of them first is a correct locate. */
function judge(accepted: string[], got: string[]): boolean {
  if (accepted.length > 0) return accepted.includes(got[0]);
  return got.length === 0 || !DATE_SHAPED.test(got[0]);
}

const rows: Row[] = [];

// mac: fixtures × derived
const derived = new Map<string, any>();
for (const f of fs.readdirSync(path.join(DATA, 'derived')).filter((n) => n.endsWith('.ndjson'))) {
  for (const line of fs.readFileSync(path.join(DATA, 'derived', f), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const r = JSON.parse(line);
    derived.set(`raw/${f.replace('.ndjson', '')}/${r.filename}`, r);
  }
}
for (const f of fs.readdirSync(path.join(DATA, 'fixtures')).filter((n) => n.endsWith('.json'))) {
  const fx = JSON.parse(fs.readFileSync(path.join(DATA, 'fixtures', f), 'utf8'));
  if (!fx.source_image) continue;
  const r = derived.get(fx.source_image);
  if (!r) continue;
  const got = findAccessionCandidates(r.observations, shapesFor(fx.venue)).map((c) => c.value);
  const expected = fx.expected?.accession_number ?? null;
  const accepted: string[] = fx.shared_panel?.objects?.map((o: any) => o.accession_number) ?? (expected ? [expected] : []);
  rows.push({ take: fx.source_image.split('/')[1], source: 'mac', frame: path.basename(fx.source_image), expected, got, ok: judge(accepted, got) });
}

// device: manifests
const rawDir = path.join(DATA, 'raw');
if (fs.existsSync(rawDir)) {
  for (const take of fs.readdirSync(rawDir)) {
    const m = path.join(rawDir, take, 'manifest.ndjson');
    if (!fs.existsSync(m)) continue;
    const recs = fs.readFileSync(m, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const started = recs.find((r) => r.type === 'take_started');
    const slug = started?.venue?.slug === 'the-metropolitan-museum-of-art' ? 'met' : started?.venue?.slug ?? '';
    const shapes = shapesFor(slug);
    for (const acc of recs.filter((r) => r.type === 'accession')) {
      const ocr = recs.filter((r) => r.type === 'ocr' && r.group === acc.group && r.lines.length > 0);
      if (ocr.length === 0) continue; // redacted, or nothing read
      const lines = ocr.flatMap((o) => o.lines);
      const got = findAccessionCandidates(lines, shapes).map((c) => c.value);
      const expected = acc.status === 'none' ? null : acc.value;
      if (acc.status === 'unread') continue;
      // On the device the human settled on one number; the manifest doesn't know the
      // panel's others, so a shared panel is judged on the confirmed one only.
      rows.push({ take, source: 'device', frame: acc.group, expected, got, ok: judge(expected ? [expected] : [], got) });
    }
  }
}

rows.sort((a, b) => a.take.localeCompare(b.take) || a.source.localeCompare(b.source) || a.frame.localeCompare(b.frame));
let pass = 0;
for (const r of rows) {
  if (r.ok) pass += 1;
  console.log(`${r.ok ? ' ok ' : 'FAIL'} ${r.take} ${r.source.padEnd(6)} ${r.frame.padEnd(16)} want ${String(r.expected).padEnd(18)} got ${JSON.stringify(r.got)}`);
}
console.log(`\n${pass}/${rows.length} first-candidate correct`);
process.exitCode = pass === rows.length ? 0 : 1;
