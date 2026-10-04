import { Text } from 'react-native';
import { type, usePalette } from '../theme';
import { type UploadStatus, useUploadStatus } from '../upload';

/**
 * What the queue is doing (D43), in one quiet line on the landing, the hub and Done.
 * It's information, not a choice: turning sending on or off, and the terms, are in
 * settings (#30, D50). What's left to send only ever counts down, and there is never an
 * "n of m" (constraint 5).
 */
export function UploadPanel() {
  const p = usePalette();
  const s = useUploadStatus();
  const warn = s.state === 'refused' || s.state === 'consent';
  return (
    <>
      <Text style={[type.small, { color: warn ? p.warn : p.muted }]}>{line(s)}</Text>
      {s.conflicts > 0 ? (
        <Text style={[type.small, { color: p.warn, marginTop: 4 }]}>
          {s.conflicts === 1 ? 'One thing' : `${s.conflicts} things`} the corpus wouldn't take.
          Worth mentioning to Doug.
        </Text>
      ) : null}
    </>
  );
}

function line(s: UploadStatus): string {
  const photos = s.frames === 1 ? 'one photo' : `${s.frames} photos`;
  switch (s.state) {
    case 'unavailable':
      return 'This build has nowhere to send photos — share the manifest instead.';
    case 'off':
      return 'Not sending. Your visits stay on this phone.';
    case 'consent':
      return "Sending is paused until you've read the terms in Settings.";
    case 'refused':
      return "The corpus didn't recognise this build. A newer one will sort it out — everything is safe on the phone meanwhile.";
    case 'waiting':
      return s.frames > 0
        ? `${cap(photos)} waiting for signal. They'll go on their own.`
        : "Waiting for signal to send the visit's notes.";
    case 'sending':
      return s.frames > 0 ? `Sending — ${photos} to go.` : "Sending the visit's notes.";
    default:
      return s.frames + s.records === 0
        ? 'Everything from this phone has reached the corpus.'
        : `${cap(photos)} still to send.`;
  }
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
