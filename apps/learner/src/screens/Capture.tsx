import { Asset } from 'expo-asset';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { File, Paths } from 'expo-file-system';
import { StatusBar } from 'expo-status-bar';
import { ReactNode, useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useInsets } from '../insets';
import { exifFor, latestFix, type Gps } from '../location';
import { dark, type } from '../theme';
import { Button } from '../ui';

export type Picture = { uri: string; width: number; height: number; gps: Gps | null };

/**
 * The viewfinder every input shares. A prompt strip says what this frame is for,
 * the shutter takes it, and the flow that owns the screen decides what happens next.
 * The fix is read at the shutter from the session watcher — never awaited — and
 * written into the JPEG's EXIF so the file carries its own venue evidence.
 */
export function Capture({
  title,
  hint,
  busy,
  onPicture,
  onBack,
  backLabel = 'Back',
  actions,
  children,
}: {
  title: string;
  hint?: string;
  /** While true the shutter is disabled — the previous frame is still being written or read. */
  busy?: boolean;
  onPicture: (picture: Picture) => void;
  onBack: () => void;
  backLabel?: string;
  /** Secondary choices under the shutter: "No work photo", "Done", "Skip". */
  actions?: { label: string; onPress: () => void; tone?: 'secondary' | 'quiet' }[];
  children?: ReactNode;
}) {
  const insets = useInsets();
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [taking, setTaking] = useState(false);

  const shoot = useCallback(async () => {
    if (!camera.current || taking || busy) return;
    setTaking(true);
    try {
      const gps = latestFix();
      const pic = await camera.current.takePictureAsync({
        quality: 0.92,
        exif: true,
        additionalExif: exifFor(gps),
      });
      onPicture({ uri: pic.uri, width: pic.width, height: pic.height, gps });
    } catch (e) {
      console.warn('[capture] takePictureAsync failed', e);
    } finally {
      setTaking(false);
    }
  }, [taking, busy, onPicture]);

  // Development only: the simulator has no camera, and its stand-in frame is a blank
  // 200px square. This hands the flow the bundled 38.447.4 label instead, so the
  // read-back path can be exercised without a phone. Never compiled into a release.
  const useFixture = useCallback(async () => {
    if (!__DEV__) return;
    setTaking(true);
    try {
      const asset = Asset.fromModule(require('../../assets/fixtures/mcny-38.447.4.jpg'));
      await asset.downloadAsync();
      if (!asset.localUri) throw new Error('fixture has no local URI');
      const copy = new File(Paths.cache, `fixture-${Date.now()}.jpg`);
      new File(asset.localUri).copySync(copy);
      onPicture({ uri: copy.uri, width: 1200, height: 1200, gps: latestFix() });
    } catch (e) {
      console.warn('[capture] fixture failed', e);
    } finally {
      setTaking(false);
    }
  }, [onPicture]);

  const allActions = __DEV__
    ? [...(actions ?? []), { label: 'Fixture (dev)', onPress: useFixture, tone: 'quiet' as const }]
    : actions;

  if (!permission) return <View style={styles.root} />;
  if (!permission.granted) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 40, paddingHorizontal: 28 }]}>
        <Text style={[type.h2, { color: dark.text }]}>The camera is the whole point</Text>
        <Text style={[type.body, { color: dark.muted, marginTop: 8 }]}>
          Placard can't collect a label without it. Nothing else is asked for here.
        </Text>
        <Button label="Allow the camera" onPress={requestPermission} style={{ marginTop: 24 }} />
        <Button label={backLabel} onPress={onBack} tone="quiet" />
      </View>
    );
  }

  const blocked = busy || taking || !ready;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <CameraView
        ref={camera}
        style={StyleSheet.absoluteFill}
        facing="back"
        autofocus="on"
        animateShutter={false}
        onCameraReady={() => setReady(true)}
      />

      <View style={[styles.strip, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.back}>
          <Text style={[type.small, { color: dark.text }]}>‹ {backLabel}</Text>
        </Pressable>
        <Text style={[type.h2, { color: dark.text }]}>{title}</Text>
        {hint ? <Text style={[type.small, { color: dark.muted, marginTop: 2 }]}>{hint}</Text> : null}
      </View>

      {children}

      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          onPress={shoot}
          disabled={blocked}
          style={({ pressed }) => [
            styles.shutter,
            { opacity: blocked ? 0.35 : pressed ? 0.7 : 1 },
          ]}
        >
          {busy || taking ? <ActivityIndicator color="#141311" /> : <View style={styles.shutterInner} />}
        </Pressable>
        {allActions && allActions.length > 0 ? (
          <View style={styles.actions}>
            {allActions.map((a) => (
              <Pressable key={a.label} onPress={a.onPress} hitSlop={8} style={styles.action}>
                <Text
                  style={[
                    type.body,
                    { color: a.tone === 'quiet' ? dark.muted : dark.text, fontWeight: '600' },
                  ]}
                >
                  {a.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  strip: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: 'rgba(20,19,17,0.72)',
  },
  back: { marginBottom: 8 },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingTop: 16,
    backgroundColor: 'rgba(20,19,17,0.72)',
  },
  shutter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#F2EFE9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    borderColor: '#141311',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 14,
  },
  action: { paddingHorizontal: 14, paddingVertical: 6 },
});
