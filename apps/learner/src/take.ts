/**
 * A take is one visit to one venue: a directory of frames and an append-only NDJSON
 * manifest, laid out the way data/labels/raw/<date>-<venue-slug>/ is so that the Mac
 * side (placard-ocr, exif-check, the fixture format) runs over it unchanged
 * (field-beta §4). Frames are written the instant they're taken and never edited —
 * raw is immutable (data/README.md).
 *
 * The manifest is the only state. On launch the app replays it to find a take still
 * in progress, so a crash or a phone restart mid-visit loses nothing (§3: capture
 * must never fail).
 */
import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';
import * as VisionOcr from '../modules/vision-ocr';
import type { FaceBox, Observation } from '../modules/vision-ocr';
import type { Gps } from './location';
import { redact, type RedactionFs, settle as settleRedaction } from './redaction';
import { slugify } from './registry';

// ---------------------------------------------------------------------------
// Vocabulary. Every value here is traceable to the protocol or a decision.

/** Protocol capture categories, plus the split the app makes explicit. */
export type FrameKind =
  | 'venue_sign' // arrival signage — a capture category, not a bookend (D26)
  | 'exterior' // on leaving
  | 'label' // shot A
  | 'work' // shot B
  | 'accession_crop' // shot C, conditional (protocol v2)
  | 'wall_text'; // the interpretive panel, a different extraction problem (§4.6)

export type VenueSignKind = 'name' | 'hours_admission' | 'accessible_entrance' | 'other';

/** Why a label group closed without a work frame. The reason is data (D23, D12). */
export type NoWorkReason =
  'photography_prohibited' | 'case_many_objects' | 'building_or_site' | 'other';

/** Group-level flags, each from a protocol case. */
export type GroupFlag =
  | 'shared_panel' // governs the next N works (the photography gallery)
  | 'case_panel_mixed_ownership' // several objects, some with keys, some without (D24)
  | 'loan_no_accession' // the degraded path (D17)
  | 'loan_lenders_accession'; // wrong-namespace trap (D17)

/** The protocol's hard-case table, as tags the tester sets at the moment. */
export const HARD_CASES = [
  'reflective_glass',
  'low_light',
  'bilingual',
  'non_latin_script',
  'vinyl_lettering',
  'oblique_angle',
  'attribution_qualifier',
  'not_an_artwork',
  'gallery_checklist',
] as const;
export type HardCase = (typeof HARD_CASES)[number];

export type VenueRef = {
  slug: string;
  name: string;
  /** `registry` — matched a data/venues/ entry. `tester` — added in the field; a low-confidence claim until verified (§3). */
  source: 'registry' | 'tester';
  distance_m: number | null;
};

export type FieldLog = {
  free_via: string | null;
  photography: 'permitted' | 'permanent_only' | 'prohibited' | 'unknown';
  notes: string | null;
};

export type AccessionStatus =
  | 'confirmed' // tester accepted a candidate as read
  | 'corrected' // tester typed the right one; the reading is kept alongside (D21)
  | 'none' // tester says the label carries no accession (loan, D17)
  | 'unread'; // OCR offered nothing and the tester didn't type one

type Base = { v: 1; ts: string; take: string; seq: number };

/**
 * The face pass as the frame was saved (D49): every face found was pixellated before
 * the frame reached the take. `error` when the pass couldn't run — Expo Go, or a
 * failure — in which case the frame was saved as shot.
 */
export type FacePass =
  { blurred: number; boxes: FaceBox[]; elapsed_ms: number } | { error: string };

export type ManifestRecord =
  | (Base & {
      type: 'take_started';
      venue: VenueRef;
      fix: Gps | null;
      field_log: FieldLog;
      device: {
        os: string;
        os_version: string;
        app_version: string | null;
        build: string | null;
        update: string | null;
        channel: string | null;
      };
    })
  | (Base & {
      type: 'venue_added';
      name: string;
      website: string | null;
      fix: Gps | null;
      source: 'tester';
      confidence: 'low';
    })
  | (Base & { type: 'group_opened'; group: string })
  | (Base & {
      type: 'frame';
      frame: string;
      /** Null only when the frame was redacted or discarded after the fact. */
      file: string | null;
      /**
       * Set on the Mac (D4 amendment) or on the phone (D41): the frame identified a minor
       * and was deleted (data/README.md "Minors"). The record stays so
       * replay and sequence numbers hold; tools/manifest/bind-frames.py reports it
       * rather than binding it.
       */
      redacted?: string;
      /**
       * Set by a retake (D48): the tester threw this frame away and shot it again. The
       * record stays so sequence numbers hold, but the frame isn't counted and isn't sent.
       */
      discarded?: string;
      kind: FrameKind;
      group: string | null;
      sign_kind?: VenueSignKind;
      /** Wall text can accompany a label group (the Champanier system had four surfaces). */
      linked_group?: string | null;
      width: number;
      height: number;
      gps: Gps | null;
      camera_roll: boolean;
      /** Absent on frames saved before the face pass existed. */
      faces?: FacePass;
    })
  | (Base & {
      type: 'faces';
      frame: string;
      /** Faces the tester says belong to the artwork, left unblurred: their claim (D49). */
      kept: { box: FaceBox; why: 'artwork' }[];
      /** Faces that stay pixellated. */
      blurred: number;
      /** `visit_ended`: nobody answered, and the blur stood. */
      by: 'tester' | 'visit_ended';
    })
  | (Base & {
      type: 'ocr';
      frame: string;
      group: string;
      elapsed_ms: number;
      scales: number[];
      languages: string[];
      lines: Observation[];
      warnings: string[];
      candidates: string[];
    })
  | (Base & {
      type: 'accession';
      group: string;
      status: AccessionStatus;
      /** What the machine offered first, if anything. */
      reading: string | null;
      /** What the human settled on. */
      value: string | null;
      candidates: string[];
    })
  | (Base & {
      type: 'group_closed';
      group: string;
      frames: { label: number; work: number; accession_crop: number };
      no_work_reason: NoWorkReason | null;
      flags: GroupFlag[];
      shared_panel_count: number | null;
      hard_cases: HardCase[];
      note: string | null;
    })
  | (Base & {
      type: 'take_ended';
      /**
       * The commit marker (D38): what this take claims should exist. The service
       * compares it with what arrived. Absent on takes ended before uploads existed.
       */
      counts?: Counts;
    });

// ---------------------------------------------------------------------------
// State, replayed from the manifest.

export type Counts = {
  labels: number;
  works: number;
  venue_signs: number;
  wall_texts: number;
  frames: number;
};

/** A frame with faces in it, waiting for the tester to say whether any belong to the work. */
export type FaceQuestion = {
  frame: string;
  file: string;
  boxes: FaceBox[];
  width: number;
  height: number;
};

export type Take = {
  id: string;
  dir: Directory;
  venue: VenueRef;
  started: string;
  ended: string | null;
  seq: number;
  nextGroup: number;
  nextFrame: number;
  openGroup: string | null;
  lastClosedGroup: string | null;
  counts: Counts;
  /** Oldest first. Their files stay on the phone until answered (upload.ts). */
  unanswered: FaceQuestion[];
};

const takesDir = () => new Directory(Paths.document, 'takes');
const manifestOf = (dir: Directory) => new File(dir, 'manifest.ndjson');

/** The take's directory, as redaction.ts sees it. */
function redactionFs(dir: Directory): RedactionFs {
  const f = (name: string) => new File(dir, name);
  return {
    exists: (name) => f(name).exists,
    read: (name) => f(name).textSync(),
    write: (name, text) => {
      const file = f(name);
      if (file.exists) file.delete();
      file.create();
      file.write(text);
    },
    remove: (name) => {
      if (f(name).exists) f(name).delete();
    },
    move: (from, to) => f(from).moveSync(f(to), { overwrite: true }),
  };
}

/**
 * Finish a redaction a crash interrupted, before anything reads or appends
 * (redaction.ts has the sequence). Runs even with no manifest present: a crash inside
 * the final move leaves exactly that, with the finished side file waiting.
 */
function settle(dir: Directory): void {
  settleRedaction(redactionFs(dir));
}

function emptyCounts(): Counts {
  return { labels: 0, works: 0, venue_signs: 0, wall_texts: 0, frames: 0 };
}

function replay(id: string, dir: Directory, lines: ManifestRecord[]): Take | null {
  let take: Take | null = null;
  for (const r of lines) {
    if (r.type === 'take_started') {
      take = {
        id,
        dir,
        venue: r.venue,
        started: r.ts,
        ended: null,
        seq: r.seq,
        nextGroup: 1,
        nextFrame: 1,
        openGroup: null,
        lastClosedGroup: null,
        counts: emptyCounts(),
        unanswered: [],
      };
      continue;
    }
    if (!take) continue;
    take.seq = Math.max(take.seq, r.seq);
    switch (r.type) {
      case 'group_opened':
        take.openGroup = r.group;
        take.nextGroup = Math.max(take.nextGroup, Number(r.group.slice(1)) + 1);
        break;
      case 'group_closed':
        take.openGroup = null;
        take.lastClosedGroup = r.group;
        take.counts.labels += 1;
        break;
      case 'frame':
        take.nextFrame = Math.max(take.nextFrame, Number(r.frame.slice(1)) + 1);
        if (r.discarded) break; // a retake: not a photo the visit claims to have
        // A redacted photo was still taken, so its kind counts, but it will never be
        // sent, and the frame count is what the commit marker claims (D38).
        if (r.file != null) take.counts.frames += 1;
        if (r.kind === 'work') take.counts.works += 1;
        if (r.kind === 'venue_sign' || r.kind === 'exterior') take.counts.venue_signs += 1;
        if (r.kind === 'wall_text') take.counts.wall_texts += 1;
        if (r.file != null && r.faces && 'blurred' in r.faces && r.faces.blurred > 0) {
          const { frame, file, width, height } = r;
          take.unanswered.push({ frame, file, boxes: r.faces.boxes, width, height });
        }
        break;
      case 'faces':
        take.unanswered = take.unanswered.filter((q) => q.frame !== r.frame);
        break;
      case 'take_ended':
        take.ended = r.ts;
        break;
    }
  }
  return take;
}

function readManifest(dir: Directory): ManifestRecord[] {
  settle(dir);
  const f = manifestOf(dir);
  if (!f.exists) return [];
  return f
    .textSync()
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .flatMap((l) => {
      try {
        return [JSON.parse(l) as ManifestRecord];
      } catch {
        // A torn last line from a crash mid-write. Everything before it is intact;
        // resumeTake closes the line so the next append starts a fresh one.
        return [];
      }
    });
}

const DELETING = '.deleting-';

/** Every take on the device, newest first. */
export function listTakes(): Take[] {
  const root = takesDir();
  if (!root.exists) return [];
  return root
    .list()
    .filter((e): e is Directory => e instanceof Directory)
    .filter((dir) => {
      if (!dir.name.startsWith(DELETING)) return true;
      // A deletion a crash interrupted (deleteTake): finish it.
      try {
        dir.delete();
      } catch (e) {
        console.warn('[take] could not finish deleting', dir.name, e);
      }
      return false;
    })
    .map((dir) => replay(dir.name, dir, readManifest(dir)))
    .filter((t): t is Take => t != null)
    .sort((a, b) => (a.started < b.started ? 1 : -1));
}

/** The take still in progress, if the app was closed mid-visit. */
export function resumeTake(): Take | null {
  const take = listTakes().find((t) => t.ended == null) ?? null;
  if (take) {
    // A crash can leave the last line torn. Without a newline the next record would
    // be glued onto it and both would be unreadable, here and in the bucket.
    const f = manifestOf(take.dir);
    const text = f.exists ? f.textSync() : '';
    if (text.length > 0 && !text.endsWith('\n')) f.write('\n', { append: true });
  }
  // Only the visit in progress can have a question open. Any other original is left
  // over from a deleted visit or a crash, and is the one copy of a face to clear.
  const keep = new Set(take?.unanswered.map((q) => originalOf(take, q.frame).uri) ?? []);
  if (originalsDir().exists) {
    for (const f of originalsDir().list()) {
      if (f instanceof File && !keep.has(f.uri)) f.delete();
    }
  }
  return take;
}

/**
 * The manifest's lines exactly as written, for the upload queue: each becomes its own
 * object in the bucket (D38), and it should be the device's bytes, not a
 * re-serialisation of them. A torn line is left out, as in replay.
 */
export function manifestLines(take: Take): { seq: number; line: string; record: ManifestRecord }[] {
  settle(take.dir);
  const f = manifestOf(take.dir);
  if (!f.exists) return [];
  return f
    .textSync()
    .split('\n')
    .flatMap((line) => {
      if (!line.trim()) return [];
      try {
        const record = JSON.parse(line) as ManifestRecord;
        return [{ seq: record.seq, line, record }];
      } catch {
        return [];
      }
    });
}

const appendListeners = new Set<() => void>();

/**
 * Told after every manifest write, appends and removals alike: the upload queue's cue
 * that there is something new, and the visit store's cue to re-render (session.ts).
 */
export function onAppend(listener: () => void): () => void {
  appendListeners.add(listener);
  return () => appendListeners.delete(listener);
}

// ---------------------------------------------------------------------------
// Writing.

type DistributiveOmit<T, K extends keyof any> = T extends unknown ? Omit<T, K> : never;
type RecordInput = DistributiveOmit<ManifestRecord, keyof Base>;

function append(take: Take, record: RecordInput): ManifestRecord {
  take.seq += 1;
  const full = {
    v: 1,
    ts: new Date().toISOString(),
    take: take.id,
    seq: take.seq,
    ...record,
  } as ManifestRecord;
  settle(take.dir);
  const f = manifestOf(take.dir);
  if (!f.exists) f.create({ intermediates: true });
  f.write(JSON.stringify(full) + '\n', { append: true });
  appendListeners.forEach((l) => l());
  return full;
}

function localDate(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function startTake(input: {
  venue: VenueRef;
  fix: Gps | null;
  fieldLog: FieldLog;
  addedVenue?: { name: string; website: string | null };
}): Take {
  const root = takesDir();
  if (!root.exists) root.create({ intermediates: true });
  // <date>-<venue-slug>, the raw/ convention; a second visit the same day gets -2.
  const base = `${localDate()}-${input.venue.slug}`;
  let id = base;
  for (let n = 2; new Directory(root, id).exists; n += 1) id = `${base}-${n}`;
  const dir = new Directory(root, id);
  dir.create();

  const take: Take = {
    id,
    dir,
    venue: input.venue,
    started: new Date().toISOString(),
    ended: null,
    seq: 0,
    nextGroup: 1,
    nextFrame: 1,
    openGroup: null,
    lastClosedGroup: null,
    counts: emptyCounts(),
    unanswered: [],
  };
  append(take, {
    type: 'take_started',
    venue: input.venue,
    fix: input.fix,
    field_log: input.fieldLog,
    device: {
      os: Platform.OS,
      os_version: String(Platform.Version),
      app_version: Constants.expoConfig?.version ?? null,
      build: Constants.nativeBuildVersion ?? null,
      update: Updates.updateId,
      channel: Updates.channel,
    },
  });
  if (input.addedVenue) {
    append(take, {
      type: 'venue_added',
      name: input.addedVenue.name,
      website: input.addedVenue.website,
      fix: input.fix,
      source: 'tester',
      confidence: 'low',
    });
  }
  return take;
}

/** Ends the visit. A face nobody answered for stays blurred (D49). */
export async function endTake(take: Take): Promise<void> {
  for (const q of [...take.unanswered]) await answerFaces(take, q.frame, [], 'visit_ended');
  append(take, { type: 'take_ended', counts: { ...take.counts } });
  take.ended = new Date().toISOString();
}

export function openGroup(take: Take): string {
  const group = `g${String(take.nextGroup).padStart(4, '0')}`;
  take.nextGroup += 1;
  take.openGroup = group;
  append(take, { type: 'group_opened', group });
  return group;
}

export function closeGroup(
  take: Take,
  group: string,
  detail: {
    frames: { label: number; work: number; accession_crop: number };
    no_work_reason: NoWorkReason | null;
    flags: GroupFlag[];
    shared_panel_count: number | null;
    hard_cases: HardCase[];
    note: string | null;
  },
): void {
  append(take, { type: 'group_closed', group, ...detail });
  take.openGroup = null;
  take.lastClosedGroup = group;
  take.counts.labels += 1;
}

export type SavedFrame = { id: string; file: File; width: number; height: number };

/**
 * Move a just-taken picture into the take and record it. The camera-roll copy is a
 * courtesy to the tester and a fallback for Doug's USB path (field-beta §4); if it
 * fails, the frame is still safe in the take and the manifest says so.
 *
 * Every frame goes through the face pass on the way in (D49), and any face found is
 * pixellated before the frame reaches the take, so the take never holds an unblurred
 * face. The original waits in the cache until the tester answers whether a face
 * belongs to the artwork. The camera roll gets the blurred copy, since iCloud Photos
 * would otherwise carry the face off the phone.
 */
export async function saveFrame(
  take: Take,
  picture: { uri: string; width: number; height: number },
  meta: {
    kind: FrameKind;
    group: string | null;
    gps: Gps | null;
    sign_kind?: VenueSignKind;
    linked_group?: string | null;
  },
): Promise<SavedFrame> {
  const id = `f${String(take.nextFrame).padStart(4, '0')}`;
  take.nextFrame += 1;
  const name = `${id}-${meta.kind}.jpg`;
  const dest = new File(take.dir, name);
  const faces = await facePass(take, id, new File(picture.uri), dest);

  let cameraRoll = false;
  try {
    const perm = await MediaLibrary.getPermissionsAsync(true);
    const ok =
      perm.granted ||
      (perm.canAskAgain && (await MediaLibrary.requestPermissionsAsync(true)).granted);
    if (ok) {
      await MediaLibrary.Asset.create(dest.uri);
      cameraRoll = true;
    }
  } catch (e) {
    console.warn('[take] camera roll save failed', e);
  }

  // Before the record, so whoever re-renders on it already sees the question.
  if ('blurred' in faces && faces.blurred > 0) {
    take.unanswered.push({
      frame: id,
      file: name,
      boxes: faces.boxes,
      width: picture.width,
      height: picture.height,
    });
  }
  append(take, {
    type: 'frame',
    frame: id,
    file: name,
    kind: meta.kind,
    group: meta.group,
    ...(meta.sign_kind ? { sign_kind: meta.sign_kind } : {}),
    ...(meta.linked_group !== undefined ? { linked_group: meta.linked_group } : {}),
    width: picture.width,
    height: picture.height,
    gps: meta.gps,
    camera_roll: cameraRoll,
    faces,
  });
  take.counts.frames += 1;
  if (meta.kind === 'work') take.counts.works += 1;
  if (meta.kind === 'venue_sign' || meta.kind === 'exterior') take.counts.venue_signs += 1;
  if (meta.kind === 'wall_text') take.counts.wall_texts += 1;
  return { id, file: dest, width: picture.width, height: picture.height };
}

const originalsDir = () => new Directory(Paths.cache, 'faces-unanswered');

/**
 * Where a frame's unblurred original waits for an answer. The cache, because device
 * backups leave it out; if iOS clears it first, the blur simply stands.
 */
function originalOf(take: Take, frame: string): File {
  return new File(originalsDir(), `${take.id}-${frame}.jpg`);
}

async function facePass(take: Take, frame: string, shot: File, dest: File): Promise<FacePass> {
  if (!VisionOcr.isAvailable) {
    shot.move(dest);
    return { error: 'the face pass is not linked into this build' };
  }
  try {
    const scan = await VisionOcr.detectFaces(shot.uri);
    if (scan.boxes.length === 0) {
      shot.move(dest);
    } else {
      if (!originalsDir().exists) originalsDir().create({ intermediates: true });
      const original = originalOf(take, frame);
      if (original.exists) original.delete();
      shot.move(original);
      await VisionOcr.pixellate(original.uri, dest.uri, scan.boxes);
    }
    return { blurred: scan.boxes.length, boxes: scan.boxes, elapsed_ms: scan.elapsedMs };
  } catch (e) {
    // Capture never fails (§3). The frame is kept as shot and the record says why.
    console.warn('[take] face pass failed', e);
    const original = originalOf(take, frame);
    if (!dest.exists) (original.exists ? original : shot).move(dest);
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** The frame as shot, for the face question; null once answered or if iOS cleared it. */
export function faceOriginal(take: Take, frame: string): File | null {
  const f = originalOf(take, frame);
  return f.exists ? f : null;
}

/**
 * Answer a frame's face question (D49): the faces at `kept` belong to the artwork and
 * stay unblurred; every other one is pixellated. The frame is always rewritten from
 * the original when there is one, whatever the answer, so a crash between rewriting
 * and recording can't leave a face unblurred under an answer that says otherwise.
 */
export async function answerFaces(
  take: Take,
  frame: string,
  kept: number[],
  by: 'tester' | 'visit_ended' = 'tester',
): Promise<void> {
  const q = take.unanswered.find((x) => x.frame === frame);
  if (!q) return;
  const original = originalOf(take, frame);
  if (!original.exists && kept.length > 0)
    throw new Error('The photo as shot is gone, so its faces stay blurred.');
  if (original.exists) {
    const blur = q.boxes.filter((_, i) => !kept.includes(i));
    try {
      await VisionOcr.pixellate(original.uri, new File(take.dir, q.file).uri, blur);
    } catch (e) {
      // Keeping a face needs the rewrite. Keeping none doesn't: the frame has had every
      // face blurred since it was saved, and a visit mustn't be kept from ending.
      if (kept.length > 0) throw e;
      console.warn('[take] face rewrite failed; the blur from saving stands', e);
    }
  }
  append(take, {
    type: 'faces',
    frame,
    kept: kept.map((i) => ({ box: q.boxes[i], why: 'artwork' as const })),
    blurred: q.boxes.length - kept.length,
    by,
  });
  take.unanswered = take.unanswered.filter((x) => x.frame !== frame);
  if (original.exists) original.delete();
  appendListeners.forEach((l) => l());
}

export function recordOcr(
  take: Take,
  detail: {
    frame: string;
    group: string;
    elapsed_ms: number;
    scales: number[];
    languages: string[];
    lines: Observation[];
    warnings: string[];
    candidates: string[];
  },
): void {
  append(take, { type: 'ocr', ...detail });
}

export function recordAccession(
  take: Take,
  detail: {
    group: string;
    status: AccessionStatus;
    reading: string | null;
    value: string | null;
    candidates: string[];
  },
): void {
  append(take, { type: 'accession', ...detail });
}

/** Every record of a take, in the order written. */
export function recordsOf(take: Take): ManifestRecord[] {
  return readManifest(take.dir);
}

/**
 * Remove a frame for good: the one edit ever made to a raw take (D4 amendment, D36),
 * done here on the phone the same way it was done by hand on the Mac for the Met.
 * The file is deleted and the text read from it is wiped, and both records stay, so
 * replay and sequence numbers hold and the visit still says a frame was taken here.
 *
 *   frame record  →  file: null, redacted: <why and when>
 *   ocr records   →  lines: [], candidates: [], warnings: [REDACTED …]
 *
 * The image goes first, because it is what identifies someone, and a crash at any
 * point is finished on the next read (redaction.ts). Safe to run again. The camera-roll
 * copy is a separate asset the app never recorded an ID for, so it can't be reached
 * from here, and the screen says so.
 */
export function redactFrame(take: Take, frame: string, why: string): void {
  const day = new Date().toISOString().slice(0, 10);
  if (!redact(redactionFs(take.dir), frame, why, day).found)
    throw new Error(`no frame ${frame} in ${take.id}`);
  recount(take, frame);
}

/** Counts again from the manifest after a removal, for whoever holds this take. */
function recount(take: Take, removed: string): void {
  const fresh = replay(take.id, take.dir, readManifest(take.dir));
  if (fresh) {
    take.counts = fresh.counts;
    take.unanswered = fresh.unanswered;
  }
  const original = originalOf(take, removed);
  if (original.exists) original.delete();
  appendListeners.forEach((l) => l());
}

/**
 * Throw a frame away so it can be shot again (D48). It goes the same way a redaction
 * does, through the same crash-safe sequence, but is marked `discarded`, not
 * `redacted`: the image is deleted, its OCR is wiped, and its record stays so
 * sequence numbers hold. Unlike a redacted frame it stops counting as a photo of its
 * kind as well as a frame. The camera-roll copy can't be reached, as with redactFrame.
 */
export function discardFrame(take: Take, frame: string): void {
  const day = new Date().toISOString().slice(0, 10);
  if (!redact(redactionFs(take.dir), frame, 'retake', day, 'discarded').found)
    throw new Error(`no frame ${frame} in ${take.id}`);
  recount(take, frame);
}

/**
 * Delete a visit from the phone, frames, manifest and ledger together (D48). Only
 * ever one that has sent nothing: upload.ts deleteUnsent checks that and is the way
 * in. The directory is renamed first, in one step, and from then on no listing sees
 * it, so a crash before the delete leaves a hidden directory that the next listing
 * clears, never a visit that replays half there. The camera-roll copies are separate
 * assets the app never recorded, as with redactFrame.
 */
export function deleteTake(take: Take): void {
  const name = `${DELETING}${take.id}`;
  take.dir.rename(name);
  new Directory(takesDir(), name).delete();
  for (const q of take.unanswered) {
    const original = originalOf(take, q.frame);
    if (original.exists) original.delete();
  }
}

/** The manifest file, for the share sheet. */
export function manifestFile(take: Take): File {
  return manifestOf(take.dir);
}

export function slugForVenueName(name: string): string {
  return slugify(name);
}
