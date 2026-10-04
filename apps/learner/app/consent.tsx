import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type, usePalette } from '../src/theme';
import { Button, H2, P, Screen } from '../src/ui';
import { agreeAndSend, CONSENT_VERSION, contributor, consented } from '../src/upload';

/**
 * The terms of sending (field-beta §1, D50), shown before sending is turned on, and
 * again whenever they change. Every clause is something the tester agrees to, so a
 * change to any of them is a new CONSENT_VERSION (upload.ts).
 *
 * One "Send them" for all three kinds the screen names (D50). The phone records them
 * as three properties anyway, so they can be split later.
 */
export default function ConsentScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const earlier = contributor().consent;
  const changed = earlier != null && earlier.version !== CONSENT_VERSION;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[
          styles.sheet,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <H2>Sending your visits</H2>
        {changed ? <P muted>These have changed since you last agreed to them.</P> : null}
        <Clause>
          From your next visit on, the <B>labels</B>, <B>works</B> and <B>venue signs</B> you
          photograph go to a shared research corpus that other people work from.
        </Clause>
        <Clause>The photos stay in a private store. They aren't published.</Clause>
        <Clause>
          What's read from the labels is published, under CC BY 4.0: anyone can reuse it, with
          credit to Placard.
        </Clause>
        <Clause>Faces are blurred on the phone before anything is sent.</Clause>
        <Clause>
          Nothing about you goes with them, only a random ID this phone made up:{' '}
          <Text style={[type.mono, { fontSize: 15, color: p.text }]}>{contributor().id}</Text>.
        </Clause>
        <Clause>Visits already on the phone stay here.</Clause>
        <Clause>
          You can stop sending any time in Settings. What has already been sent stays in the corpus.
          Ask Doug if something needs to come out.
        </Clause>
        <Button
          label={contributor().upload && consented() ? 'Keep sending' : 'Send them'}
          onPress={() => {
            agreeAndSend();
            router.back();
          }}
          style={{ marginTop: 28 }}
        />
        <Button label="Not now" tone="quiet" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}

function Clause({ children }: { children: React.ReactNode }) {
  const p = usePalette();
  return (
    <View style={styles.clause}>
      <Text style={[type.body, { color: p.text }]}>{children}</Text>
    </View>
  );
}

function B({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontWeight: '600' }}>{children}</Text>;
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: 28 },
  clause: { marginTop: 14 },
});
