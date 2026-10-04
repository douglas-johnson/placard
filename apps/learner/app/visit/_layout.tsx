import { Stack } from 'expo-router';
import { FaceQuestion } from '../../src/screens/FaceQuestion';
import { useCurrentTake } from '../../src/session';
import { usePalette } from '../../src/theme';

/**
 * The visit in progress. Every screen under here needs one, so with none it's back
 * to the door. The flows have their own Cancel and Back, which keep the manifest
 * honest about where a group ends, so the swipe-back gesture is off for them; a
 * swipe out of the label flow would leave its group open. Done is the end of the
 * visit and has nothing to go back to.
 *
 * Done's Close and the hub's Delete clear the visit and then pop back to the landing.
 * A native stack keeps the outgoing screens mounted through their exit transition, so
 * every route under here, and this layout, renders nothing when there's no visit.
 * Nothing redirects from here: the landing is the one place that decides between a
 * visit and the door, so leaving is a single navigation.
 *
 * The face question (D49) sits over all of them: whichever flow saved a frame with a
 * face in it, the tester is asked before going on.
 */
// The hub beneath any screen under visit/ that's opened directly, so Back from it lands
// on the hub. A deep link gets this on its own; a router call needs `withAnchor`.
export const unstable_settings = { initialRouteName: 'index' };

export default function VisitLayout() {
  const p = usePalette();
  const take = useCurrentTake();
  if (!take) return null;
  const flow = { gestureEnabled: false };
  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.bg } }}>
        <Stack.Screen name="label" options={flow} />
        <Stack.Screen name="wall-text" options={flow} />
        <Stack.Screen name="signage" options={flow} />
        <Stack.Screen name="exterior" options={flow} />
        <Stack.Screen name="done" options={flow} />
      </Stack>
      <FaceQuestion take={take} />
    </>
  );
}
