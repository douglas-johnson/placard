import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { File, Paths } from 'expo-file-system';
import { useColorScheme } from 'react-native';
import { startWatching, stopWatching } from './src/location';
import { Arrive } from './src/screens/Arrive';
import { Done } from './src/screens/Done';
import { Home, type Input } from './src/screens/Home';
import { LabelFlow } from './src/screens/LabelFlow';
import { Preflight } from './src/screens/Preflight';
import { VenueFlow } from './src/screens/VenueFlow';
import { WallTextFlow } from './src/screens/WallTextFlow';
import { endTake, resumeTake, type Take } from './src/take';

/**
 * F0 — one collector, no server (docs/field-beta.md §7). Everything here runs with
 * the phone in airplane mode: frames and the manifest are written to the app's own
 * directory the instant they're taken, the camera roll gets a copy, and the manifest
 * leaves through the share sheet.
 *
 * No navigation library: four screens and a flow at a time is a state machine, and
 * a library would have meant a native rebuild for a JS-only milestone.
 */
type Route =
  | { name: 'arrive' }
  | { name: 'home' }
  | { name: 'done' }
  | { name: 'preflight' }
  | { name: 'flow'; input: Input; devPreset?: 'readback' | 'flags' };

export default function App() {
  const scheme = useColorScheme();
  const [take, setTake] = useState<Take | null>(() => resumeTake());
  const [route, setRoute] = useState<Route>(take ? { name: 'home' } : { name: 'arrive' });
  // Home reads counts off the take object, which the flows mutate; bump to re-render.
  const [, setTick] = useState(0);
  const home = useCallback(() => {
    setTick((t) => t + 1);
    setRoute({ name: 'home' });
  }, []);

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
      const [input, devPreset] = routeMarker.textSync().trim().split(':') as [Input, 'readback' | 'flags' | undefined];
      routeMarker.delete();
      if (take) setRoute({ name: 'flow', input, devPreset });
    }
    const marker = new File(Paths.document, 'selftest');
    if (!marker.exists) return;
    marker.delete();
    (async () => {
      const { runSelfTest } = await import('./src/devtest');
      await startWatching();
      const t = await runSelfTest();
      setTake(t);
      home();
    })().catch((e) => console.error('[selftest] failed', e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  let screen;
  if (!take || route.name === 'arrive') {
    screen = (
      <Arrive
        onStarted={(t) => {
          setTake(t);
          setRoute({ name: 'flow', input: 'venue' });
        }}
      />
    );
  } else if (route.name === 'done') {
    screen = (
      <Done
        take={take}
        onClose={() => {
          setTake(null);
          setRoute({ name: 'arrive' });
        }}
      />
    );
  } else if (route.name === 'preflight') {
    screen = <Preflight onBack={home} />;
  } else if (route.name === 'flow') {
    switch (route.input) {
      case 'label':
        screen = <LabelFlow take={take} onDone={home} onCancel={home} devPreset={route.devPreset} />;
        break;
      case 'wall_text':
        screen = <WallTextFlow take={take} onDone={home} onCancel={home} />;
        break;
      case 'venue':
        screen = <VenueFlow take={take} mode="arrival" onDone={home} onCancel={home} />;
        break;
      case 'exterior':
        screen = (
          <VenueFlow
            take={take}
            mode="exterior"
            onCancel={home}
            onDone={() => {
              endTake(take);
              stopWatching();
              setRoute({ name: 'done' });
            }}
          />
        );
        break;
    }
  } else {
    screen = <Home take={take} onInput={(input) => setRoute({ name: 'flow', input })} onPreflight={() => setRoute({ name: 'preflight' })} />;
  }

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {screen}
    </>
  );
}
