/** Which overlay is open. Kept outside React so the menu commands can drive it. */
export type UiView = "closed" | "panel" | "lab";

export interface UiStore {
  get(): UiView;
  set(next: UiView): void;
  subscribe(listener: () => void): () => void;
}

export const createUiStore = (initial: UiView = "closed"): UiStore => {
  let current: UiView = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: (next) => {
      if (next === current) return;
      current = next;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
