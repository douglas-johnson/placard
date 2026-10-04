import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLabelGroup } from '../../../src/labelGroup';
import type { AccessionStatus } from '../../../src/take';
import { type, usePalette } from '../../../src/theme';
import { Button, Chip, ChipRow, Field, H2, P, Rule, Screen, Sheet } from '../../../src/ui';

/**
 * The accession, read on the phone and shown back for confirmation (§4.3, D11): the
 * locator offers, the person standing at the label decides. While the frame is still
 * being read this is the loading state, so Back never lands on a spinner.
 */
export default function Readback() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const g = useLabelGroup();
  const [typed, setTyped] = useState('');
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const top = g.candidates[0];
  const last = g.labelFrames[g.labelFrames.length - 1];

  if (g.reading) {
    return (
      <Screen>
        <View style={styles.center}>
          {last ? <Image source={{ uri: last.file.uri }} style={styles.thumb} /> : null}
          <ActivityIndicator color={p.text} style={{ marginTop: 24 }} />
          <P muted>Reading the label…</P>
        </View>
      </Screen>
    );
  }

  const settle = (status: AccessionStatus, value: string | null) => {
    g.settle(status, value);
    setTyping(false);
    router.push('/visit/label/work');
  };

  // Back to the camera: the frame on screen is thrown away first (D48).
  const retake = () => {
    try {
      g.retake();
    } catch (e) {
      setError(`Couldn't throw that frame away: ${e instanceof Error ? e.message : e}`);
      return;
    }
    setError(null);
    setTyping(false);
    router.back();
  };

  return (
    <Screen>
      <Sheet
        contentContainerStyle={[
          styles.sheet,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 },
        ]}
      >
        {last ? (
          <View style={styles.shot}>
            <Image source={{ uri: last.file.uri }} style={styles.thumbSmall} />
            {!g.lastEmpty ? (
              <Button label="Retake" tone="secondary" onPress={retake} style={styles.retake} />
            ) : null}
          </View>
        ) : null}
        {error ? (
          <Text style={[type.small, { color: p.fail, marginBottom: 12 }]}>{error}</Text>
        ) : null}
        {g.lastEmpty && !typing ? (
          <>
            <H2>Nothing read in that frame</H2>
            <P muted>
              Not a single line — usually the camera hadn't focused, or the label isn't in the shot.
              Another go?
            </P>
            <Button label="Retake" onPress={retake} style={{ marginTop: 20 }} />
            <Button
              label="Carry on with this frame"
              tone="quiet"
              onPress={() => g.setLastEmpty(false)}
            />
          </>
        ) : top && !typing ? (
          <>
            <H2>Is this the accession number?</H2>
            <Text style={[type.mono, { color: p.text, fontSize: 28, marginTop: 8 }]}>
              {top.value}
            </Text>
            {top.contested ? (
              <P muted>Read differently at different sizes — worth a close look.</P>
            ) : null}
            {g.candidates.length > 1 ? (
              <>
                <P muted>Or one of these:</P>
                <ChipRow>
                  {g.candidates.slice(1).map((c) => (
                    <Chip
                      key={c.value}
                      label={c.value}
                      on={false}
                      onPress={() => settle('confirmed', c.value)}
                    />
                  ))}
                </ChipRow>
              </>
            ) : null}
            <Button
              label="Yes, that's it"
              onPress={() => settle('confirmed', top.value)}
              style={{ marginTop: 20 }}
            />
            <Button
              label="It's different — let me type it"
              tone="secondary"
              onPress={() => {
                setTyped(top.value);
                setTyping(true);
              }}
            />
            <Button
              label="There's no accession on this label"
              tone="quiet"
              onPress={() => settle('none', null)}
            />
          </>
        ) : (
          <>
            <H2>{typing ? 'What does it say?' : "I couldn't find an accession number"}</H2>
            {!typing ? (
              <P muted>
                {g.ocrNote ?? 'Nothing accession-shaped in the reading.'} If the line is tiny or
                low-contrast, a tight crop helps; if there just isn't one, say so — that's data too.
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
              <Button
                label="C · Get closer on the number"
                tone="secondary"
                onPress={() => router.push('/visit/label/crop')}
              />
            ) : null}
            <Button
              label="There's no accession on this label"
              tone="quiet"
              onPress={() => settle('none', null)}
            />
            {!top && !typing ? (
              <Button
                label="Skip — I'll sort it out later"
                tone="quiet"
                onPress={() => settle('unread', null)}
              />
            ) : null}
            {typing ? <Button label="Back" tone="quiet" onPress={() => setTyping(false)} /> : null}
          </>
        )}
        <Rule />
        <Button
          label="The label didn't fit — add a frame"
          tone="quiet"
          onPress={() => router.back()}
        />
        {g.ocrNote && top ? (
          <Text style={[type.small, { color: p.muted, marginTop: 12 }]}>{g.ocrNote}</Text>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: 28 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  thumb: { width: 220, height: 220, borderRadius: 8 },
  thumbSmall: { width: 96, height: 96, borderRadius: 6 },
  shot: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
  retake: { marginTop: 0, paddingHorizontal: 20 },
});
