import * as MediaLibrary from 'expo-media-library';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useArrival } from '../../src/arrival';
import { setCurrentTake } from '../../src/session';
import { startTake, type FieldLog } from '../../src/take';
import { type, usePalette } from '../../src/theme';
import { Button, Chip, ChipRow, Field, H2, P, Rule, Screen, Sheet } from '../../src/ui';

const FREE_VIA = ['Always free', 'Free day', 'Library pass', 'Paid', 'Member'];
const PHOTOGRAPHY: { value: FieldLog['photography']; label: string }[] = [
  { value: 'permitted', label: 'Permitted' },
  { value: 'permanent_only', label: 'Permanent collection only' },
  { value: 'prohibited', label: 'Prohibited' },
  { value: 'unknown', label: "Didn't see a sign" },
];

/** The thirty-second field log, then the visit starts. */
export default function Log() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { arrival } = useArrival();
  const [freeVia, setFreeVia] = useState<string | null>(null);
  const [freeViaOther, setFreeViaOther] = useState('');
  const [photography, setPhotography] = useState<FieldLog['photography']>('unknown');
  const [notes, setNotes] = useState('');

  const venue = arrival.venue;
  if (!venue) return <Redirect href="/start" />;

  const start = () => {
    // Ask for the camera roll now, at the door, rather than over the first label.
    // Add-only access; the app never reads the library (D7).
    MediaLibrary.requestPermissionsAsync(true).catch(() => {});
    const take = startTake({
      venue,
      fix: arrival.located?.fix ?? null,
      fieldLog: {
        free_via: freeVia === 'Other' ? freeViaOther.trim() || null : freeVia,
        photography,
        notes: notes.trim() || null,
      },
      addedVenue: arrival.added ?? undefined,
    });
    setCurrentTake(take);
    // The visit takes the start flow's place, so nothing goes back to the venue
    // picker. Signage opens with the hub beneath it: `withAnchor` is what makes the
    // visit layout's initialRouteName apply to a navigation call.
    router.replace('/visit/signage', { withAnchor: true });
  };

  return (
    <Screen>
      <Sheet
        contentContainerStyle={[
          styles.sheet,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <H2>{venue.name}</H2>
        <P muted>Thirty seconds of field log, then the door.</P>
        <Rule />
        <Text style={[type.small, { color: p.muted }]}>How did you get in?</Text>
        <ChipRow>
          {[...FREE_VIA, 'Other'].map((f) => (
            <Chip key={f} label={f} on={freeVia === f} onPress={() => setFreeVia(f)} />
          ))}
        </ChipRow>
        {freeVia === 'Other' ? (
          <Field label="How?" value={freeViaOther} onChangeText={setFreeViaOther} />
        ) : null}
        <Text style={[type.small, { color: p.muted, marginTop: 16 }]}>Photography</Text>
        <ChipRow>
          {PHOTOGRAPHY.map((o) => (
            <Chip
              key={o.value}
              label={o.label}
              on={photography === o.value}
              onPress={() => setPhotography(o.value)}
            />
          ))}
        </ChipRow>
        <Field
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Bilingual labels; vinyl in the lobby; checklist at the desk…"
          multiline
        />
        <Button label="Start" onPress={start} style={{ marginTop: 24 }} />
        <Button label="Different venue" tone="quiet" onPress={() => router.back()} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: 28 },
});
