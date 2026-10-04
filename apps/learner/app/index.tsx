import { Redirect } from 'expo-router';
import { useCurrentTake } from '../src/session';

/** A visit left open when the app closed resumes at its hub; otherwise, the door. */
export default function Index() {
  return <Redirect href={useCurrentTake() ? '/visit' : '/start'} />;
}
