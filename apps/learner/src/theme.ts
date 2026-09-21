import { Platform, StyleSheet, useColorScheme } from 'react-native';

/**
 * One palette for the whole app. Warm paper in light mode, warm charcoal in dark;
 * the camera screens are always dark because the viewfinder is.
 */
export const light = {
  bg: '#FBFAF8',
  text: '#171614',
  muted: '#6E6A63',
  rule: '#DCD8D1',
  card: '#F2EFE9',
  accent: '#171614',
  onAccent: '#FBFAF8',
  ok: '#2F6B4F',
  warn: '#8A6A1F',
  fail: '#9B3B32',
  pending: '#9A958D',
};

export const dark = {
  bg: '#141311',
  text: '#F2EFE9',
  muted: '#9A958D',
  rule: '#2E2C28',
  card: '#1E1C19',
  accent: '#F2EFE9',
  onAccent: '#141311',
  ok: '#7FB79A',
  warn: '#D3AE62',
  fail: '#D98A80',
  pending: '#6E6A63',
};

export type Palette = typeof light;

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export const serif = Platform.select({ ios: 'Hoefler Text', default: 'serif' });

export const type = StyleSheet.create({
  title: { fontSize: 34, letterSpacing: -0.5, fontFamily: serif },
  h2: { fontSize: 22, letterSpacing: -0.3, fontFamily: serif },
  body: { fontSize: 15, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 19 },
  mono: {
    fontSize: 17,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontVariant: ['tabular-nums'],
  },
});
