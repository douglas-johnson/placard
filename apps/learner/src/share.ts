import { Share } from 'react-native';
import { manifestFile, type Take } from './take';

/**
 * The manifest goes out through the share sheet — AirDrop, Files, Mail. The frames
 * are already in the camera roll. It is the only thing that turns the camera roll's
 * randomly named copies back into groups, roles and confirmations
 * (tools/manifest/bind-frames.py), so every screen that can see a take offers this.
 */
export async function shareManifest(take: Take): Promise<void> {
  const f = manifestFile(take);
  if (!f.exists) return;
  try {
    await Share.share({ url: f.uri, title: `${take.id} manifest` });
  } catch (e) {
    console.warn('[share] manifest share failed', e);
  }
}
