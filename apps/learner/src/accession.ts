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
  /**
   * Set when the line itself says the token is not a key — a BCE range on an era
   * line, a number on a dimension line. Only these are withheld from the read-back;
   * a low score never is (D21: the score narrows the field, the human closes it).
   */
  disqualified: boolean;
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
  '\u2010': '-', '\u2011': '-', '\u2012': '-', '\u2013': '-', '\u2212': '-', '\uFF0D': '-',
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

// The Met, 2026-09-20: on 3 of 14 labels the device offered the DATE as the accession —
// `373-350`, `750-740`, `480-470` — because a BCE range is two number groups joined by
// a dash and nothing said otherwise. Two signals separate a date line from a credit
// line, and both are on the card (fixtures met-49.11.4, met-74.51.965, met-loan-selinus):
//
//   - an era marker or "century" or "ca." on the line means the numbers are a date;
//   - a credit line ends "…Fund, 1922 (22.139.24)": the donation year and the key's
//     first component agreed on 13 of 14 Met labels and all 5 dated MCNY ones.
//
// Both are ranks, not gates (D11) — a venue that keys on years would still surface.
// Era markers are set in small caps on the cards, and Vision reads small-cap B.C. as
// Cyrillic в.с. often enough (Met g0007: 'Grock, 480-470 в.с.') that the look-alikes
// are matched here directly. No trailing \b: "B.C." at the end of a line has no word
// character after the period, so a boundary there never matches.
const ERA_LINE = /((?<![A-Za-z])[BВв]\.?\s?[CСс]\.?(?:[EЕе]\.?)?(?![A-Za-z])|(?<![A-Za-z])[AАа]\.?\s?D\.?(?![A-Za-z])|(?<![A-Za-z])[CСс]\.?[EЕе]\.?(?![A-Za-z])|\bcentury\b|\bca\.|\bcirca\b|\bmillennium\b)/i;
const DASHED_PAIR = /^\d{2,4}-\d{2,4}$/;
const CREDIT_WORD = /\b(fund|gift|bequest|purchase|purchased|collection|lent|loan|subscription|donors?|exchange)\b/i;
const CREDIT_YEAR = /\b(1[6-9]\d{2}|20\d{2})(?:[-–]\d{2,4})?\b/;

/** The year at the end of a credit line agrees with the key's first component: "1949 (49.11.4)", "2013 (2013.3.1.454)". */
function yearAgrees(value: string, text: string): boolean {
  const m = text.match(CREDIT_YEAR);
  if (!m) return false;
  const year = m[1];
  const head = value.replace(/^[A-Za-z]+/, '').split(/[.-]/)[0];
  return head === year || head === year.slice(2);
}

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
        // Shapes describe the number; a part designator (14A-B, D24) is not part of it.
        const bare = value.replace(/[A-Za-z]{1,2}(?:-[A-Za-z]{1,2})?$/, '');
        if (shapes.some((re) => re.test(bare))) score += 3;
        if (ACCESSION_WORD.test(text)) score += 2;
        const onDimensionLine = DIMENSION.test(text);
        const dateOnEraLine = ERA_LINE.test(text) && DASHED_PAIR.test(value);
        if (onDimensionLine) score -= 2;
        if (dateOnEraLine) score -= 4;
        if (CREDIT_WORD.test(text)) score += 1;
        if (yearAgrees(value, text)) score += 2;
        if (obs.contested) score -= 0.5;
        // Accessions sit at the foot of a tombstone far more often than the head.
        if (index / total > 0.5) score += 0.5;
        // A longer key is more specific and less likely to be a stray decimal.
        score += Math.min(value.length, 12) / 12;
        const prior = found.get(value);
        if (!prior || prior.score < score) {
          found.set(value, { value, line: index, contested: obs.contested, score, disqualified: dateOnEraLine || onDimensionLine });
        }
      }
    }
  });

  // Three candidates at most — ask rather than guess, but don't ask forty questions (§4.1).
  // A token the line itself argues against (a date on an era line, a number on a
  // dimension line) is not offered even when it's the only one: "I couldn't find a
  // number" with a crop or a typed answer is the honest read-back, and the frame is
  // still in the take for the Mac. Nothing else is withheld — a contested reading with
  // a low score is still offered, because the score ranks and the human decides (D21).
  return [...found.values()]
    .filter((c) => !c.disqualified)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
