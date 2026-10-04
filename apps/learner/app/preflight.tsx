import { useRouter } from 'expo-router';
import { Preflight } from '../src/screens/Preflight';

export default function PreflightRoute() {
  const router = useRouter();
  return <Preflight onBack={() => router.back()} />;
}
