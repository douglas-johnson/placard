import { useRouter } from 'expo-router';
import { Arrive } from '../src/screens/Arrive';
import { setCurrentTake } from '../src/session';

export default function Start() {
  const router = useRouter();
  return (
    <Arrive
      onStarted={(take) => {
        setCurrentTake(take);
        // Replaced, so nothing goes back to the venue picker. Signage opens with the
        // hub beneath it, as it always has: `withAnchor` is what makes the visit
        // layout's initialRouteName apply to a navigation call and not only to a deep link.
        router.replace('/visit/signage', { withAnchor: true });
      }}
      onOpenVisit={(take) => router.push({ pathname: '/visits/[id]', params: { id: take.id } })}
    />
  );
}
