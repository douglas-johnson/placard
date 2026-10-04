/**
 * On-device OCR and face blur via Apple Vision (§4.4, D49). The native side is OCRCore.swift, which is
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

/** A face as Vision found it: normalized to the upright image, origin bottom-left. */
export type FaceBox = [number, number, number, number];

export type FaceScan = {
  boxes: FaceBox[];
  elapsedMs: number;
};

type NativeModule = {
  /** FaceCore.swift's `faceMargin`: a pixellated region is the face grown by this on every side. */
  faceMargin: number;
  recognize(uri: string, options?: RecognizeOptions): Promise<RecognizeResult>;
  detectFaces(uri: string): Promise<FaceScan>;
  pixellate(source: string, destination: string, boxes: FaceBox[]): Promise<void>;
};

const native = requireOptionalNativeModule<NativeModule>('VisionOcr');

/** True when the native module is linked into this build. */
export const isAvailable = native != null;

/**
 * The fraction of a face's size a pixellated region reaches past it on every side, as
 * FaceCore.swift defines it. Null when the module isn't linked, and then no face is
 * ever found either.
 */
export const faceMargin: number | null = native?.faceMargin ?? null;

/** Recognize text in the image at a local file URI. Rejects if the module isn't linked. */
export function recognize(uri: string, options?: RecognizeOptions): Promise<RecognizeResult> {
  if (!native) {
    return Promise.reject(new Error('VisionOcr is not linked into this build'));
  }
  return native.recognize(uri, options);
}

/**
 * Faces in the image at a local file URI (D49). Finding and pixellating are separate
 * so which faces get blurred is decided here in JS, by the tester, and can change by
 * update. Rejects if the module isn't linked.
 */
export function detectFaces(uri: string): Promise<FaceScan> {
  if (!native) {
    return Promise.reject(new Error('VisionOcr is not linked into this build'));
  }
  return native.detectFaces(uri);
}

/**
 * Writes `source` to `destination` with each box pixellated (grown to take in hair and
 * jaw), keeping the file's EXIF, GPS and orientation. The two may be the same file;
 * the write is atomic either way.
 */
export function pixellate(source: string, destination: string, boxes: FaceBox[]): Promise<void> {
  if (!native) {
    return Promise.reject(new Error('VisionOcr is not linked into this build'));
  }
  return native.pixellate(source, destination, boxes);
}
