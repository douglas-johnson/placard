import { useRouter } from 'expo-router';
import { WallTextFlow } from '../../src/screens/WallTextFlow';
import { useCurrentTake } from '../../src/session';

export default function WallText() {
  const take = useCurrentTake()!;
  const router = useRouter();
  return <WallTextFlow take={take} onDone={() => router.back()} onCancel={() => router.back()} />;
}
