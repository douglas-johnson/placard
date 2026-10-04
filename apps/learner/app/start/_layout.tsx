import { Stack } from 'expo-router';
import { ArrivalProvider } from '../../src/arrival';
import { usePalette } from '../../src/theme';

/**
 * Starting a visit (#29): where are we, then the thirty-second field log. Each stage
 * is a screen: `index` locates and offers the venues nearby, `add` is somewhere else,
 * `log` is the field log and Start. What they share is src/arrival.tsx.
 *
 * Locating waits on GPS — the one place in the app that does — because a venue match
 * is worth a few seconds at the door and nothing at the shutter (field-beta §3). It
 * happens behind "Start a visit", so opening the app to look at an earlier visit
 * never asks for location.
 */
export default function StartLayout() {
  const p = usePalette();
  return (
    <ArrivalProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.bg } }} />
    </ArrivalProvider>
  );
}
