/**
 * One position watcher for the whole session, so the shutter never waits on GPS.
 * Museums are indoors and a cold fix can take ten seconds; a frame taken with no fix
 * still gets saved (capture never fails offline — AGENTS.md), it just carries no GPS.
 *
 * The fix goes into the JPEG's EXIF via expo-camera's `additionalExif` — the file
 * itself is what tools/exif checks, so the manifest alone isn't enough (§4.1, D26).
 */
import * as Location from 'expo-location';

export type Gps = {
  latitude: number;
  longitude: number;
  /** Horizontal accuracy in metres, when the platform reports one. */
  accuracy: number | null;
  altitude: number | null;
  /** Unix ms of the fix — not of the frame. */
  timestamp: number;
};

let latest: Gps | null = null;
let subscription: Location.LocationSubscription | null = null;

function toGps(l: Location.LocationObject): Gps {
  return {
    latitude: l.coords.latitude,
    longitude: l.coords.longitude,
    accuracy: l.coords.accuracy ?? null,
    altitude: l.coords.altitude ?? null,
    timestamp: l.timestamp,
  };
}

export async function ensurePermission(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Location.requestForegroundPermissionsAsync();
  return asked.granted;
}

/** Start (or keep) the watcher. Safe to call repeatedly. */
export async function startWatching(): Promise<void> {
  if (subscription) return;
  if (!(await ensurePermission())) return;
  const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 });
  if (last) latest = toGps(last);
  subscription = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.High, distanceInterval: 5, timeInterval: 5000 },
    (l) => {
      latest = toGps(l);
    },
  );
}

export function stopWatching(): void {
  subscription?.remove();
  subscription = null;
}

/** The most recent fix, or null if there has never been one. Never blocks. */
export function latestFix(): Gps | null {
  return latest;
}

/**
 * Wait up to `timeoutMs` for a fix at least as fresh as `maxAgeMs`. Used on arrival,
 * where a few seconds of waiting buys a venue match; never used at the shutter.
 */
export async function awaitFix(timeoutMs = 8000, maxAgeMs = 60000): Promise<Gps | null> {
  await startWatching();
  const fresh = () => latest && Date.now() - latest.timestamp <= maxAgeMs;
  if (fresh()) return latest;
  try {
    const l = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    if (l) latest = toGps(l);
  } catch {
    // Location services off, or denied between the check and the call. The caller
    // handles null; the tester adds the venue by hand.
  }
  return latest;
}

/** EXIF GPS tags in the shape expo-camera's `additionalExif` writes into the file. */
export function exifFor(fix: Gps | null): Record<string, string | number> {
  if (!fix) return {};
  const d = new Date(fix.timestamp);
  const pad = (n: number) => String(n).padStart(2, '0');
  const tags: Record<string, string | number> = {
    GPSLatitude: fix.latitude,
    GPSLongitude: fix.longitude,
    GPSDateStamp: `${d.getUTCFullYear()}:${pad(d.getUTCMonth() + 1)}:${pad(d.getUTCDate())}`,
    GPSTimeStamp: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`,
  };
  if (fix.altitude != null) tags.GPSAltitude = fix.altitude;
  if (fix.accuracy != null) tags.GPSHPositioningError = fix.accuracy;
  return tags;
}
