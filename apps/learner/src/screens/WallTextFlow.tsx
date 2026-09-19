import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useInsets } from '../insets';
import { saveFrame, type Take } from '../take';
import { Button, H2, P, Screen } from '../ui';
import { Capture, type Picture } from './Capture';

/**
 * The interpretive panel — a different extraction problem from the label (§4.6), so a
 * different input. No read-back: there's nothing to confirm. It can be linked to the
 * label group just closed, because a label system can span several surfaces (D18).
 */
export function WallTextFlow({ take, onDone, onCancel }: { take: Take; onDone: () => void; onCancel: () => void }) {
  const insets = useInsets();
  const [linked, setLinked] = useState<string | null | undefined>(take.lastClosedGroup ? undefined : null);
  const [busy, setBusy] = useState(false);
  const [shots, setShots] = useState(0);

  const onPicture = useCallback(
    async (pic: Picture) => {
      setBusy(true);
      try {
        await saveFrame(take, pic, { kind: 'wall_text', group: null, gps: pic.gps, linked_group: linked ?? null });
        setShots((n) => n + 1);
      } finally {
        setBusy(false);
      }
    },
    [linked, take],
  );

  if (linked === undefined) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={[styles.sheet, { paddingTop: insets.top + 20 }]}>
          <H2>Does this go with the label you just shot?</H2>
          <P muted>Some labels come as a system — tombstone here, a paragraph there. Linking them keeps the pieces together.</P>
          <Button label="Yes, same work" onPress={() => setLinked(take.lastClosedGroup)} style={{ marginTop: 24 }} />
          <Button label="No, it stands alone" tone="secondary" onPress={() => setLinked(null)} />
          <Button label="Cancel" tone="quiet" onPress={onCancel} />
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Capture
      title={shots === 0 ? 'Wall text' : `Wall text (${shots} so far)`}
      hint="The panel, square-on, one frame per surface. Shoot again if it runs on."
      busy={busy}
      onPicture={onPicture}
      onBack={onCancel}
      actions={shots > 0 ? [{ label: 'Done', onPress: onDone }] : []}
    />
  );
}

const styles = StyleSheet.create({ sheet: { paddingHorizontal: 28 } });
