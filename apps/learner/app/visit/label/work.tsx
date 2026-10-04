import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLabelGroup } from '../../../src/labelGroup';
import { Capture } from '../../../src/screens/Capture';
import { type } from '../../../src/theme';

/** B · the work(s): one frame per object the label governs, or a reason there isn't one. */
export default function Work() {
  const router = useRouter();
  const g = useLabelGroup();
  const [busy, setBusy] = useState(false);
  return (
    <Capture
      title={g.works === 0 ? 'B · The work' : `B · Another work (${g.works} so far)`}
      hint="One frame per object this label governs. Shoot again for the next; Done when there are no more."
      busy={busy}
      onPicture={async (pic) => {
        setBusy(true);
        try {
          await g.saveWork(pic);
        } finally {
          setBusy(false);
        }
      }}
      // Back to the read-back; settling again there is recorded as a correction (D51).
      onBack={() => router.back()}
      actions={
        g.works === 0
          ? [
              {
                label: 'No work photo…',
                onPress: () => router.push('/visit/label/no-work'),
                tone: 'quiet',
              },
            ]
          : [{ label: 'Done', onPress: () => router.push('/visit/label/flags') }]
      }
    >
      {g.accession?.value ? (
        <View style={styles.badge}>
          <Text style={[type.mono, { color: '#F2EFE9' }]}>{g.accession.value}</Text>
        </View>
      ) : null}
    </Capture>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 150,
    right: 16,
    backgroundColor: 'rgba(20,19,17,0.72)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
});
