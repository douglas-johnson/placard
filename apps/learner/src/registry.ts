/**
 * The venue registry, bundled from data/venues/ (see metro.config.js). This is the
 * GPS→candidate-set prior from §4.1b: on arrival the app offers the venues near the
 * fix and the tester picks one, or adds one (field-beta §3).
 *
 * Adding a venue to the corpus means adding it to data/venues/ AND to the list below.
 * Metro can't glob a directory, so the list is explicit; it's short.
 */
import mcny from '../../../data/venues/mcny.json';
import met from '../../../data/venues/met.json';

export type AccessionShape = { pattern: string; example?: string; sample_count?: number };

export type Venue = {
  slug: string;
  name: string;
  location: { latitude: number; longitude: number; city?: string; region?: string };
  /** Compiled once. Patterns LOCATE and RANK accession tokens; nothing is rejected (D11). */
  shapes: RegExp[];
};

function compile(raw: unknown): RegExp[] {
  // Two spellings exist in the registry: a bare list (the _example) and an object
  // with a `shapes` list and a policy note (mcny). Accept both.
  const list: AccessionShape[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && Array.isArray((raw as any).shapes)
      ? (raw as any).shapes
      : [];
  return list.flatMap((s) => {
    try {
      return [new RegExp(s.pattern)];
    } catch {
      return [];
    }
  });
}

function load(raw: any): Venue {
  return {
    slug: raw.slug,
    name: raw.name,
    location: raw.location,
    shapes: compile(raw.accession_formats),
  };
}

export const venues: Venue[] = [load(mcny), load(met)];

/** Great-circle distance in metres. */
export function distanceMetres(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Registry venues within `radius` metres of the fix, nearest first. */
export function nearby(
  fix: { latitude: number; longitude: number },
  radius = 1500,
): { venue: Venue; distance: number }[] {
  return venues
    .map((venue) => ({ venue, distance: distanceMetres(fix, venue.location) }))
    .filter((c) => c.distance <= radius)
    .sort((a, b) => a.distance - b.distance);
}

export function bySlug(slug: string | null): Venue | undefined {
  return slug ? venues.find((v) => v.slug === slug) : undefined;
}

/** `Museum of the City of New York` → `museum-of-the-city-of-new-york`. Used for tester-added venues. */
export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 48) || 'venue'
  );
}
