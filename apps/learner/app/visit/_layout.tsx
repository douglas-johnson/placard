import { Redirect, Stack } from 'expo-router';
import { useCurrentTake } from '../../src/session';
import { usePalette } from '../../src/theme';

/**
 * The visit in progress. Every screen under here needs one, so with none it's back
 * to the door. The flows have their own Cancel and Back, which keep the manifest
 * honest about where a group ends, so the swipe-back gesture is off for them; a
 * swipe out of the label flow would leave its group open. Done is the end of the
 * visit and has nothing to go back to.
 */
// The hub beneath any screen under visit/ that's opened directly, so Back from it lands
// on the hub. A deep link gets this on its own; a router call needs `withAnchor`.
export const unstable_settings = { initialRouteName: 'index' };

export default function VisitLayout() {
  const p = usePalette();
  const take = useCurrentTake();
  if (!take) return <Redirect href="/start" />;
  const flow = { gestureEnabled: false };
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.bg } }}>
      <Stack.Screen name="label" options={flow} />
      <Stack.Screen name="wall-text" options={flow} />
      <Stack.Screen name="signage" options={flow} />
      <Stack.Screen name="exterior" options={flow} />
      <Stack.Screen name="done" options={flow} />
    </Stack>
  );
}
