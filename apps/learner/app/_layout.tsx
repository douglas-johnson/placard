import { File, Paths } from 'expo-file-system';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { startWatching, stopWatching } from '../src/location';
import { setCurrentTake, useCurrentTake } from '../src/session';
import { usePalette } from '../src/theme';
import { startUploads } from '../src/upload';

/**
 * The collector's build (docs/field-beta.md §7). Everything here runs with the phone
 * in airplane mode: frames and the manifest are written to the app's own directory
 * the instant they're taken, and the camera roll gets a copy. They leave the phone
 * through the upload queue when the tester has opted in and there is signal (D43),
 * and the manifest can always go through the share sheet too.
 *
 * Routes are files under app/ (Expo Router, D48): start, the visit in progress under
 * visit/, earlier visits under visits/, and the preflight.
 */
export default function RootLayout() {
  const scheme = useColorScheme();
  const p = usePalette();
  const take = useCurrentTake();
  const router = useRouter();

  useEffect(() => startUploads(), []);

  useEffect(() => {
    if (take && !take.ended) startWatching();
    return () => stopWatching();
  }, [take]);

  // Development only: a marker file in Documents — written from the Mac with
  // `simctl get_app_container` — walks the data path (src/devtest.ts) and lands on
  // the hub. The simulator can't be tapped from a script, and a URL scheme prompts.
  useEffect(() => {
    if (!__DEV__) return;
    const routeMarker = new File(Paths.document, 'devroute');
    if (routeMarker.exists) {
      const [input, preset] = routeMarker.textSync().trim().split(':');
      routeMarker.delete();
      const path = { label: 'label', wall_text: 'wall-text', venue: 'signage' }[input];
      if (take && path)
        router.push(`/visit/${path}${preset ? `?preset=${preset}` : ''}`, { withAnchor: true });
    }
    const marker = new File(Paths.document, 'selftest');
    if (!marker.exists) return;
    marker.delete();
    (async () => {
      const { runSelfTest } = await import('../src/devtest');
      await startWatching();
      setCurrentTake(await runSelfTest());
      router.replace('/visit');
    })().catch((e) => console.error('[selftest] failed', e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.bg } }} />
    </>
  );
}
