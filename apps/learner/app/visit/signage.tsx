import { useRouter } from 'expo-router';
import { VenueFlow } from '../../src/screens/VenueFlow';
import { useCurrentTake } from '../../src/session';

/** Venue signage on arrival: name, hours and admission, the accessible entrance. */
export default function Signage() {
  const take = useCurrentTake();
  const router = useRouter();
  if (!take) return null; // leaving the visit: see visit/_layout.tsx
  return (
    <VenueFlow
      take={take}
      mode="arrival"
      onDone={() => router.back()}
      onCancel={() => router.back()}
    />
  );
}
