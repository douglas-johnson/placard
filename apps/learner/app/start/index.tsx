import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useArrival } from '../../src/arrival';
import { awaitFix } from '../../src/location';
import { nearby } from '../../src/registry';
import { type, usePalette } from '../../src/theme';
import { Button, H2, P, Screen } from '../../src/ui';

/** Locating, then the registry venues near the fix. With none near, straight to adding one. */
export default function Nearby() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { arrival, update } = useArrival();
  const located = arrival.located;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fix = await awaitFix();
      if (cancelled) return;
      const candidates = fix ? nearby(fix) : [];
      update({ located: { fix, candidates } });
      if (candidates.length === 0) router.replace('/start/add');
    })();
    return () => {
      cancelled = true;
    };
    // Once, on arriving at the door.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pad = { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 };

  if (!located || located.candidates.length === 0) {
    return (
      <Screen>
        <View style={[styles.center, pad]}>
          <ActivityIndicator color={p.text} />
          <P muted>Working out where you are…</P>
          <Button label="Cancel" tone="quiet" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.sheet, pad]}>
        <H2>Where are you?</H2>
        <P muted>Looks like you're near:</P>
        <View style={{ marginTop: 12 }}>
          {located.candidates.map((c) => (
            <Pressable
              key={c.venue.slug}
              onPress={() => {
                update({
                  venue: {
                    slug: c.venue.slug,
                    name: c.venue.name,
                    source: 'registry',
                    distance_m: Math.round(c.distance),
                  },
                  added: null,
                });
                router.push('/start/log');
              }}
              style={({ pressed }) => [
                styles.row,
                { borderColor: p.rule, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Text style={[type.body, styles.name, { color: p.text, fontWeight: '600' }]}>
                {c.venue.name}
              </Text>
              <Text style={[type.small, { color: p.muted }]}>{Math.round(c.distance)} m</Text>
            </Pressable>
          ))}
        </View>
        <Button
          label="Somewhere else"
          tone="secondary"
          onPress={() => router.push('/start/add')}
          style={{ marginTop: 20 }}
        />
        <Button label="Not now" tone="quiet" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: 28 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  row: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  // Shrinks and wraps, so a long name never pushes the distance off the screen.
  name: { flex: 1, marginRight: 16 },
});
