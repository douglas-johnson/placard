import { useRouter } from 'expo-router';
import { WallTextFlow } from '../../src/screens/WallTextFlow';
import { useCurrentTake } from '../../src/session';

export default function WallText() {
  const take = useCurrentTake();
  const router = useRouter();
  if (!take) return null; // leaving the visit: see visit/_layout.tsx
  return <WallTextFlow take={take} onDone={() => router.back()} onCancel={() => router.back()} />;
}
