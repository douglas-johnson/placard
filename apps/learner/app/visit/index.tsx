import { useRouter } from 'expo-router';
import { Home, type Input } from '../../src/screens/Home';
import { setCurrentTake, useCurrentTake } from '../../src/session';

const ROUTE: Record<
  Input,
  '/visit/label' | '/visit/wall-text' | '/visit/signage' | '/visit/exterior'
> = {
  label: '/visit/label',
  wall_text: '/visit/wall-text',
  venue: '/visit/signage',
  exterior: '/visit/exterior',
};

/** The hub for the visit in progress. */
export default function Hub() {
  const take = useCurrentTake();
  const router = useRouter();
  if (!take) return null; // leaving the visit: see visit/_layout.tsx
  return (
    <Home
      take={take}
      onInput={(input) => router.push(ROUTE[input])}
      onPreflight={() => router.push('/preflight')}
      onOpenVisit={(t) => router.push({ pathname: '/visits/[id]', params: { id: t.id } })}
      onDeleted={() => {
        // Back to the landing, beneath the visit or swapped in if the visit was
        // resumed at launch. See visit/_layout.tsx.
        setCurrentTake(null);
        router.dismissTo('/');
      }}
    />
  );
}
