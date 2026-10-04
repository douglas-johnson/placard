import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Take } from '../take';
import { type, usePalette } from '../theme';
import { Button, P } from '../ui';
import { deleteUnsent, sentAnything, useUploadStatus } from '../upload';

/**
 * Deleting a whole visit, for one that never reached the corpus (D48): a visit shot
 * while sending was off, or one that hasn't found signal yet. Once anything of it
 * has been sent, it's evidence like any other take, and the bucket's copy is
 * tools/redact's to remove, so there's no action here at all.
 *
 * Shown on an earlier visit and on the hub, so a visit shot only to try the app
 * doesn't have to be finished before it can go.
 */
export function DeleteVisit({ take, onDeleted }: { take: Take; onDeleted: () => void }) {
  const p = usePalette();
  // Re-read the ledger whenever the queue moves: a visit can stop being deletable
  // while this screen is open.
  useUploadStatus();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (sentAnything(take) && !error) return null;

  const del = async () => {
    setBusy(true);
    try {
      if (await deleteUnsent(take)) {
        onDeleted();
        return;
      }
      setError(
        "Part of this visit was sent while you were deciding, so it can't be deleted here. Tell Doug — it needs the redaction tool.",
      );
    } catch (e) {
      setError(`Couldn't delete it: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  const photos = take.counts.frames;

  return (
    <View style={{ marginTop: 20 }}>
      {error ? <Text style={[type.small, { color: p.warn }]}>{error}</Text> : null}
      {!confirming && !error ? (
        <Pressable onPress={() => setConfirming(true)} hitSlop={8}>
          <Text style={[type.small, { color: p.muted }]}>Delete this visit…</Text>
        </Pressable>
      ) : null}
      {confirming ? (
        <View style={[styles.confirm, { backgroundColor: p.card }]}>
          <Text style={[type.body, { color: p.text }]}>Delete this visit from the phone?</Text>
          <P muted>
            {photos === 0
              ? 'There are no photos in it, just the record of the visit.'
              : `Its ${photos === 1 ? 'photo' : `${photos} photos`} and the record of the visit go for good.`}{' '}
            Nothing from it has been sent, so there's no other copy to chase.
          </P>
          {photos > 0 ? (
            <P muted>The copies in your camera roll are separate. Delete those in Photos.</P>
          ) : null}
          <Button label="Delete it" onPress={del} disabled={busy} />
          <Button label="Keep it" tone="quiet" onPress={() => setConfirming(false)} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  confirm: { marginTop: 10, padding: 14, borderRadius: 10 },
});
