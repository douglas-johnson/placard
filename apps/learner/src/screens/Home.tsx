import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useInsets } from '../insets';
import { shareManifest } from '../share';
import type { Take } from '../take';
import { type, usePalette } from '../theme';
import { Button, H1, P, Rule, Screen } from '../ui';
import { PastTakes } from './PastTakes';

export type Input = 'venue' | 'label' | 'wall_text' | 'exterior';

/**
 * The hub for a visit in progress. Three inputs, one button each (field-beta §2),
 * and counts that only go up — never a denominator (constraint 5): there is no
 * "labels remaining" in a museum.
 */
export function Home({
  take,
  onInput,
  onPreflight,
}: {
  take: Take;
  onInput: (input: Input) => void;
  onPreflight: () => void;
}) {
  const p = usePalette();
  const insets = useInsets();
  const since = new Date(take.started).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const c = take.counts;

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.sheet, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <H1>{take.venue.name}</H1>
        <P muted>
          Since {since}
          {take.venue.source === 'tester' ? ' · added by you, unverified' : ''}
        </P>

        <View style={styles.counts}>
          <Count n={c.labels} label={c.labels === 1 ? 'label' : 'labels'} />
          <Count n={c.works} label={c.works === 1 ? 'work' : 'works'} />
          <Count n={c.venue_signs} label={c.venue_signs === 1 ? 'sign' : 'signs'} />
          <Count n={c.wall_texts} label="wall text" />
        </View>

        <Rule />

        <Big title="Label" hint="A label, the work it governs, the number read back" onPress={() => onInput('label')} />
        <Big title="Wall text" hint="The interpretive panel — a different kind of photo" onPress={() => onInput('wall_text')} />
        <Big title="Venue signage" hint="Name, hours and admission, the accessible entrance" onPress={() => onInput('venue')} />

        <Rule />

        <Button label="Share the manifest" tone="secondary" onPress={() => shareManifest(take)} />
        <Button label="Leaving — shoot the exterior" tone="secondary" onPress={() => onInput('exterior')} />

        <Rule />
        <PastTakes except={take.id} />
        <Pressable onPress={onPreflight} hitSlop={8} style={{ marginTop: 20 }}>
          <Text style={[type.small, { color: p.muted }]}>Check this build</Text>
        </Pressable>
        <Text style={[type.small, { color: p.pending, marginTop: 12 }]}>{take.id}</Text>
      </ScrollView>
    </Screen>
  );
}

function Count({ n, label }: { n: number; label: string }) {
  const p = usePalette();
  return (
    <View style={styles.count}>
      <Text style={[type.title, { color: p.text, fontSize: 30, fontVariant: ['lining-nums', 'tabular-nums'] }]}>{n}</Text>
      <Text style={[type.small, { color: p.muted }]}>{label}</Text>
    </View>
  );
}

function Big({ title, hint, onPress }: { title: string; hint: string; onPress: () => void }) {
  const p = usePalette();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.big, { backgroundColor: p.card, opacity: pressed ? 0.65 : 1 }]}>
      <Text style={[type.h2, { color: p.text }]}>{title}</Text>
      <Text style={[type.small, { color: p.muted, marginTop: 4 }]}>{hint}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: 28 },
  counts: { flexDirection: 'row', marginTop: 20 },
  count: { marginRight: 28 },
  big: { paddingVertical: 18, paddingHorizontal: 18, borderRadius: 12, marginBottom: 12 },
});
