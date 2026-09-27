import { File } from 'expo-file-system';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useInsets } from '../insets';
import { shareManifest } from '../share';
import { type FrameKind, type ManifestRecord, recordsOf, redactFrame, type Take } from '../take';
import { type, usePalette } from '../theme';
import { Button, H1, P, Rule, Screen } from '../ui';

type FrameRecord = Extract<ManifestRecord, { type: 'frame' }>;

const KIND: Record<FrameKind, string> = {
  venue_sign: 'Venue sign',
  exterior: 'Exterior',
  label: 'Label',
  work: 'Work',
  accession_crop: 'Accession crop',
  wall_text: 'Wall text',
};

/**
 * An earlier visit, photo by photo. The one change it offers is removing a photo, and
 * only as a redaction (D4 amendment): a take is evidence and is otherwise never
 * edited (data/README.md). The case is a label that identifies a child — the Met's
 * P.S. Art label is the first — and the confirmation says so rather than offering a
 * general delete that would quietly make the corpus tidier than the gallery was.
 */
export function Visit({ take, onBack }: { take: Take; onBack: () => void }) {
  const p = usePalette();
  const insets = useInsets();
  const [frames, setFrames] = useState(() => framesOf(take));
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remove = (frame: string) => {
    try {
      redactFrame(take, frame, 'identifies a minor');
      setError(null);
    } catch (e) {
      setError(String(e));
    }
    setConfirming(null);
    setFrames(framesOf(take));
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.sheet, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
        <Pressable onPress={onBack} hitSlop={8}>
          <Text style={[type.small, { color: p.muted }]}>‹ Back</Text>
        </Pressable>
        <H1>{take.venue.name}</H1>
        <P muted>
          {new Date(take.started).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })} ·{' '}
          {take.counts.labels} {take.counts.labels === 1 ? 'label' : 'labels'} · {take.counts.frames} photos
        </P>
        <Button label="Share the manifest" tone="secondary" onPress={() => shareManifest(take)} />
        <Rule />
        {error ? <Text style={[type.small, { color: p.fail, marginBottom: 12 }]}>{error}</Text> : null}
        {frames.map((f) => (
          <View key={f.frame} style={[styles.row, { borderColor: p.rule }]}>
            <View style={styles.line}>
              {f.file && f.exists ? (
                <Image source={{ uri: f.uri }} style={[styles.thumb, { backgroundColor: p.card }]} resizeMode="cover" />
              ) : (
                <View style={[styles.thumb, { backgroundColor: p.card }]} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={[type.body, { color: p.text }]}>
                  {KIND[f.kind]}
                  {f.group ? <Text style={{ color: p.muted }}> · {f.group}</Text> : null}
                </Text>
                <Text style={[type.small, { color: p.muted }]}>
                  {f.frame} · {new Date(f.ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </Text>
                {f.redacted ? (
                  <Text style={[type.small, { color: p.pending }]}>Removed — {f.redacted}</Text>
                ) : f.file && !f.exists ? (
                  <Text style={[type.small, { color: p.warn }]}>The photo is gone but its record isn't finished — remove it again.</Text>
                ) : null}
              </View>
              {!f.redacted && confirming !== f.frame ? (
                <Pressable onPress={() => setConfirming(f.frame)} hitSlop={8}>
                  <Text style={[type.small, { color: p.muted }]}>Remove…</Text>
                </Pressable>
              ) : null}
            </View>
            {confirming === f.frame ? (
              <View style={[styles.confirm, { backgroundColor: p.card }]}>
                <Text style={[type.body, { color: p.text }]}>Remove this photo for good?</Text>
                <P muted>
                  It's the one change a visit can take, and it's for one case: a photo that identifies a child — a
                  student's name on a label, say. The photo is deleted here and any text read from it is wiped. The
                  record that a photo was taken stays, so the visit still adds up.
                </P>
                <P muted>The copy in your camera roll is separate. Delete that one in Photos.</P>
                <Button label="Remove it" onPress={() => remove(f.frame)} />
                <Button label="Keep it" tone="quiet" onPress={() => setConfirming(null)} />
              </View>
            ) : null}
          </View>
        ))}
        <Text style={[type.small, { color: p.pending, marginTop: 24 }]}>{take.id}</Text>
      </ScrollView>
    </Screen>
  );
}

function framesOf(take: Take): (FrameRecord & { uri: string; exists: boolean })[] {
  return recordsOf(take)
    .filter((r): r is FrameRecord => r.type === 'frame')
    .map((r) => {
      const file = r.file ? new File(take.dir, r.file) : null;
      return { ...r, uri: file?.uri ?? '', exists: file?.exists ?? false };
    });
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: 28 },
  row: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 44, height: 64, borderRadius: 4 },
  confirm: { marginTop: 10, padding: 14, borderRadius: 10 },
});
