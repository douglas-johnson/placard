import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useLabelGroup } from '../../../src/labelGroup';
import { Capture } from '../../../src/screens/Capture';

/** C · the accession line, offered only when the label frame read nothing accession-shaped. */
export default function Crop() {
  const router = useRouter();
  const g = useLabelGroup();
  const [busy, setBusy] = useState(false);
  return (
    <Capture
      title="C · The accession line"
      hint="Tight on the number. Only because the full frame didn't read it."
      busy={busy}
      onPicture={async (pic) => {
        setBusy(true);
        try {
          await g.saveCrop(pic);
        } finally {
          setBusy(false);
          router.back();
        }
      }}
      onBack={() => router.back()}
    />
  );
}
