import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { Asset } from 'expo-asset';
import * as VisionOcr from './modules/vision-ocr';

/**
 * Preflight — the A1 starting point.
 *
 * Deliberately not a "Hello World". The thing actually worth verifying on a first
 * boot isn't that React renders, it's that the two native modules the capture path
 * depends on (§4.1) are linked and can be asked for permission. Those are what fail
 * on a misconfigured toolchain; a <Text> element is not.
 *
 * The camera itself doesn't exist in the simulator, so this checks as far as the
 * simulator can honestly check and says so rather than implying more.
 *
 * The OCR check is the exception: it runs the real pipeline over a bundled copy of
 * the 38.447.4 label from the corpus. That label is the D14 regression case — Vision
 * reads the accession with a bullet for a dot, and only normalization recovers it —
 * so a pass here means the whole pipeline ported, not just that a function exists.
 */

/** The accession printed on the bundled fixture label. See data/labels/fixtures. */
const FIXTURE_ACCESSION = '38.447.4';

type CheckState = 'pending' | 'ok' | 'warn' | 'fail';

type Check = {
  label: string;
  state: CheckState;
  detail: string;
};

const GLYPH: Record<CheckState, string> = {
  pending: '·',
  ok: '✓',
  warn: '!',
  fail: '✕',
};

export default function App() {
  const scheme = useColorScheme();
  const t = scheme === 'dark' ? dark : light;

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [locationState, setLocationState] = useState<Check>({
    label: 'Location',
    state: 'pending',
    detail: 'not yet requested',
  });

  const isExpoGo =
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

  const [ocrState, setOcrState] = useState<Check>({
    label: 'On-device OCR',
    state: 'pending',
    detail: VisionOcr.isAvailable ? 'reading the fixture label…' : 'checking…',
  });

  useEffect(() => {
    if (!VisionOcr.isAvailable) {
      setOcrState({
        label: 'On-device OCR',
        state: 'fail',
        detail: isExpoGo
          ? 'not linked — Expo Go cannot load the Vision module (§4.4, D3)'
          : 'not linked — this build predates the Vision module; rebuild',
      });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const asset = Asset.fromModule(
          require('./assets/fixtures/mcny-38.447.4.jpg'),
        );
        await asset.downloadAsync();
        if (!asset.localUri) throw new Error('fixture asset has no local URI');
        const result = await VisionOcr.recognize(asset.localUri);
        if (cancelled) return;
        // The full reading goes to Metro so a mismatch can be diagnosed against
        // the corpus tool's output for the same file, not just noticed.
        console.log(
          '[ocr fixture]\n' +
            result.observations
              .map(
                (o) =>
                  `  ${o.contested ? '?' : ' '}${o.wasNormalized ? '~' : ' '} ${JSON.stringify(o.text)}` +
                  (o.variants.length > 1 ? ` variants=${JSON.stringify(o.variants)}` : ''),
              )
              .join('\n') +
            '\n  warnings: ' + JSON.stringify(result.warnings),
        );
        // Three ways the accession can survive, in descending order of comfort.
        // The reference reading is right; or normalization folds a confusable
        // (D14); or the reference is wrong but another scale read it correctly and
        // the line is flagged contested (D21). All three are the pipeline working.
        // What would not be is the accession appearing nowhere at all.
        const readClean = result.text.includes(FIXTURE_ACCESSION);
        const normalized = result.normalizedText.includes(FIXTURE_ACCESSION);
        const inVariants = result.observations.some((o) =>
          o.variants.some((v) => v.includes(FIXTURE_ACCESSION)),
        );
        const verdict = readClean
          ? 'accession read clean'
          : normalized
            ? 'accession recovered by normalization (D14)'
            : inVariants
              ? 'accession contested; right in one scale (D21)'
              : `accession ${FIXTURE_ACCESSION} not found`;
        setOcrState({
          label: 'On-device OCR',
          state: readClean || normalized || inVariants ? 'ok' : 'warn',
          detail: `${result.observations.length} lines in ${result.elapsedMs} ms · ${verdict}`,
        });
      } catch (e) {
        if (cancelled) return;
        setOcrState({
          label: 'On-device OCR',
          state: 'fail',
          detail: e instanceof Error ? e.message : 'recognition failed',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isExpoGo]);

  const readLocationPermission = useCallback(async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      setLocationState({
        label: 'Location',
        state: status === 'granted' ? 'ok' : 'warn',
        detail: `module linked · permission ${status}`,
      });
    } catch (e) {
      setLocationState({
        label: 'Location',
        state: 'fail',
        detail: e instanceof Error ? e.message : 'module failed to load',
      });
    }
  }, []);

  useEffect(() => {
    readLocationPermission();
  }, [readLocationPermission]);

  const requestBoth = useCallback(async () => {
    await requestCameraPermission();
    try {
      await Location.requestForegroundPermissionsAsync();
    } catch {
      // Surfaced by readLocationPermission below.
    }
    await readLocationPermission();
  }, [requestCameraPermission, readLocationPermission]);

  const checks: Check[] = [
    {
      label: 'Runtime',
      state: 'ok',
      detail: `${Platform.OS} ${Platform.Version} · Expo SDK ${
        Constants.expoConfig?.sdkVersion ?? 'unknown'
      }`,
    },
    {
      label: 'Host',
      state: isExpoGo ? 'warn' : 'ok',
      detail: isExpoGo
        ? 'Expo Go — no custom native modules'
        : 'development build',
    },
    {
      label: 'Camera',
      state: !cameraPermission
        ? 'pending'
        : cameraPermission.granted
          ? 'ok'
          : 'warn',
      detail: !cameraPermission
        ? 'reading…'
        : `module linked · permission ${cameraPermission.status}`,
    },
    locationState,
    ocrState,
  ];

  // Echo the preflight to the Metro console. On a simulator the screen may be
  // covered by Expo Go's dev-menu onboarding, and this is the only readout that
  // survives that — it's also what makes the check scriptable later.
  useEffect(() => {
    console.log(
      '[preflight]\n' +
        checks.map((c) => `  ${GLYPH[c.state]} ${c.label}: ${c.detail}`).join('\n'),
    );
  }, [
    cameraPermission?.status,
    locationState.state,
    locationState.detail,
    ocrState.state,
    ocrState.detail,
    isExpoGo,
  ]);

  return (
    <View style={[styles.root, t.root]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, t.title]}>Placard</Text>
        <Text style={[styles.subtitle, t.muted]}>
          Nothing to capture yet. This screen only checks that the pieces the
          capture path needs are actually here.
        </Text>

        <View style={[styles.rule, t.rule]} />

        {checks.map((check) => (
          <View key={check.label} style={styles.row}>
            <Text style={[styles.glyph, t[check.state]]}>
              {GLYPH[check.state]}
            </Text>
            <View style={styles.rowText}>
              <Text style={[styles.rowLabel, t.text]}>{check.label}</Text>
              <Text style={[styles.rowDetail, t.muted]}>{check.detail}</Text>
            </View>
          </View>
        ))}

        <View style={[styles.rule, t.rule]} />

        <Pressable
          onPress={requestBoth}
          style={({ pressed }) => [
            styles.button,
            t.button,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={[styles.buttonLabel, t.buttonLabel]}>
            Request permissions
          </Text>
        </Pressable>

        <Text style={[styles.footnote, t.muted]}>
          The simulator has no camera. Granting permission here proves the module
          is linked and the prompt works — nothing more. Until a device build
          clears the bar in AGENTS.md, the corpus is collected with a stock
          camera and docs/capture-protocol.md.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: 28,
    paddingTop: 96,
    paddingBottom: 56,
  },
  title: {
    fontSize: 38,
    letterSpacing: -0.5,
    fontFamily: Platform.select({ ios: 'Hoefler Text', default: 'serif' }),
  },
  subtitle: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 28,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  glyph: {
    width: 22,
    fontSize: 15,
    lineHeight: 20,
    fontVariant: ['tabular-nums'],
  },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  rowDetail: { fontSize: 13, lineHeight: 19, marginTop: 2 },
  button: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonPressed: { opacity: 0.65 },
  buttonLabel: { fontSize: 15, fontWeight: '600' },
  footnote: {
    marginTop: 28,
    fontSize: 12,
    lineHeight: 18,
  },
});

const light = StyleSheet.create({
  root: { backgroundColor: '#FBFAF8' },
  title: { color: '#171614' },
  text: { color: '#171614' },
  muted: { color: '#6E6A63' },
  rule: { backgroundColor: '#DCD8D1' },
  button: { backgroundColor: '#171614' },
  buttonLabel: { color: '#FBFAF8' },
  ok: { color: '#2F6B4F' },
  warn: { color: '#8A6A1F' },
  fail: { color: '#9B3B32' },
  pending: { color: '#9A958D' },
});

const dark = StyleSheet.create({
  root: { backgroundColor: '#141311' },
  title: { color: '#F2EFE9' },
  text: { color: '#F2EFE9' },
  muted: { color: '#9A958D' },
  rule: { backgroundColor: '#2E2C28' },
  button: { backgroundColor: '#F2EFE9' },
  buttonLabel: { color: '#141311' },
  ok: { color: '#7FB79A' },
  warn: { color: '#D3AE62' },
  fail: { color: '#D98A80' },
  pending: { color: '#6E6A63' },
});
