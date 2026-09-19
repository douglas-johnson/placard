/**
 * On-device OCR via Apple Vision (§4.4). The native side is OCRCore.swift, which is
 * the same code the corpus tool in tools/ocr runs on the Mac (D3), so a label that
 * reads a certain way in the fixtures reads the same way here.
 *
 * Null when the module isn't linked — Expo Go, or a stale development build. Callers
 * should treat that as "OCR unavailable", not as an error; the preflight screen is
 * where it gets reported.
 */
import { requireOptionalNativeModule } from 'expo';

/** One recognized line. Field names match `data/labels/fixtures` and the CLI's NDJSON. */
export type Observation = {
  text: string;
  confidence: number;
  /** Normalized, origin bottom-left, as Vision reports it: [x, y, width, height]. */
  box: [number, number, number, number];
  /** Distinct readings across the scales tried. One entry means every pass agreed. */
  variants: string[];
  /** True when the scales disagreed — treat the text as unconfirmed. */
  contested: boolean;
  /** `text` with confusable punctuation and homoglyphs folded to ASCII. Match against this. */
  normalizedText: string;
  wasNormalized: boolean;
  /** Frame edges the line runs into: "L", "R", "T", "B". Clipped text is truncated, not wrong. */
  clipped: string[];
};

export type RecognizeResult = {
  observations: Observation[];
  /** Lines joined top-to-bottom, the order a label is written in. */
  text: string;
  /** The same, normalized. Match accession numbers against this, never `text`. */
  normalizedText: string;
  warnings: string[];
  elapsedMs: number;
};

export type RecognizeOptions = {
  /** BCP-47 tags, e.g. ["en-US", "ja-JP"]. Default en-US. */
  languages?: string[];
  fast?: boolean;
  /** Default [1.0, 1.6, 2.4], matching the corpus tool. */
  scales?: number[];
};

type NativeModule = {
  recognize(uri: string, options?: RecognizeOptions): Promise<RecognizeResult>;
};

const native = requireOptionalNativeModule<NativeModule>('VisionOcr');

/** True when the native module is linked into this build. */
export const isAvailable = native != null;

/** Recognize text in the image at a local file URI. Rejects if the module isn't linked. */
export function recognize(uri: string, options?: RecognizeOptions): Promise<RecognizeResult> {
  if (!native) {
    return Promise.reject(new Error('VisionOcr is not linked into this build'));
  }
  return native.recognize(uri, options);
}
