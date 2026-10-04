import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UploadPanel } from '../src/screens/UploadPanel';
import { type, usePalette } from '../src/theme';
import { Button, H2, P, Rule, Screen } from '../src/ui';
import { contributor, setUploading, useUploadStatus } from '../src/upload';

/**
 * Settings (#30): sending on or off, the ID this phone sends as, and the build check.
 * Reached from the landing and the hub. Turning sending on goes through the consent
 * screen, which holds the terms (D50); here it's one line.
 */
export default function Settings() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const s = useUploadStatus();
  const on = s.state !== 'off' && s.state !== 'unavailable';

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[
          styles.sheet,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <H2>Settings</H2>

        {s.state === 'unavailable' ? (
          <P muted>This build has nowhere to send photos. Share the manifest instead.</P>
        ) : (
          <>
            <View style={styles.row}>
              <Text style={[type.body, styles.label, { color: p.text }]}>
                Send visits to the corpus
              </Text>
              <Switch
                value={on}
                onValueChange={(v) => (v ? router.push('/consent') : setUploading(false))}
              />
            </View>
            <P muted>
              Labels, works and venue signs, to a shared research corpus.
              {s.state === 'consent' ? null : (
                <>
                  {' '}
                  <Text
                    style={{ textDecorationLine: 'underline' }}
                    onPress={() => router.push('/consent')}
                  >
                    The terms
                  </Text>
                </>
              )}
            </P>
            {s.state === 'consent' ? (
              <>
                <P>Sending is paused until you've read the terms.</P>
                <Button
                  label="Read the terms"
                  tone="secondary"
                  onPress={() => router.push('/consent')}
                  style={{ marginTop: 12 }}
                />
              </>
            ) : (
              <View style={{ marginTop: 12 }}>
                <UploadPanel />
              </View>
            )}
            <Rule />
            <Text style={[type.small, { color: p.muted }]}>This phone sends as</Text>
            <Text style={[type.mono, { color: p.text, marginTop: 4 }]} selectable>
              {contributor().id}
            </Text>
            <P muted>
              A random ID the phone made up. It's the only thing that goes with your photos, and
              it's how to find yours in the corpus.
            </P>
          </>
        )}

        <Rule />
        <Pressable onPress={() => router.push('/preflight')} hitSlop={8}>
          <Text style={[type.body, { color: p.text }]}>Check this build</Text>
        </Pressable>
        <Button label="Back" tone="quiet" onPress={() => router.back()} style={{ marginTop: 20 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: 28 },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  label: { flex: 1, marginRight: 16 },
});
