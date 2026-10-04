import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLabelGroup } from '../../../src/labelGroup';
import type { NoWorkReason } from '../../../src/take';
import { Button, Chip, ChipRow, H2, P, Screen } from '../../../src/ui';

const NO_WORK_REASONS: { value: NoWorkReason; label: string }[] = [
  { value: 'photography_prohibited', label: 'Photography prohibited' },
  { value: 'case_many_objects', label: "It's a case of many objects" },
  { value: 'building_or_site', label: "It's a building or a site" },
  { value: 'other', label: 'Something else' },
];

/** Why there's no work frame. The reason is data (D23, D12). */
export default function NoWork() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const g = useLabelGroup();
  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[
          styles.sheet,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <H2>No work photo — why?</H2>
        <P muted>The reason is worth as much as the frame would have been.</P>
        <ChipRow>
          {NO_WORK_REASONS.map((r) => (
            <Chip
              key={r.value}
              label={r.label}
              on={g.noWorkReason === r.value}
              onPress={() => g.setNoWorkReason(r.value)}
            />
          ))}
        </ChipRow>
        <Button
          label="Continue"
          onPress={() => router.push('/visit/label/flags')}
          disabled={!g.noWorkReason}
          style={{ marginTop: 20 }}
        />
        <Button label="Actually, I can shoot it" tone="quiet" onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingHorizontal: 28 },
});
