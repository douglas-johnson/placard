import { useCallback, useState } from 'react';
import { saveFrame, type Take, type VenueSignKind } from '../take';
import { Capture, type Picture } from './Capture';

/**
 * Venue signage is a capture category, not a bookend (D26). On arrival the protocol
 * asks for three things in order; each is skippable because not every venue has
 * them, and "other" stays open for whatever the venue put by the door.
 */
const ARRIVAL: { kind: VenueSignKind; title: string; hint: string }[] = [
  { kind: 'name', title: 'The venue name', hint: 'As displayed — the sign, the door, the banner.' },
  {
    kind: 'hours_admission',
    title: 'Hours, admission, free days',
    hint: 'Any board stating hours, admission, free days or resident rules. The best frame of the day, last time.',
  },
  {
    kind: 'accessible_entrance',
    title: 'The accessible entrance sign',
    hint: 'Only if it is separate. Skip if it isn’t.',
  },
  { kind: 'other', title: 'Anything else by the door', hint: 'Shoot again for more; Done when there’s nothing left.' },
];

export function VenueFlow({ take, mode, onDone, onCancel }: { take: Take; mode: 'arrival' | 'exterior'; onDone: () => void; onCancel: () => void }) {
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [shots, setShots] = useState(0);

  const advance = useCallback(() => {
    if (mode === 'exterior' || index >= ARRIVAL.length - 1) onDone();
    else setIndex((i) => i + 1);
  }, [index, mode, onDone]);

  const onPicture = useCallback(
    async (pic: Picture) => {
      setBusy(true);
      try {
        await saveFrame(take, pic, {
          kind: mode === 'exterior' ? 'exterior' : 'venue_sign',
          group: null,
          gps: pic.gps,
          ...(mode === 'arrival' ? { sign_kind: ARRIVAL[index].kind } : {}),
        });
        setShots((n) => n + 1);
      } finally {
        setBusy(false);
      }
      // The first three prompts want one frame each; "other" and the exterior take many.
      if (mode === 'arrival' && ARRIVAL[index].kind !== 'other') advance();
    },
    [advance, index, mode, take],
  );

  if (mode === 'exterior') {
    return (
      <Capture
        title="The exterior"
        hint="On the way out. And any signage you missed on the way in."
        busy={busy}
        onPicture={onPicture}
        onBack={onCancel}
        actions={[{ label: shots > 0 ? 'Done' : 'Skip', onPress: onDone, tone: shots > 0 ? 'secondary' : 'quiet' }]}
      />
    );
  }

  const prompt = ARRIVAL[index];
  return (
    <Capture
      title={prompt.title}
      hint={prompt.hint}
      busy={busy}
      onPicture={onPicture}
      onBack={index === 0 ? onCancel : () => setIndex((i) => i - 1)}
      backLabel={index === 0 ? 'Cancel' : 'Back'}
      actions={[
        prompt.kind === 'other'
          ? { label: 'Done', onPress: onDone }
          : { label: 'Skip', onPress: advance, tone: 'quiet' },
      ]}
    />
  );
}
