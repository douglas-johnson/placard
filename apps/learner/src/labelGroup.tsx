import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as VisionOcr from '../modules/vision-ocr';
import { findAccessionCandidates, type Candidate } from './accession';
import { bySlug } from './registry';
import type { Picture } from './screens/Capture';
import {
  closeGroup,
  discardFrame,
  openGroup,
  recordAccession,
  recordOcr,
  saveFrame,
  type AccessionStatus,
  type GroupFlag,
  type HardCase,
  type NoWorkReason,
  type SavedFrame,
  type Take,
} from './take';

/**
 * One label group, as the routes under app/visit/label/ share it (#31). It lasts as
 * long as the tester is in that flow: the label layout provides it, and leaving the
 * flow drops it.
 *
 * The group itself opens on the first frame, not on entering the flow, so backing out
 * before shooting leaves no trace in the manifest.
 */

// Passes land near these longest-side sizes, whatever the sensor produced —
// the corpus tool's 1.0/1.6/2.4 on a ~1650px file is the same ladder (D21).
const OCR_TARGETS = [1600, 2600, 4000];

export type Accession = { status: AccessionStatus; reading: string | null; value: string | null };

type LabelGroup = {
  labelFrames: SavedFrame[];
  /** The best three accession candidates across the label frames, best first. */
  candidates: Candidate[];
  /** True while the last label frame is being saved and read. */
  reading: boolean;
  ocrNote: string | null;
  /**
   * The last label frame read as nothing at all — a floor, a plinth, a frame that
   * never focused (Met f0030, field-beta §6.1). The read-back offers the retake first.
   */
  lastEmpty: boolean;
  setLastEmpty: (v: boolean) => void;
  accession: Accession | null;
  works: number;
  crops: number;
  noWorkReason: NoWorkReason | null;
  setNoWorkReason: (r: NoWorkReason) => void;
  readLabel: (pic: Picture) => Promise<void>;
  retake: () => void;
  settle: (status: AccessionStatus, value: string | null) => void;
  saveCrop: (pic: Picture) => Promise<void>;
  saveWork: (pic: Picture) => Promise<void>;
  close: (detail: {
    flags: GroupFlag[];
    shared_panel_count: number | null;
    hard_cases: HardCase[];
    note: string | null;
  }) => void;
};

const LabelGroupContext = createContext<LabelGroup | null>(null);

export function useLabelGroup(): LabelGroup {
  const c = useContext(LabelGroupContext);
  if (!c) throw new Error('useLabelGroup outside app/visit/label/');
  return c;
}

// Development only: open the flow at a later step with stand-in readings, for looking
// at those screens in the simulator (the devroute marker in app/_layout.tsx).
let devSeed: 'readback' | 'flags' | null = null;
export function seedForDev(preset: 'readback' | 'flags'): void {
  if (__DEV__) devSeed = preset;
}

/** Stand-in readings for the read-back, once, then the seed is spent. */
function seededReadings(): Record<string, Candidate[]> {
  const seed = devSeed;
  devSeed = null;
  return seed === 'readback'
    ? {
        dev: [
          { value: '38.447.4', line: 7, contested: true, score: 3, disqualified: false },
          { value: '38.447-4', line: 7, contested: true, score: 0.2, disqualified: false },
        ],
      }
    : {};
}

export function LabelGroupProvider({ take, children }: { take: Take; children: ReactNode }) {
  const group = useRef<string | null>(null);
  const [labelFrames, setLabelFrames] = useState<SavedFrame[]>([]);
  // What the locator found in each label frame, by frame, so a retake can take one
  // frame's readings out again (D48). The read-back offers their union, best first.
  const [readings, setReadings] = useState<Record<string, Candidate[]>>(seededReadings);
  const candidates = useMemo(() => {
    const all = new Map<string, Candidate>();
    for (const found of Object.values(readings))
      for (const c of found)
        if (!all.has(c.value) || all.get(c.value)!.score < c.score) all.set(c.value, c);
    return [...all.values()].sort((a, b) => b.score - a.score).slice(0, 3);
  }, [readings]);
  const [reading, setReading] = useState(false);
  const [ocrNote, setOcrNote] = useState<string | null>(null);
  const [lastEmpty, setLastEmpty] = useState(false);
  const [accession, setAccession] = useState<Accession | null>(null);
  const [works, setWorks] = useState(0);
  const [crops, setCrops] = useState(0);
  const [noWorkReason, setNoWorkReason] = useState<NoWorkReason | null>(null);

  const ensureGroup = useCallback(() => {
    if (!group.current) group.current = openGroup(take);
    return group.current;
  }, [take]);

  // A: save, then read. The reading is a courtesy to the corpus as much as to the
  // tester — it's recorded whole, candidates or not, so the Mac can compare later.
  const readLabel = useCallback(
    async (pic: Picture) => {
      const g = ensureGroup();
      setReading(true);
      setOcrNote(null);
      try {
        const saved = await saveFrame(take, pic, { kind: 'label', group: g, gps: pic.gps });
        setLabelFrames((f) => [...f, saved]);
        if (!VisionOcr.isAvailable) {
          setLastEmpty(false);
          setOcrNote("This build can't read labels on the phone, so nothing to confirm here.");
          return;
        }
        const longest = Math.max(saved.width, saved.height) || 4000;
        const scales = OCR_TARGETS.map((t) => Math.round((t / longest) * 1000) / 1000);
        const languages = ['en-US'];
        const result = await VisionOcr.recognize(saved.file.uri, { scales, languages });
        const shapes = bySlug(take.venue.slug)?.shapes ?? [];
        const found = findAccessionCandidates(result.observations, shapes);
        recordOcr(take, {
          frame: saved.id,
          group: g,
          elapsed_ms: result.elapsedMs,
          scales,
          languages,
          lines: result.observations,
          warnings: result.warnings,
          candidates: found.map((c) => c.value),
        });
        setReadings((r) => ({ ...r, [saved.id]: found }));
        setLastEmpty(result.observations.length === 0);
        setOcrNote(
          result.observations.length === 0
            ? 'Nothing legible in that frame.'
            : `${result.observations.length} lines in ${result.elapsedMs} ms`,
        );
      } catch (e) {
        setOcrNote(e instanceof Error ? e.message : 'Reading failed');
      } finally {
        setReading(false);
      }
    },
    [ensureGroup, take],
  );

  // Retake: the frame on screen is thrown away, file and reading both (D48). A label
  // that won't fit in one frame is the other button, which keeps what's there.
  // Throws if the frame couldn't be removed, for the read-back to say so.
  const retake = useCallback(() => {
    const last = labelFrames[labelFrames.length - 1];
    if (last) {
      discardFrame(take, last.id);
      setLabelFrames((f) => f.slice(0, -1));
      setReadings(({ [last.id]: _gone, ...rest }) => rest);
    }
    setLastEmpty(false);
    setOcrNote(null);
  }, [labelFrames, take]);

  // Settling again after going back from the work appends another accession record,
  // and the later one governs (D51).
  const settle = useCallback(
    (status: AccessionStatus, value: string | null) => {
      const g = ensureGroup();
      const readingValue = candidates[0]?.value ?? null;
      setAccession({ status, reading: readingValue, value });
      recordAccession(take, {
        group: g,
        status,
        reading: readingValue,
        value,
        candidates: candidates.map((c) => c.value),
      });
    },
    [candidates, ensureGroup, take],
  );

  const saveCrop = useCallback(
    async (pic: Picture) => {
      await saveFrame(take, pic, { kind: 'accession_crop', group: ensureGroup(), gps: pic.gps });
      setCrops((n) => n + 1);
    },
    [ensureGroup, take],
  );

  const saveWork = useCallback(
    async (pic: Picture) => {
      await saveFrame(take, pic, { kind: 'work', group: ensureGroup(), gps: pic.gps });
      setWorks((n) => n + 1);
    },
    [ensureGroup, take],
  );

  const close = useCallback<LabelGroup['close']>(
    (detail) => {
      closeGroup(take, ensureGroup(), {
        frames: { label: labelFrames.length, work: works, accession_crop: crops },
        no_work_reason: works === 0 ? noWorkReason : null,
        ...detail,
      });
    },
    [take, ensureGroup, labelFrames.length, works, crops, noWorkReason],
  );

  const value: LabelGroup = {
    labelFrames,
    candidates,
    reading,
    ocrNote,
    lastEmpty,
    setLastEmpty,
    accession,
    works,
    crops,
    noWorkReason,
    setNoWorkReason,
    readLabel,
    retake,
    settle,
    saveCrop,
    saveWork,
    close,
  };
  return <LabelGroupContext.Provider value={value}>{children}</LabelGroupContext.Provider>;
}
