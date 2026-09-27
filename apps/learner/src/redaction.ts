/**
 * The manifest half of removing a frame (take.ts redactFrame), kept free of Expo
 * imports so `npm run redaction-test` can check it under Node. Pure: text in, text
 * out. What the app read from the frame goes; what the tester said stays.
 *
 *   frame record       →  file: null, redacted: <why and when>
 *   ocr records        →  lines: [], candidates: [], warnings: [REDACTED …]
 *   accession records  →  reading: null, candidates: []  — only when the frame is a
 *                          label or accession crop, whose OCR the locator read them
 *                          from (LabelFlow). The group's status and value stay: they
 *                          are the tester's answer, like the group's note, which the
 *                          Mac-side redaction of the Met kept too.
 *
 * Every other line keeps its exact bytes, torn ones included. The accession
 * candidates are the union across the group's label frames, so wiping them can take
 * a sibling frame's reading too; over-wiping is the safe direction.
 */
export function redactManifest(text: string, frame: string, why: string, day: string): { text: string; file: string | null; found: boolean } {
  const parse = (line: string): any => {
    try {
      return JSON.parse(line);
    } catch {
      return null; // blank or torn: not ours to touch
    }
  };
  const lines = text.split('\n');
  const target = lines.map(parse).find((r) => r?.type === 'frame' && r.frame === frame);
  if (!target) return { text, file: null, found: false };
  const readForAccession = (target.kind === 'label' || target.kind === 'accession_crop') && target.group;

  const out = lines.map((line) => {
    const r = parse(line);
    if (r?.type === 'frame' && r.frame === frame) {
      if (r.redacted && r.file == null) return line; // already done, here or on the Mac
      return JSON.stringify({ ...r, file: null, redacted: r.redacted ?? `${why} — removed on the phone ${day}` });
    }
    if (r?.type === 'ocr' && r.frame === frame && (r.lines?.length ?? 0) + (r.candidates?.length ?? 0) > 0) {
      return JSON.stringify({ ...r, lines: [], candidates: [], warnings: [`REDACTED ${day}: ${why}. Lines removed on the phone with the frame.`] });
    }
    if (readForAccession && r?.type === 'accession' && r.group === target.group && (r.reading != null || (r.candidates?.length ?? 0) > 0)) {
      return JSON.stringify({ ...r, reading: null, candidates: [] });
    }
    return line;
  });
  return { text: out.join('\n'), file: target.file ?? null, found: true };
}

/**
 * The file half, over the few operations it needs, so the crash behaviour can be
 * checked under Node by failing at every step (scripts/redaction-test.ts). take.ts
 * supplies the real one over a take's directory.
 */
export type RedactionFs = {
  exists(name: string): boolean;
  read(name: string): string;
  write(name: string, text: string): void;
  remove(name: string): void;
  /** Replace `to` with `from`. */
  move(from: string, to: string): void;
};

const MANIFEST = 'manifest.ndjson';
const INTENT = 'redacting.json';
const SIDE = 'manifest.ndjson.redacting';
const READY = 'manifest.ndjson.redacting.ready';

/**
 * Remove a frame's image and wipe its text, in an order a crash can't leave half
 * done. The review of PR #7 caught the version before this: it treated "the side file
 * and the manifest both exist" as "the side file is torn", which is also true for the
 * instant after the side file is complete, so a crash there kept the child's name in
 * the manifest after the image was already gone.
 *
 *   1. write the intent (frame, why, day)    nothing removed yet; a torn intent is dropped
 *   2. delete the image                        identifying content first
 *   3. write the rewritten manifest to SIDE    may be torn
 *   4. write READY                             SIDE is complete
 *   5. move SIDE over the manifest
 *   6. remove READY, then the intent
 *
 * settle() runs before every read and write of the manifest, and from any point it
 * finishes the job: a READY side file is moved into place, and one without READY is
 * discarded. Then an intent still present re-runs the redaction, which is idempotent.
 */
export function redact(fs: RedactionFs, frame: string, why: string, day: string): { found: boolean } {
  settle(fs);
  if (!redactManifest(fs.read(MANIFEST), frame, why, day).found) return { found: false };
  fs.write(INTENT, JSON.stringify({ frame, why, day }));
  apply(fs, frame, why, day);
  fs.remove(INTENT);
  return { found: true };
}

export function settle(fs: RedactionFs): void {
  if (fs.exists(READY)) {
    if (fs.exists(SIDE)) fs.move(SIDE, MANIFEST);
    fs.remove(READY);
  } else if (fs.exists(SIDE)) {
    fs.remove(SIDE); // torn, or never finished: the intent below redoes it
  }
  if (!fs.exists(INTENT)) return;
  let intent: { frame: string; why: string; day: string };
  try {
    intent = JSON.parse(fs.read(INTENT));
  } catch {
    fs.remove(INTENT); // torn at step 1: nothing had been removed yet
    return;
  }
  apply(fs, intent.frame, intent.why, intent.day);
  fs.remove(INTENT);
}

function apply(fs: RedactionFs, frame: string, why: string, day: string): void {
  const before = fs.read(MANIFEST);
  const result = redactManifest(before, frame, why, day);
  if (result.file && fs.exists(result.file)) fs.remove(result.file);
  if (result.text === before) return;
  if (fs.exists(SIDE)) fs.remove(SIDE);
  fs.write(SIDE, result.text);
  fs.write(READY, '');
  fs.move(SIDE, MANIFEST);
  fs.remove(READY);
}
