import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Safe-area insets without react-native-safe-area-context, which isn't in the
 * TestFlight build and would force a native rebuild for a JS-only change. The
 * status-bar height is exact; the bottom inset is the home indicator, which every
 * iPhone with a tall status bar has. Revisit when a navigation library arrives.
 */
export function useInsets(): { top: number; bottom: number } {
  const top = Constants.statusBarHeight ?? 0;
  const bottom = Platform.OS === 'ios' && top > 24 ? 34 : 0;
  return { top, bottom };
}
