import { File } from 'expo-file-system';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { shareManifest } from '../share';
import { type FrameKind, type ManifestRecord, recordsOf, redactFrame, type Take } from '../take';
import { dark, type, usePalette } from '../theme';
import { Button, H1, P, Rule, Screen } from '../ui';
import { sentToCorpus } from '../upload';
import { DeleteVisit } from './DeleteVisit';

type FrameRecord = Extract<ManifestRecord, { type: 'frame' }>;
type FrameView = FrameRecord & { uri: string; exists: boolean };

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
 *
 * A thumbnail opens the photo full screen, because the one you're looking for is
 * usually a label and a label can't be read at thumbnail size — the first removal
 * was made blind, picking by kind and time.
 */
export function Visit({
  take,
  onBack,
  onDeleted,
}: {
  take: Take;
  onBack: () => void;
  onDeleted: () => void;
}) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const [frames, setFrames] = useState(() => framesOf(take));
  const [confirming, setConfirming] = useState<string | null>(null);
  const [viewing, setViewing] = useState<FrameView | null>(null);
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
      <ScrollView
        contentContainerStyle={[
          styles.sheet,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <Pressable onPress={onBack} hitSlop={8}>
          <Text style={[type.small, { color: p.muted }]}>‹ Back</Text>
        </Pressable>
        <H1>{take.venue.name}</H1>
        <P muted>
          {new Date(take.started).toLocaleDateString([], {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}{' '}
          · {take.counts.labels} {take.counts.labels === 1 ? 'label' : 'labels'} ·{' '}
          {take.counts.frames} {take.counts.frames === 1 ? 'photo' : 'photos'}
        </P>
        <Button label="Share the manifest" tone="secondary" onPress={() => shareManifest(take)} />
        <Rule />
        {error ? (
          <Text style={[type.small, { color: p.fail, marginBottom: 12 }]}>{error}</Text>
        ) : null}
        {frames.map((f) => (
          <View key={f.frame} style={[styles.row, { borderColor: p.rule }]}>
            <View style={styles.line}>
              {f.file && f.exists ? (
                <Pressable
                  onPress={() => setViewing(f)}
                  accessibilityLabel={`View ${KIND[f.kind].toLowerCase()} ${f.frame}`}
                >
                  <Image
                    source={{ uri: f.uri }}
                    style={[styles.thumb, { backgroundColor: p.card }]}
                    resizeMode="cover"
                  />
                </Pressable>
              ) : (
                <View style={[styles.thumb, { backgroundColor: p.card }]} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={[type.body, { color: p.text }]}>
                  {KIND[f.kind]}
                  {f.group ? <Text style={{ color: p.muted }}> · {f.group}</Text> : null}
                </Text>
                <Text style={[type.small, { color: p.muted }]}>
                  {f.frame} ·{' '}
                  {new Date(f.ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </Text>
                {f.redacted ? (
                  <Text style={[type.small, { color: p.pending }]}>Removed — {f.redacted}</Text>
                ) : f.file && !f.exists ? (
                  <Text style={[type.small, { color: p.warn }]}>
                    The photo is gone but its record isn't finished — remove it again.
                  </Text>
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
                  It's for one case: a photo that identifies a child — a student's name on a label,
                  say. The photo is deleted here and any text the app read from it is wiped. The
                  record that a photo was taken stays, so the visit still adds up.
                </P>
                <P muted>The copy in your camera roll is separate. Delete that one in Photos.</P>
                {sentToCorpus(take, f.frame) ? (
                  <Text style={[type.small, { color: p.warn, marginTop: 8 }]}>
                    Some of this has already reached the corpus, and removing it here doesn't reach
                    there. Tell Doug — it needs the redaction tool too, today.
                  </Text>
                ) : null}
                <Button label="Remove it" onPress={() => remove(f.frame)} />
                <Button label="Keep it" tone="quiet" onPress={() => setConfirming(null)} />
              </View>
            ) : null}
          </View>
        ))}
        <DeleteVisit take={take} onDeleted={onDeleted} />
        <Text style={[type.small, { color: p.pending, marginTop: 24 }]}>{take.id}</Text>
      </ScrollView>
      {viewing ? (
        <Viewer
          frame={viewing}
          onClose={() => setViewing(null)}
          onRemove={
            viewing.redacted
              ? undefined
              : () => {
                  setConfirming(viewing.frame);
                  setViewing(null);
                }
          }
        />
      ) : null}
    </Screen>
  );
}

/**
 * One photo, full screen and pinch-zoomable — iOS's own ScrollView zoom, so no gesture
 * library and nothing native (D33). Dark like the camera screens. "Remove…" here only
 * closes the viewer and opens the same confirmation the row has, so there's still one
 * place a removal is decided.
 */
function Viewer({
  frame,
  onClose,
  onRemove,
}: {
  frame: FrameView;
  onClose: () => void;
  onRemove?: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <StatusBar style="light" />
      <View style={[styles.viewer, { backgroundColor: '#000' }]}>
        <ScrollView
          maximumZoomScale={8}
          minimumZoomScale={1}
          centerContent
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ width, height }}
        >
          <Image source={{ uri: frame.uri }} style={{ width, height }} resizeMode="contain" />
        </ScrollView>
        <View
          style={[styles.bar, { top: 0, paddingTop: insets.top + 12 }]}
          pointerEvents="box-none"
        >
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={[type.body, { color: dark.text }]}>Done</Text>
          </Pressable>
          <Text style={[type.small, { color: dark.muted }]}>
            {KIND[frame.kind]}
            {frame.group ? ` · ${frame.group}` : ''} · {frame.frame}
          </Text>
        </View>
        <View
          style={[styles.bar, { bottom: 0, paddingBottom: insets.bottom + 12 }]}
          pointerEvents="box-none"
        >
          <Text style={[type.small, { color: dark.muted }]}>Pinch to zoom in</Text>
          {onRemove ? (
            <Pressable onPress={onRemove} hitSlop={12}>
              <Text style={[type.body, { color: dark.text }]}>Remove…</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function framesOf(take: Take): FrameView[] {
  return recordsOf(take)
    .filter((r): r is FrameRecord => r.type === 'frame')
    .filter((r) => !r.discarded) // a retake (D48): thrown away, not part of the visit
    .map((r) => {
      const file = r.file ? new File(take.dir, r.file) : null;
      return { ...r, uri: file?.uri ?? '', exists: file?.exists ?? false };
    });
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: 28 },
  row: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 72, height: 96, borderRadius: 4 },
  confirm: { marginTop: 10, padding: 14, borderRadius: 10 },
  viewer: { flex: 1 },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
});
