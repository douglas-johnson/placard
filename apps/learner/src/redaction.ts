/**
 * The manifest half of removing a frame (take.ts redactFrame), kept free of Expo
 * imports so `npm run redaction-test` can check it under Node. Pure: text in, text
 * out.
 *
 *   frame record  →  file: null, redacted: <why and when>
 *   ocr records   →  lines: [], candidates: [], warnings: [REDACTED …]
 *
 * Every other line keeps its exact bytes, torn ones included: a redaction removes
 * one frame's image and text and nothing else.
 */
export function redactManifest(text: string, frame: string, why: string, day: string): { text: string; file: string | null; found: boolean } {
  let file: string | null = null;
  let found = false;
  const out = text.split('\n').map((line) => {
    let r: any;
    try {
      r = JSON.parse(line);
    } catch {
      return line; // blank or torn: not ours to touch
    }
    if (r?.type === 'frame' && r.frame === frame) {
      found = true;
      file = r.file ?? null;
      if (r.redacted && r.file == null) return line; // already done, here or on the Mac
      return JSON.stringify({ ...r, file: null, redacted: r.redacted ?? `${why} — removed on the phone ${day}` });
    }
    if (r?.type === 'ocr' && r.frame === frame && (r.lines?.length ?? 0) + (r.candidates?.length ?? 0) > 0) {
      return JSON.stringify({ ...r, lines: [], candidates: [], warnings: [`REDACTED ${day}: ${why}. Lines removed on the phone with the frame.`] });
    }
    return line;
  });
  return { text: out.join('\n'), file, found };
}
