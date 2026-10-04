import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Visit } from '../../src/screens/Visit';
import { listTakes } from '../../src/take';

/** An earlier visit, from the hub or from the door. */
export default function EarlierVisit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const take = useMemo(() => listTakes().find((t) => t.id === id), [id]);
  if (!take) return <Redirect href="/" />;
  return <Visit take={take} onBack={() => router.back()} onDeleted={() => router.back()} />;
}
