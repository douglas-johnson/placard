import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useArrival } from '../../src/arrival';
import { slugify } from '../../src/registry';
import { Button, Field, H2, P, Screen, Sheet } from '../../src/ui';

/**
 * Somewhere the registry doesn't know. The venue the tester adds is a claim with
 * source `tester` and low confidence, and stays that way until someone checks it
 * against the institution (constraint 2).
 */
export default function AddVenue() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { arrival, update } = useArrival();
  const [name, setName] = useState(arrival.added?.name ?? '');
  const [website, setWebsite] = useState(arrival.added?.website ?? '');
  const fix = arrival.located?.fix ?? null;
  const nearbyAny = (arrival.located?.candidates.length ?? 0) > 0;

  const done = () => {
    const n = name.trim();
    update({
      venue: { slug: slugify(n), name: n, source: 'tester', distance_m: null },
      added: { name: n, website: website.trim() || null },
    });
    router.push('/start/log');
  };

  return (
    <Screen>
      <Sheet
        contentContainerStyle={[
          styles.sheet,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <H2>Where are you?</H2>
        <P muted>
          {fix
            ? 'Nothing in the registry is near this spot yet, which is how the registry grows.'
            : 'No position fix, so nothing to match against. Name the venue and carry on — the frames still get everything else.'}
        </P>
        <Field
          label="Venue name, as displayed"
          value={name}
          onChangeText={setName}
          placeholder="Museum of the City of New York"
          autoFocus
        />
        <Field
          label="Website, if you know it"
          value={website}
          onChangeText={setWebsite}
          placeholder="optional"
          autoCapitalize="none"
          keyboardType="url"
        />
        <Button
          label="This is it"
          onPress={done}
          disabled={name.trim().length < 2}
          style={{ marginTop: 24 }}
        />
        <Button
          label={nearbyAny ? 'Back to the list' : 'Not now'}
          tone="quiet"
          onPress={() => router.back()}
        />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: 28 },
});
