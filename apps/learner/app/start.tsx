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
        // hub beneath it (unstable_settings in visit/_layout.tsx), as it always has.
        router.replace('/visit/signage');
      }}
      onOpenVisit={(take) => router.push({ pathname: '/visits/[id]', params: { id: take.id } })}
    />
  );
}
