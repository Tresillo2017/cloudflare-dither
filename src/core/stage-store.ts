import type { Adapter } from "./types";
import type { Settings } from "./settings";
import type { ThemeName } from "./theme";
import type { Rect } from "./host";

/** Immutable view of one mounted stand-in, as the portal renders it. */
export interface MountView {
  readonly key: string;
  readonly adapter: Adapter;
  readonly target: Element;
  readonly rect: Rect;
  readonly mountEl: HTMLElement;
  readonly theme: ThemeName;
  readonly settings: Settings;
  readonly onFail: (error: unknown) => void;
}

export interface StageSnapshot {
  readonly mounts: readonly MountView[];
  readonly theme: ThemeName;
  readonly settings: Settings;
}

export interface StageStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): StageSnapshot;
  publish(next: StageSnapshot): void;
}

export const createStageStore = (initial: StageSnapshot): StageStore => {
  let snapshot = initial;
  const listeners = new Set<() => void>();
  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    publish: (next) => {
      snapshot = next;
      for (const listener of listeners) listener();
    },
  };
};
