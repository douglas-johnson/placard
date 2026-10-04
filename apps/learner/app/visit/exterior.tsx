import { useRouter } from 'expo-router';
import { stopWatching } from '../../src/location';
import { VenueFlow } from '../../src/screens/VenueFlow';
import { useCurrentTake } from '../../src/session';
import { endTake } from '../../src/take';

/** The exterior on leaving, which ends the visit. */
export default function Exterior() {
  const take = useCurrentTake();
  const router = useRouter();
  if (!take) return null; // leaving the visit: see visit/_layout.tsx
  return (
    <VenueFlow
      take={take}
      mode="exterior"
      onCancel={() => router.back()}
      onDone={async () => {
        await endTake(take);
        stopWatching();
        router.replace('/visit/done');
      }}
    />
  );
}
