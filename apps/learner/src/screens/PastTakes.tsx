import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { shareManifest } from '../share';
import { listTakes, type Take } from '../take';
import { type, usePalette } from '../theme';
import { P } from '../ui';

/**
 * Earlier visits on this phone, each a tap from its manifest. Shown on the hub and
 * on Arrive: after the Met (field-beta §6.1) the list lived only on the hub, which
 * needs an open take, so a finished visit's manifest had no door until the next
 * visit began.
 */
export function PastTakes({ except }: { except?: string }) {
  const p = usePalette();
  const [open, setOpen] = useState(false);
  const past = open ? listTakes().filter((t) => t.id !== except) : [];
  return (
    <>
      <Pressable onPress={() => setOpen((o) => !o)} hitSlop={8}>
        <Text style={[type.small, { color: p.muted }]}>{open ? 'Hide earlier visits' : 'Earlier visits'}</Text>
      </Pressable>
      {open
        ? past.length === 0
          ? <P muted>{except ? 'This is the first.' : 'None on this phone yet.'}</P>
          : past.map((t: Take) => (
              <Pressable key={t.id} onPress={() => shareManifest(t)} style={[styles.row, { borderColor: p.rule }]}>
                <Text style={[type.body, { color: p.text }]}>{t.venue.name}</Text>
                <Text style={[type.small, { color: p.muted }]}>
                  {t.id} · {t.counts.labels} labels · {t.counts.frames} frames · tap to share
                </Text>
              </Pressable>
            ))
        : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
});
