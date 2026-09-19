import { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { type, usePalette } from './theme';

/** Primary or secondary action. `tone="quiet"` is for the choices the app must offer but shouldn't nudge toward. */
export function Button({
  label,
  onPress,
  tone = 'primary',
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'secondary' | 'quiet';
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const p = usePalette();
  const bg =
    tone === 'primary' ? p.accent : tone === 'secondary' ? p.card : 'transparent';
  const fg = tone === 'primary' ? p.onAccent : tone === 'quiet' ? p.muted : p.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.65 : 1 },
        style,
      ]}
    >
      <Text style={[styles.buttonLabel, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/** A toggle chip — the multi-select for flags and hard cases. */
export function Chip({
  label,
  on,
  onPress,
}: {
  label: string;
  on: boolean;
  onPress: () => void;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: on ? p.accent : p.card,
          borderColor: on ? p.accent : p.rule,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text style={[type.small, { color: on ? p.onAccent : p.text }]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

export function Field({
  label,
  hint,
  ...input
}: { label: string; hint?: string } & TextInputProps) {
  const p = usePalette();
  return (
    <View style={styles.field}>
      <Text style={[type.small, { color: p.muted, marginBottom: 6 }]}>{label}</Text>
      <TextInput
        placeholderTextColor={p.pending}
        {...input}
        style={[
          styles.input,
          { color: p.text, borderColor: p.rule, backgroundColor: p.card },
          input.style,
        ]}
      />
      {hint ? (
        <Text style={[type.small, { color: p.muted, marginTop: 6 }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function Rule() {
  const p = usePalette();
  return <View style={[styles.rule, { backgroundColor: p.rule }]} />;
}

export function Screen({ children }: { children: ReactNode }) {
  const p = usePalette();
  return <View style={[styles.screen, { backgroundColor: p.bg }]}>{children}</View>;
}

export function H1({ children }: { children: ReactNode }) {
  const p = usePalette();
  return <Text style={[type.title, { color: p.text }]}>{children}</Text>;
}

export function H2({ children }: { children: ReactNode }) {
  const p = usePalette();
  return <Text style={[type.h2, { color: p.text, marginBottom: 8 }]}>{children}</Text>;
}

export function P({ children, muted }: { children: ReactNode; muted?: boolean }) {
  const p = usePalette();
  return (
    <Text style={[type.body, { color: muted ? p.muted : p.text, marginTop: 8 }]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonLabel: { fontSize: 15, fontWeight: '600' },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  field: { marginTop: 16 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  rule: { height: StyleSheet.hairlineWidth, marginVertical: 20 },
});
