import { Redirect, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PastTakes } from '../src/screens/PastTakes';
import { UploadPanel } from '../src/screens/UploadPanel';
import { useCurrentTake } from '../src/session';
import { type, usePalette } from '../src/theme';
import { Button, H1, P, Rule, Screen } from '../src/ui';

/**
 * Where the app opens (#29). A visit left open when the app closed resumes at its
 * hub. Otherwise this: opening the app isn't arriving at a museum, so nothing here
 * locates or asks for location. That waits behind "Start a visit".
 */
export default function Landing() {
  const take = useCurrentTake();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const p = usePalette();
  if (take) return <Redirect href="/visit" />;
  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[
          styles.sheet,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <H1>Placard</H1>
        <P muted>At a museum? Start a visit, and what you photograph there stays together.</P>
        <Button
          label="Start a visit"
          onPress={() => router.push('/start')}
          style={{ marginTop: 24 }}
        />
        <Rule />
        <UploadPanel />
        <Rule />
        <PastTakes
          startOpen
          onOpen={(t) => router.push({ pathname: '/visits/[id]', params: { id: t.id } })}
        />
        <Pressable onPress={() => router.push('/settings')} hitSlop={8} style={{ marginTop: 24 }}>
          <Text style={[type.small, { color: p.muted }]}>Settings</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: 28 },
});
