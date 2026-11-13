import { useSyncExternalStore } from "react";

type Listener = () => void;

let clickCount = 0;
const listeners = new Set<Listener>();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): number {
  return clickCount;
}

/** Called by every fixture button so tests can prove clicks reach the originals. */
export function recordClick(): void {
  clickCount += 1;
  listeners.forEach((listener) => listener());
}

export function useClickCount(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
