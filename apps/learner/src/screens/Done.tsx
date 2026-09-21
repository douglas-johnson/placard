import { ScrollView, StyleSheet, Text } from 'react-native';
import { useInsets } from '../insets';
import { shareManifest } from '../share';
import type { Take } from '../take';
import { type, usePalette } from '../theme';
import { Button, H1, P, Rule, Screen } from '../ui';

/**
 * The end of a visit. One job: get the manifest off the phone while the visit is
 * still the thing on screen. Before this existed, the exterior shot dropped straight
 * to Arrive and the manifest was unreachable (field-beta §6.1).
 */
export function Done({ take, onClose }: { take: Take; onClose: () => void }) {
  const p = usePalette();
  const insets = useInsets();
  const c = take.counts;
  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.sheet, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <H1>That's the visit</H1>
        <P muted>
          {take.venue.name} · {c.labels} {c.labels === 1 ? 'label' : 'labels'}, {c.works} {c.works === 1 ? 'work' : 'works'},{' '}
          {c.wall_texts} wall text, {c.venue_signs} {c.venue_signs === 1 ? 'sign' : 'signs'}.
        </P>
        <Rule />
        <P>
          The frames are in the camera roll. The manifest is what says which is which —
          AirDrop it to the Mac now, or it's a tap away under earlier visits.
        </P>
        <Button label="Share the manifest" onPress={() => shareManifest(take)} style={{ marginTop: 20 }} />
        <Button label="Done" tone="secondary" onPress={onClose} />
        <Text style={[type.small, { color: p.pending, marginTop: 24 }]}>{take.id}</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: 28 },
});
