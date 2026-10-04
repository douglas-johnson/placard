import { useRouter } from 'expo-router';
import { useLabelGroup } from '../../../src/labelGroup';
import { Capture } from '../../../src/screens/Capture';

/** A · the label. The read-back opens at once and shows the reading as it happens. */
export default function LabelShot() {
  const router = useRouter();
  const g = useLabelGroup();
  const first = g.labelFrames.length === 0;
  return (
    <Capture
      title={first ? 'A · The label' : 'A · The label, continued'}
      hint="Whole label, filling the frame, square-on. This is the shot that matters."
      busy={g.reading}
      onPicture={(pic) => {
        g.readLabel(pic);
        router.push('/visit/label/readback');
      }}
      // Before the first frame there's no group yet, so leaving is free.
      onBack={first ? () => router.dismissTo('/visit') : () => router.push('/visit/label/readback')}
      backLabel={first ? 'Cancel' : 'Back'}
    />
  );
}
