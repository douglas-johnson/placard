import { useLocalSearchParams, useRouter } from 'expo-router';
import { LabelFlow } from '../../src/screens/LabelFlow';
import { useCurrentTake } from '../../src/session';

export default function Label() {
  const take = useCurrentTake();
  const router = useRouter();
  // Development only: open at a later step (the devroute marker in app/_layout.tsx).
  const { preset } = useLocalSearchParams<{ preset?: 'readback' | 'flags' }>();
  if (!take) return null; // leaving the visit: see visit/_layout.tsx
  return (
    <LabelFlow
      take={take}
      onDone={() => router.back()}
      onCancel={() => router.back()}
      devPreset={preset}
    />
  );
}
