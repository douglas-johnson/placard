import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { stopWatching, type Gps } from './location';
import type { Venue } from './registry';
import { currentTake } from './session';
import type { VenueRef } from './take';

/**
 * What the stages of starting a visit share (#29): the fix and the venues near it,
 * the venue chosen or added, for as long as the tester is in app/start/. It's gone
 * when they back out to the landing.
 */
export type Arrival = {
  /** Null until the first fix attempt finishes. */
  located: { fix: Gps | null; candidates: { venue: Venue; distance: number }[] } | null;
  venue: VenueRef | null;
  /** Set when the tester added the venue: a low-confidence claim (constraint 2). */
  added: { name: string; website: string | null } | null;
};

const ArrivalContext = createContext<{
  arrival: Arrival;
  update: (a: Partial<Arrival>) => void;
} | null>(null);

export function useArrival() {
  const c = useContext(ArrivalContext);
  if (!c) throw new Error('useArrival outside app/start/');
  return c;
}

export function ArrivalProvider({ children }: { children: ReactNode }) {
  const [arrival, setArrival] = useState<Arrival>({ located: null, venue: null, added: null });
  const update = (a: Partial<Arrival>) => setArrival((prev) => ({ ...prev, ...a }));
  // Locating started the position watcher. Backing out without starting a visit
  // stops it; a visit that started keeps it (app/_layout.tsx).
  useEffect(
    () => () => {
      if (!currentTake()) stopWatching();
    },
    [],
  );
  return <ArrivalContext.Provider value={{ arrival, update }}>{children}</ArrivalContext.Provider>;
}
