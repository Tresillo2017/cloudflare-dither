export interface Router {
  subscribe(listener: () => void): () => void;
  start(): void;
  dispose(): void;
}

const POLL_MS = 500;

/**
 * Signals SPA navigation without patching history. Uses popstate, the Navigation API
 * when present, and a cheap href poll for pushState calls that fire no event.
 */
export const createRouter = (): Router => {
  const listeners = new Set<() => void>();
  let href = location.href;
  let timer: ReturnType<typeof setInterval> | null = null;
  const nav = (window as unknown as { navigation?: EventTarget }).navigation;

  const check = (): void => {
    if (location.href === href) return;
    href = location.href;
    for (const listener of listeners) listener();
  };

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start: () => {
      if (timer !== null) return;
      timer = setInterval(check, POLL_MS);
      window.addEventListener("popstate", check);
      window.addEventListener("hashchange", check);
      nav?.addEventListener("navigatesuccess", check);
    },
    dispose: () => {
      if (timer !== null) clearInterval(timer);
      timer = null;
      window.removeEventListener("popstate", check);
      window.removeEventListener("hashchange", check);
      nav?.removeEventListener("navigatesuccess", check);
      listeners.clear();
    },
  };
};
