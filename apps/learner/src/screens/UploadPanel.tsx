import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type, usePalette } from '../theme';
import { Button, P } from '../ui';
import { contributor, setUploading, type UploadStatus, useUploadStatus } from '../upload';

/**
 * The opt-in and what the queue is doing (D43). Off until the tester says so: a
 * contribution leaves the phone only after the tester has been told where it goes
 * (field-beta §1). F1's consent screen replaces the opt-in with the three per-kind
 * properties. What's left to send only ever counts down, and there is never an
 * "n of m" (constraint 5).
 */
export function UploadPanel() {
  const p = usePalette();
  const s = useUploadStatus();
  if (s.state === 'unavailable') {
    return <Text style={[type.small, { color: p.muted }]}>This build has nowhere to send photos — share the manifest instead.</Text>;
  }
  const id = contributor().id;
  if (s.state === 'off') {
    return (
      <View>
        <Text style={[type.body, { color: p.text, fontWeight: '600' }]}>Send your visits to the corpus?</Text>
        <P muted>
          From your next visit on, the labels, works and signs you shoot would go to a private research store the
          project works from, and the transcriptions made from them become public. Nothing about you goes with them —
          only a random ID this phone made up. Visits already on the phone stay here.
        </P>
        <Button label="Send them" tone="secondary" onPress={() => setUploading(true)} />
      </View>
    );
  }
  return (
    <View>
      <Text style={[type.body, { color: s.state === 'refused' ? p.warn : p.text }]}>{line(s)}</Text>
      {s.conflicts > 0 ? (
        <Text style={[type.small, { color: p.warn, marginTop: 4 }]}>
          {s.conflicts === 1 ? 'One thing' : `${s.conflicts} things`} the corpus wouldn't take. Worth mentioning to Doug.
        </Text>
      ) : null}
      <View style={styles.row}>
        <Text style={[type.small, { color: p.pending }]}>Sending as {id}</Text>
        <Pressable onPress={() => setUploading(false)} hitSlop={8}>
          <Text style={[type.small, { color: p.muted }]}>Stop sending</Text>
        </Pressable>
      </View>
    </View>
  );
}

function line(s: UploadStatus): string {
  const photos = s.frames === 1 ? 'one photo' : `${s.frames} photos`;
  switch (s.state) {
    case 'refused':
      return "The corpus didn't recognise this build. A newer one will sort it out — everything is safe on the phone meanwhile.";
    case 'waiting':
      return s.frames > 0 ? `${cap(photos)} waiting for signal. They'll go on their own.` : "Waiting for signal to send the visit's notes.";
    case 'sending':
      return s.frames > 0 ? `Sending — ${photos} to go.` : "Sending the visit's notes.";
    default:
      return s.frames + s.records === 0 ? 'Everything from this phone has reached the corpus.' : `${cap(photos)} still to send.`;
  }
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
});
