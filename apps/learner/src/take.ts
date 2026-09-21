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
import type { Observation } from '../modules/vision-ocr';
import type { Gps } from './location';
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
  | 'photography_prohibited'
  | 'case_many_objects'
  | 'building_or_site'
  | 'other';

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

export type ManifestRecord =
  | (Base & {
      type: 'take_started';
      venue: VenueRef;
      fix: Gps | null;
      field_log: FieldLog;
      device: { os: string; os_version: string; app_version: string | null; build: string | null; update: string | null; channel: string | null };
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
      file: string;
      kind: FrameKind;
      group: string | null;
      sign_kind?: VenueSignKind;
      /** Wall text can accompany a label group (the Champanier system had four surfaces). */
      linked_group?: string | null;
      width: number;
      height: number;
      gps: Gps | null;
      camera_roll: boolean;
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
  | (Base & { type: 'take_ended' });

// ---------------------------------------------------------------------------
// State, replayed from the manifest.

export type Counts = {
  labels: number;
  works: number;
  venue_signs: number;
  wall_texts: number;
  frames: number;
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
};

const takesDir = () => new Directory(Paths.document, 'takes');
const manifestOf = (dir: Directory) => new File(dir, 'manifest.ndjson');

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
        take.counts.frames += 1;
        if (r.kind === 'work') take.counts.works += 1;
        if (r.kind === 'venue_sign' || r.kind === 'exterior') take.counts.venue_signs += 1;
        if (r.kind === 'wall_text') take.counts.wall_texts += 1;
        break;
      case 'take_ended':
        take.ended = r.ts;
        break;
    }
  }
  return take;
}

function readManifest(dir: Directory): ManifestRecord[] {
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
        // the next append starts a fresh line.
        return [];
      }
    });
}

/** Every take on the device, newest first. */
export function listTakes(): Take[] {
  const root = takesDir();
  if (!root.exists) return [];
  return root
    .list()
    .filter((e): e is Directory => e instanceof Directory)
    .map((dir) => replay(dir.name, dir, readManifest(dir)))
    .filter((t): t is Take => t != null)
    .sort((a, b) => (a.started < b.started ? 1 : -1));
}

/** The take still in progress, if the app was closed mid-visit. */
export function resumeTake(): Take | null {
  return listTakes().find((t) => t.ended == null) ?? null;
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
  const f = manifestOf(take.dir);
  if (!f.exists) f.create({ intermediates: true });
  f.write(JSON.stringify(full) + '\n', { append: true });
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

export function endTake(take: Take): void {
  append(take, { type: 'take_ended' });
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
  await new File(picture.uri).move(dest);

  let cameraRoll = false;
  try {
    const perm = await MediaLibrary.getPermissionsAsync(true);
    const ok = perm.granted || (perm.canAskAgain && (await MediaLibrary.requestPermissionsAsync(true)).granted);
    if (ok) {
      await MediaLibrary.Asset.create(dest.uri);
      cameraRoll = true;
    }
  } catch (e) {
    console.warn('[take] camera roll save failed', e);
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
  });
  take.counts.frames += 1;
  if (meta.kind === 'work') take.counts.works += 1;
  if (meta.kind === 'venue_sign' || meta.kind === 'exterior') take.counts.venue_signs += 1;
  if (meta.kind === 'wall_text') take.counts.wall_texts += 1;
  return { id, file: dest, width: picture.width, height: picture.height };
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

/** The manifest file, for the share sheet. */
export function manifestFile(take: Take): File {
  return manifestOf(take.dir);
}

export function slugForVenueName(name: string): string {
  return slugify(name);
}
