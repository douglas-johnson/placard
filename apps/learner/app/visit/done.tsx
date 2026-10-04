import { useRouter } from 'expo-router';
import { Done } from '../../src/screens/Done';
import { setCurrentTake, useCurrentTake } from '../../src/session';

export default function DoneRoute() {
  const take = useCurrentTake();
  const router = useRouter();
  if (!take) return null; // leaving the visit: see visit/_layout.tsx
  return (
    <Done
      take={take}
      onClose={() => {
        // Back to the landing, beneath the visit or swapped in if the visit was
        // resumed at launch. See visit/_layout.tsx.
        setCurrentTake(null);
        router.dismissTo('/');
      }}
    />
  );
}
