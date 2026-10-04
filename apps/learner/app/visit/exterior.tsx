import { useRouter } from 'expo-router';
import { stopWatching } from '../../src/location';
import { VenueFlow } from '../../src/screens/VenueFlow';
import { useCurrentTake } from '../../src/session';
import { endTake } from '../../src/take';

/** The exterior on leaving, which ends the visit. */
export default function Exterior() {
  const take = useCurrentTake()!;
  const router = useRouter();
  return (
    <VenueFlow
      take={take}
      mode="exterior"
      onCancel={() => router.back()}
      onDone={() => {
        endTake(take);
        stopWatching();
        router.replace('/visit/done');
      }}
    />
  );
}
