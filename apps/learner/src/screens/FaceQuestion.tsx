import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { answerFaces, faceOriginal, type FaceQuestion as Question, type Take } from '../take';
import { type, usePalette } from '../theme';
import { Button, H2, P } from '../ui';

/** FaceCore.swift's `faceMargin`: the pixellated area is the face grown by this on every side. */
const FACE_MARGIN = 0.35;

/**
 * Asked when a frame has faces in it (D49). Every face was pixellated as the frame was
 * saved; here the tester can keep one that belongs to the artwork, a portrait or a
 * statue, which the face pass can't tell from a visitor. Not answering is an answer:
 * the blur stands, and ending the visit records it so.
 *
 * Over whichever screen saved the frame, so no flow has to know about it.
 */
export function FaceQuestion({ take }: { take: Take }) {
  const q = take.unanswered[0];
  return (
    <Modal visible={q != null} animationType="slide" presentationStyle="fullScreen">
      {q ? <Ask key={q.frame} take={take} q={q} /> : null}
    </Modal>
  );
}

function Ask({ take, q }: { take: Take; q: Question }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const [kept, setKept] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [area, setArea] = useState<{ width: number; height: number } | null>(null);

  // The original if it's still in the cache; otherwise only the blurred frame is left,
  // and nothing can be kept.
  const original = faceOriginal(take, q.frame);
  const uri = original?.uri ?? `${take.dir.uri}/${q.file}`;

  const fit = area ? Math.min(area.width / q.width, area.height / q.height) : 0;

  const toggle = (i: number) =>
    setKept((k) => (k.includes(i) ? k.filter((x) => x !== i) : [...k, i]));

  const done = async () => {
    setBusy(true);
    setError(null);
    try {
      await answerFaces(take, q.frame, kept);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  const n = q.boxes.length;
  return (
    <View
      style={[
        styles.root,
        { backgroundColor: p.bg, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
      ]}
    >
      <H2>{n === 1 ? 'A face in this photo' : 'Faces in this photo'}</H2>
      <P muted>
        Faces are blurred before a photo leaves your phone, so the people around you stay anonymous.{' '}
        {original
          ? n === 1
            ? 'If this one is part of the artwork, like a portrait or a statue, tap it to keep it.'
            : 'If one is part of the artwork, like a portrait or a statue, tap it to keep it.'
          : 'The photo as shot is gone, so the blur stays.'}
      </P>

      <View style={styles.area} onLayout={(e) => setArea(e.nativeEvent.layout)}>
        {fit > 0 ? (
          <View style={{ width: q.width * fit, height: q.height * fit }}>
            <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
            {q.boxes.map(([x, y, w, h], i) => {
              const keep = kept.includes(i);
              // Vision's box is normalized with its origin at the bottom left.
              const left = Math.max(0, x - w * FACE_MARGIN);
              const right = Math.min(1, x + w * (1 + FACE_MARGIN));
              const bottom = Math.max(0, y - h * FACE_MARGIN);
              const top = Math.min(1, y + h * (1 + FACE_MARGIN));
              return (
                <Pressable
                  key={i}
                  disabled={!original || busy}
                  onPress={() => toggle(i)}
                  accessibilityRole="button"
                  accessibilityLabel={keep ? 'Kept: part of the artwork' : 'Blurred'}
                  hitSlop={12}
                  style={[
                    styles.face,
                    {
                      left: `${left * 100}%`,
                      top: `${(1 - top) * 100}%`,
                      width: `${(right - left) * 100}%`,
                      height: `${(top - bottom) * 100}%`,
                      borderColor: keep ? p.ok : '#FFFFFF',
                      backgroundColor: keep ? 'transparent' : 'rgba(20,19,17,0.72)',
                      borderStyle: keep ? 'dashed' : 'solid',
                    },
                  ]}
                />
              );
            })}
          </View>
        ) : null}
      </View>

      <Text style={[type.small, { color: p.muted, marginBottom: 12 }]}>
        {kept.length === 0
          ? n === 1
            ? 'Blurred.'
            : 'All blurred.'
          : kept.length === n
            ? 'Kept as part of the artwork.'
            : `${kept.length} kept as part of the artwork, the rest blurred.`}
      </Text>
      {error ? (
        <Text style={[type.small, { color: p.warn, marginBottom: 12 }]}>{error}</Text>
      ) : null}
      <Button label={busy ? 'Saving…' : 'Done'} onPress={done} disabled={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20 },
  area: { flex: 1, alignItems: 'center', justifyContent: 'center', marginVertical: 16 },
  face: { position: 'absolute', borderWidth: 2, borderRadius: 4 },
});
