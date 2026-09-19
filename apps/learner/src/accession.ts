/**
 * Finds accession-shaped tokens in an OCR reading and ranks them, so the read-back
 * screen can show the tester a candidate rather than a wall of text.
 *
 * LOCATE, DO NOT VALIDATE (D11). Venue patterns raise a candidate's rank; nothing is
 * rejected for failing them, because a museum with a century of accessioning has
 * several formats and the odd one is the interesting one. Contested lines (D21) stay
 * in, with every variant offered — the machine cannot settle the primary key alone,
 * and the human in front of the label is the arbiter.
 */
import type { Observation } from '../modules/vision-ocr';

export type Candidate = {
  value: string;
  /** Index into the observations the reading came from. */
  line: number;
  contested: boolean;
  score: number;
};

// A run of digit groups joined by dots — or hyphens, which Vision produces for a dot
// often enough (D19; the simulator read `38.447-4`) that the reading is offered as-is
// for the human to judge — optionally letter-prefixed (X2011…, MoAF…) and optionally
// suffixed with a part designator (14A-B — D24). Two or more groups, so a bare year
// or a decimal in a dimension line doesn't pass on its own.
const TOKEN = /(?<![\w.])[A-Za-z]{0,4}\.?\d{1,4}(?:[.-]\d{1,6}){1,5}(?:[A-Za-z]{1,2}(?:-[A-Za-z]{1,2})?)?(?![\w.])/g;

// The native module normalizes the reference reading of each line but hands the
// other scale's variants back raw, so a contested line's alternative can still carry
// the bullet-for-dot of D14. This mirrors the punctuation half of OCRCore.swift's
// `confusableMap` — the half accession tokens depend on. The durable fix is a
// `normalizedVariants` field on the native side, which waits for the next rebuild (D33).
const CONFUSABLE: Record<string, string> = {
  '\u2022': '.', '\u00B7': '.', '\u2027': '.', '\u22C5': '.', '\u30FB': '.', '\uFF0E': '.', '\u2219': '.',
  '\u2010': '-', '\u2011': '-', '\u2012': '-', '\u2212': '-', '\uFF0D': '-',
  '\u00A0': ' ', '\u2007': ' ', '\u202F': ' ',
};
const CONFUSABLE_RE = new RegExp(`[${Object.keys(CONFUSABLE).join('')}]`, 'g');
export function foldPunctuation(text: string): string {
  return text.replace(CONFUSABLE_RE, (c) => CONFUSABLE[c] ?? c);
}

// Two years joined by a hyphen are a life span or a date range, never a key.
const YEAR_RANGE = /^\d{4}-\d{2,4}$/;
// Lines that are almost certainly dimensions or dates, not keys.
const DIMENSION = /\b(cm|in\.?|inches|mm|x|×)\b/i;
const ACCESSION_WORD = /\b(accession|acc\.?\s*no|object\s*(number|no)|inv\.?)\b/i;

export function findAccessionCandidates(
  observations: Observation[],
  shapes: RegExp[],
): Candidate[] {
  const found = new Map<string, Candidate>();
  const total = observations.length || 1;

  observations.forEach((obs, index) => {
    // Every variant of a contested line is a separate candidate (D21): one of them
    // is usually right, and the app's job is to offer, not decide.
    const texts =
      obs.contested && obs.variants.length > 1
        ? obs.variants.map(foldPunctuation)
        : [obs.normalizedText];
    for (const text of texts) {
      const matches = text.match(TOKEN) ?? [];
      for (const raw of matches) {
        const value = raw.replace(/^\./, '');
        if (YEAR_RANGE.test(value)) continue;
        let score = 0;
        if (shapes.some((re) => re.test(value))) score += 3;
        if (ACCESSION_WORD.test(text)) score += 2;
        if (DIMENSION.test(text)) score -= 2;
        if (obs.contested) score -= 0.5;
        // Accessions sit at the foot of a tombstone far more often than the head.
        if (index / total > 0.5) score += 0.5;
        // A longer key is more specific and less likely to be a stray decimal.
        score += Math.min(value.length, 12) / 12;
        const prior = found.get(value);
        if (!prior || prior.score < score) {
          found.set(value, { value, line: index, contested: obs.contested, score });
        }
      }
    }
  });

  // Three candidates at most — ask rather than guess, but don't ask forty questions (§4.1).
  return [...found.values()].sort((a, b) => b.score - a.score).slice(0, 3);
}
