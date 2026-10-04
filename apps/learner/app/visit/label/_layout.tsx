import { Stack } from 'expo-router';
import { LabelGroupProvider } from '../../../src/labelGroup';
import { useCurrentTake } from '../../../src/session';
import { usePalette } from '../../../src/theme';

/**
 * One label group, start to finish (field-beta §2.2, protocol v2), a screen per step
 * (#31):
 *
 *   index      A  the label            → read on device
 *   readback      the accession shown back for confirmation
 *   crop       C  the accession line   → only offered when A read nothing accession-shaped
 *   work       B  the work(s)          → at least one, or a stated reason there isn't one
 *   no-work       why not
 *   flags         flags and hard cases → said at the moment, by the person who was there
 *
 * What the steps share is src/labelGroup.tsx, provided here. Every step has its own
 * Back, so swiping is off: the camera screens are full-bleed, and Back from the work
 * to the read-back is a choice the manifest records (D51).
 */
// The capture beneath a step opened directly, as by the devroute marker.
export const unstable_settings = { initialRouteName: 'index' };

export default function LabelLayout() {
  const p = usePalette();
  const take = useCurrentTake();
  if (!take) return null; // leaving the visit: see visit/_layout.tsx
  return (
    <LabelGroupProvider take={take}>
      <Stack
        screenOptions={{
          headerShown: false,
          gestureEnabled: false,
          contentStyle: { backgroundColor: p.bg },
        }}
      />
    </LabelGroupProvider>
  );
}
