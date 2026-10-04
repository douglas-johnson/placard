import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLabelGroup } from '../../../src/labelGroup';
import { HARD_CASES, type GroupFlag, type HardCase } from '../../../src/take';
import { type, usePalette } from '../../../src/theme';
import { Button, Chip, ChipRow, Field, H2, P, Rule, Screen, Sheet } from '../../../src/ui';

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

const toggle = <T,>(list: T[], v: T) =>
  list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

/** Flags, hard cases and a note, said at the moment by the person who was there; then the group closes. */
export default function Flags() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const g = useLabelGroup();
  const [flags, setFlags] = useState<GroupFlag[]>([]);
  const [sharedCount, setSharedCount] = useState(2);
  const [hardCases, setHardCases] = useState<HardCase[]>([]);
  const [note, setNote] = useState('');

  return (
    <Screen>
      <Sheet
        contentContainerStyle={[
          styles.sheet,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <H2>Anything unusual about this one?</H2>
        <P muted>Skip straight to Close if not — most labels are ordinary, and that's fine.</P>
        <ChipRow>
          {FLAGS.map((f) => (
            <Chip
              key={f.value}
              label={f.label}
              on={flags.includes(f.value)}
              onPress={() => setFlags((l) => toggle(l, f.value))}
            />
          ))}
        </ChipRow>
        {flags.includes('shared_panel') ? (
          <View style={styles.stepper}>
            <Text style={[type.body, { color: p.text }]}>Governs the next</Text>
            <Button
              label="−"
              tone="secondary"
              onPress={() => setSharedCount((n) => Math.max(1, n - 1))}
              style={styles.stepBtn}
            />
            <Text style={[type.mono, { color: p.text }]}>{sharedCount}</Text>
            <Button
              label="+"
              tone="secondary"
              onPress={() => setSharedCount((n) => n + 1)}
              style={styles.stepBtn}
            />
            <Text style={[type.body, { color: p.text }]}>works</Text>
          </View>
        ) : null}
        <Rule />
        <Text style={[type.small, { color: p.muted }]}>
          Hard case — say so now, while you remember why
        </Text>
        <ChipRow>
          {HARD_CASES.map((h) => (
            <Chip
              key={h}
              label={HARD_CASE_LABELS[h]}
              on={hardCases.includes(h)}
              onPress={() => setHardCases((l) => toggle(l, h))}
            />
          ))}
        </ChipRow>
        <Field
          label="Note"
          value={note}
          onChangeText={setNote}
          placeholder="Anything the frames won't show"
          multiline
        />
        <Button
          label="Close this label"
          onPress={() => {
            g.close({
              flags,
              shared_panel_count: flags.includes('shared_panel') ? sharedCount : null,
              hard_cases: hardCases,
              note: note.trim() || null,
            });
            router.dismissTo('/visit');
          }}
          style={{ marginTop: 24 }}
        />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: 28 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  stepBtn: { paddingVertical: 6, paddingHorizontal: 14, marginTop: 0 },
});
