import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as VisionOcr from '../../modules/vision-ocr';
import { findAccessionCandidates, type Candidate } from '../accession';
import { useInsets } from '../insets';
import { bySlug } from '../registry';
import {
  closeGroup,
  HARD_CASES,
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
} from '../take';
import { type, usePalette } from '../theme';
import { Button, Chip, ChipRow, Field, H2, P, Rule, Screen } from '../ui';
import { Capture, type Picture } from './Capture';

/**
 * One label group, start to finish (field-beta §2.2, protocol v2):
 *
 *   A  the label            → read on device, accession shown back for confirmation
 *   C  the accession crop   → only offered when A read nothing accession-shaped
 *   B  the work(s)          → at least one, or a stated reason there isn't one
 *      flags & hard cases   → said at the moment, by the person who was there
 *
 * The group is opened on the first frame, not on entering the screen, so backing
 * out before shooting leaves no trace in the manifest.
 */

type Step = 'label' | 'reading' | 'readback' | 'crop' | 'work' | 'noWork' | 'flags';

// Passes land near these longest-side sizes, whatever the sensor produced —
// the corpus tool's 1.0/1.6/2.4 on a ~1650px file is the same ladder (D21).
const OCR_TARGETS = [1600, 2600, 4000];

const NO_WORK_REASONS: { value: NoWorkReason; label: string }[] = [
  { value: 'photography_prohibited', label: 'Photography prohibited' },
  { value: 'case_many_objects', label: "It's a case of many objects" },
  { value: 'building_or_site', label: "It's a building or a site" },
  { value: 'other', label: 'Something else' },
];

const FLAGS: { value: GroupFlag; label: string }[] = [
  { value: 'shared_panel', label: 'Shared panel — governs several works' },
  { value: 'case_panel_mixed_ownership', label: 'Case panel — mixed ownership' },
  { value: 'loan_no_accession', label: 'Loan — no accession' },
  { value: 'loan_lenders_accession', label: "Loan — lender's accession" },
];

const HARD_CASE_LABELS: Record<HardCase, string> = {
  reflective_glass: 'Reflective glass',
  low_light: 'Low light',
  bilingual: 'Bilingual',
  non_latin_script: 'Non-Latin script',
  vinyl_lettering: 'Vinyl lettering',
  oblique_angle: 'Oblique angle',
  attribution_qualifier: 'Attribution qualifier',
  not_an_artwork: 'Not an artwork',
  gallery_checklist: 'Gallery checklist',
};

export function LabelFlow({
  take,
  onDone,
  onCancel,
  devPreset,
}: {
  take: Take;
  onDone: () => void;
  onCancel: () => void;
  /** Development only: open at a later step with stand-in candidates, for looking at the screens in the simulator. */
  devPreset?: 'readback' | 'flags';
}) {
  const p = usePalette();
  const insets = useInsets();
  const [step, setStep] = useState<Step>(__DEV__ && devPreset ? devPreset : 'label');
  const [group, setGroup] = useState<string | null>(null);
  const [labelFrames, setLabelFrames] = useState<SavedFrame[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>(
    __DEV__ && devPreset === 'readback'
      ? [
          { value: '38.447.4', line: 7, contested: true, score: 3 },
          { value: '38.447-4', line: 7, contested: true, score: 0.2 },
        ]
      : [],
  );
  const [ocrNote, setOcrNote] = useState<string | null>(null);
  // The last label frame read as nothing at all — a floor, a plinth, a frame that
  // never focused (Met f0030, field-beta §6.1). Offer the retake before any confirm.
  const [lastEmpty, setLastEmpty] = useState(false);
  const [accession, setAccession] = useState<{ status: AccessionStatus; reading: string | null; value: string | null } | null>(null);
  const [typed, setTyped] = useState('');
  const [typing, setTyping] = useState(false);
  const [works, setWorks] = useState(0);
  const [crops, setCrops] = useState(0);
  const [noWorkReason, setNoWorkReason] = useState<NoWorkReason | null>(null);
  const [flags, setFlags] = useState<GroupFlag[]>([]);
  const [sharedCount, setSharedCount] = useState(2);
  const [hardCases, setHardCases] = useState<HardCase[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const ensureGroup = useCallback(() => {
    if (group) return group;
    const g = openGroup(take);
    setGroup(g);
    return g;
  }, [group, take]);

  // A: save, then read. The reading is a courtesy to the corpus as much as to the
  // tester — it's recorded whole, candidates or not, so the Mac can compare later.
  const onLabel = useCallback(
    async (pic: Picture) => {
      const g = ensureGroup();
      setBusy(true);
      setStep('reading');
      try {
        const saved = await saveFrame(take, pic, { kind: 'label', group: g, gps: pic.gps });
        setLabelFrames((f) => [...f, saved]);
        if (!VisionOcr.isAvailable) {
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
        // Union with earlier label frames of the same group, best first.
        setCandidates((prev) => {
          const all = new Map(prev.map((c) => [c.value, c]));
          for (const c of found) if (!all.has(c.value) || all.get(c.value)!.score < c.score) all.set(c.value, c);
          return [...all.values()].sort((a, b) => b.score - a.score).slice(0, 3);
        });
        setLastEmpty(result.observations.length === 0);
        setOcrNote(
          result.observations.length === 0
            ? 'Nothing legible in that frame.'
            : `${result.observations.length} lines in ${result.elapsedMs} ms`,
        );
      } catch (e) {
        setOcrNote(e instanceof Error ? e.message : 'Reading failed');
      } finally {
        setBusy(false);
        setStep('readback');
      }
    },
    [ensureGroup, take],
  );

  const settle = useCallback(
    (status: AccessionStatus, value: string | null) => {
      const g = ensureGroup();
      const reading = candidates[0]?.value ?? null;
      const a = { status, reading, value };
      setAccession(a);
      recordAccession(take, { group: g, status, reading, value, candidates: candidates.map((c) => c.value) });
      setTyping(false);
      setStep('work');
    },
    [candidates, ensureGroup, take],
  );

  const onCrop = useCallback(
    async (pic: Picture) => {
      setBusy(true);
      try {
        await saveFrame(take, pic, { kind: 'accession_crop', group: ensureGroup(), gps: pic.gps });
        setCrops((n) => n + 1);
      } finally {
        setBusy(false);
        setStep('readback');
      }
    },
    [ensureGroup, take],
  );

  const onWork = useCallback(
    async (pic: Picture) => {
      setBusy(true);
      try {
        await saveFrame(take, pic, { kind: 'work', group: ensureGroup(), gps: pic.gps });
        setWorks((n) => n + 1);
      } finally {
        setBusy(false);
      }
    },
    [ensureGroup, take],
  );

  const finish = useCallback(() => {
    const g = ensureGroup();
    closeGroup(take, g, {
      frames: { label: labelFrames.length, work: works, accession_crop: crops },
      no_work_reason: works === 0 ? noWorkReason : null,
      flags,
      shared_panel_count: flags.includes('shared_panel') ? sharedCount : null,
      hard_cases: hardCases,
      note: note.trim() || null,
    });
    onDone();
  }, [ensureGroup, take, labelFrames.length, works, crops, noWorkReason, flags, sharedCount, hardCases, note, onDone]);

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  // ---- screens ------------------------------------------------------------

  if (step === 'label') {
    return (
      <Capture
        title={labelFrames.length === 0 ? 'A · The label' : 'A · The label, continued'}
        hint="Whole label, filling the frame, square-on. This is the shot that matters."
        busy={busy}
        onPicture={onLabel}
        onBack={labelFrames.length === 0 ? onCancel : () => setStep('readback')}
        backLabel={labelFrames.length === 0 ? 'Cancel' : 'Back'}
      />
    );
  }

  if (step === 'reading') {
    const last = labelFrames[labelFrames.length - 1];
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
          {last ? <Image source={{ uri: last.file.uri }} style={styles.thumb} /> : null}
          <ActivityIndicator color={p.text} style={{ marginTop: 24 }} />
          <P muted>Reading the label…</P>
        </View>
      </Screen>
    );
  }

  if (step === 'readback') {
    const top = candidates[0];
    const last = labelFrames[labelFrames.length - 1];
    return (
      <Screen>
        <ScrollView contentContainerStyle={[styles.sheet, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
          {last ? <Image source={{ uri: last.file.uri }} style={styles.thumbSmall} /> : null}
          {lastEmpty && !typing ? (
            <>
              <H2>Nothing read in that frame</H2>
              <P muted>
                Not a single line — usually the camera hadn't focused, or the label isn't in the
                shot. The frame is kept either way. Another go?
              </P>
              <Button label="Retake the label" onPress={() => { setLastEmpty(false); setStep('label'); }} style={{ marginTop: 20 }} />
              <Button label="Carry on with this frame" tone="quiet" onPress={() => setLastEmpty(false)} />
            </>
          ) : top && !typing ? (
            <>
              <H2>Is this the accession number?</H2>
              <Text style={[type.mono, { color: p.text, fontSize: 28, marginTop: 8 }]}>{top.value}</Text>
              {top.contested ? (
                <P muted>Read differently at different sizes — worth a close look.</P>
              ) : null}
              {candidates.length > 1 ? (
                <>
                  <P muted>Or one of these:</P>
                  <ChipRow>
                    {candidates.slice(1).map((c) => (
                      <Chip key={c.value} label={c.value} on={false} onPress={() => settle('confirmed', c.value)} />
                    ))}
                  </ChipRow>
                </>
              ) : null}
              <Button label="Yes, that's it" onPress={() => settle('confirmed', top.value)} style={{ marginTop: 20 }} />
              <Button label="It's different — let me type it" tone="secondary" onPress={() => { setTyped(top.value); setTyping(true); }} />
              <Button label="There's no accession on this label" tone="quiet" onPress={() => settle('none', null)} />
            </>
          ) : (
            <>
              <H2>{typing ? 'What does it say?' : "I couldn't find an accession number"}</H2>
              {!typing ? (
                <P muted>
                  {ocrNote ?? 'Nothing accession-shaped in the reading.'} If the line is tiny or
                  low-contrast, a tight crop helps; if there just isn't one, say so — that's
                  data too.
                </P>
              ) : null}
              <Field
                label="Accession number"
                value={typed}
                onChangeText={setTyped}
                autoCapitalize="characters"
                autoCorrect={false}
                autoFocus={typing}
                placeholder="e.g. 56.323.46"
              />
              <Button
                label="That's the number"
                onPress={() => settle(top ? 'corrected' : 'confirmed', typed.trim())}
                disabled={typed.trim().length === 0}
                style={{ marginTop: 20 }}
              />
              {!typing && !top ? (
                <Button label="C · Get closer on the number" tone="secondary" onPress={() => setStep('crop')} />
              ) : null}
              <Button label="There's no accession on this label" tone="quiet" onPress={() => settle('none', null)} />
              {!top && !typing ? (
                <Button label="Skip — I'll sort it out later" tone="quiet" onPress={() => settle('unread', null)} />
              ) : null}
              {typing ? <Button label="Back" tone="quiet" onPress={() => setTyping(false)} /> : null}
            </>
          )}
          <Rule />
          <Button label="The label needed another frame" tone="quiet" onPress={() => setStep('label')} />
          {ocrNote && top ? <Text style={[type.small, { color: p.muted, marginTop: 12 }]}>{ocrNote}</Text> : null}
        </ScrollView>
      </Screen>
    );
  }

  if (step === 'crop') {
    return (
      <Capture
        title="C · The accession line"
        hint="Tight on the number. Only because the full frame didn't read it."
        busy={busy}
        onPicture={onCrop}
        onBack={() => setStep('readback')}
      />
    );
  }

  if (step === 'work') {
    return (
      <Capture
        title={works === 0 ? 'B · The work' : `B · Another work (${works} so far)`}
        hint="One frame per object this label governs. Shoot again for the next; Done when there are no more."
        busy={busy}
        onPicture={onWork}
        onBack={() => setStep('readback')}
        actions={
          works === 0
            ? [{ label: 'No work photo…', onPress: () => setStep('noWork'), tone: 'quiet' }]
            : [{ label: 'Done', onPress: () => setStep('flags') }]
        }
      >
        {accession?.value ? (
          <View style={styles.badge}>
            <Text style={[type.mono, { color: '#F2EFE9' }]}>{accession.value}</Text>
          </View>
        ) : null}
      </Capture>
    );
  }

  if (step === 'noWork') {
    return (
      <Screen>
        <ScrollView contentContainerStyle={[styles.sheet, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}>
          <H2>No work photo — why?</H2>
          <P muted>The reason is worth as much as the frame would have been.</P>
          <ChipRow>
            {NO_WORK_REASONS.map((r) => (
              <Chip key={r.value} label={r.label} on={noWorkReason === r.value} onPress={() => setNoWorkReason(r.value)} />
            ))}
          </ChipRow>
          <Button label="Continue" onPress={() => setStep('flags')} disabled={!noWorkReason} style={{ marginTop: 20 }} />
          <Button label="Actually, I can shoot it" tone="quiet" onPress={() => setStep('work')} />
        </ScrollView>
      </Screen>
    );
  }

  // flags
  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.sheet, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <H2>Anything unusual about this one?</H2>
        <P muted>Skip straight to Close if not — most labels are ordinary, and that's fine.</P>
        <ChipRow>
          {FLAGS.map((f) => (
            <Chip key={f.value} label={f.label} on={flags.includes(f.value)} onPress={() => setFlags((l) => toggle(l, f.value))} />
          ))}
        </ChipRow>
        {flags.includes('shared_panel') ? (
          <View style={styles.stepper}>
            <Text style={[type.body, { color: p.text }]}>Governs the next</Text>
            <Button label="−" tone="secondary" onPress={() => setSharedCount((n) => Math.max(1, n - 1))} style={styles.stepBtn} />
            <Text style={[type.mono, { color: p.text }]}>{sharedCount}</Text>
            <Button label="+" tone="secondary" onPress={() => setSharedCount((n) => n + 1)} style={styles.stepBtn} />
            <Text style={[type.body, { color: p.text }]}>works</Text>
          </View>
        ) : null}
        <Rule />
        <Text style={[type.small, { color: p.muted }]}>Hard case — say so now, while you remember why</Text>
        <ChipRow>
          {HARD_CASES.map((h) => (
            <Chip key={h} label={HARD_CASE_LABELS[h]} on={hardCases.includes(h)} onPress={() => setHardCases((l) => toggle(l, h))} />
          ))}
        </ChipRow>
        <Field label="Note" value={note} onChangeText={setNote} placeholder="Anything the frames won't show" multiline />
        <Button label="Close this label" onPress={finish} style={{ marginTop: 24 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: 28 },
  thumb: { width: 220, height: 220, borderRadius: 8 },
  thumbSmall: { width: 96, height: 96, borderRadius: 6, marginBottom: 16 },
  badge: {
    position: 'absolute',
    top: 150,
    right: 16,
    backgroundColor: 'rgba(20,19,17,0.72)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  stepBtn: { paddingVertical: 6, paddingHorizontal: 14, marginTop: 0 },
});
