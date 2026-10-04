import { useRouter } from 'expo-router';
import { Done } from '../../src/screens/Done';
import { setCurrentTake, useCurrentTake } from '../../src/session';

export default function DoneRoute() {
  const take = useCurrentTake()!;
  const router = useRouter();
  return (
    <Done
      take={take}
      onClose={() => {
        // Leave first: with no visit, visit/_layout.tsx would redirect on its own.
        router.replace('/start');
        setCurrentTake(null);
      }}
    />
  );
}
