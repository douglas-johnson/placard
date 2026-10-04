import { useSyncExternalStore } from 'react';
import { onAppend, resumeTake, type Take } from './take';

/**
 * The visit in progress, for every route that needs it (#28). App.tsx used to hold
 * it in useState and bump a counter to re-render the hub, because the flows mutate
 * the take object in place. Here the snapshot is replaced on every manifest append
 * or removal instead, so any screen reading it re-renders when a frame or a group
 * lands, with nothing to remember to call. Same shape as upload.ts's status store (#18).
 */
type Snapshot = { take: Take | null };

let snapshot: Snapshot = { take: resumeTake() };
const listeners = new Set<() => void>();

function publish(): void {
  snapshot = { take: snapshot.take };
  listeners.forEach((l) => l());
}

onAppend(publish);

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The visit in progress, or null between visits. */
export function useCurrentTake(): Take | null {
  return useSyncExternalStore(subscribe, () => snapshot).take;
}

/** A visit started, ended and let go, or deleted. */
export function setCurrentTake(take: Take | null): void {
  snapshot = { take };
  listeners.forEach((l) => l());
}
