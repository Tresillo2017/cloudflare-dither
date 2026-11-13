import type { Rect } from "./host";

type RectListener = (rect: Rect) => void;
type VisibilityListener = (visible: boolean) => void;

/** Viewport margin: stand-ins mount slightly before they scroll into view. */
export const VIEWPORT_MARGIN = "320px 0px 320px 0px";
const VERTICAL_MARGIN_PX = 320;

/** Same rule as VIEWPORT_MARGIN: a non-empty box within the viewport plus vertical margin. */
const measureVisible = (el: Element): boolean => {
  const box = el.getBoundingClientRect();
  if (box.width <= 0 || box.height <= 0) return false;
  return (
    box.bottom >= -VERTICAL_MARGIN_PX &&
    box.top <= window.innerHeight + VERTICAL_MARGIN_PX &&
    box.right >= 0 &&
    box.left <= window.innerWidth
  );
};

export interface SharedObservers {
  observeSize(el: Element, listener: RectListener): () => void;
  observeVisibility(el: Element, listener: VisibilityListener): () => void;
  /** Disconnects both observers (tab hidden or master off). */
  pause(): void;
  /** Re-observes everything that is still registered. */
  resume(): void;
}

/**
 * One ResizeObserver and one IntersectionObserver for every target. Each element is
 * observed once no matter how many listeners want it; the last unsubscribe unobserves it.
 */
export const createSharedObservers = (): SharedObservers => {
  const sizeListeners = new Map<Element, Set<RectListener>>();
  const visibilityListeners = new Map<Element, Set<VisibilityListener>>();
  const lastVisible = new WeakMap<Element, boolean>();
  let paused = false;

  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const listeners = sizeListeners.get(entry.target);
      if (!listeners) continue;
      const rect = { width: entry.contentRect.width, height: entry.contentRect.height };
      for (const listener of listeners) listener(rect);
    }
  });

  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const listeners = visibilityListeners.get(entry.target);
        if (!listeners) continue;
        lastVisible.set(entry.target, entry.isIntersecting);
        for (const listener of listeners) listener(entry.isIntersecting);
      }
    },
    { rootMargin: VIEWPORT_MARGIN },
  );

  /**
   * Backstop for the IntersectionObserver. In practice an element that scrolls out and back
   * in can stop reporting, so scroll and resize re-measure every observed element against the
   * same margin and notify listeners only when the answer changed.
   */
  let recheckFrame: number | null = null;
  const recheckVisibility = (): void => {
    recheckFrame = null;
    if (paused) return;
    for (const [el, listeners] of visibilityListeners) {
      const visible = measureVisible(el);
      if (lastVisible.get(el) === visible) continue;
      lastVisible.set(el, visible);
      for (const listener of listeners) listener(visible);
    }
  };
  const scheduleRecheck = (): void => {
    if (recheckFrame === null) recheckFrame = requestAnimationFrame(recheckVisibility);
  };
  window.addEventListener("scroll", scheduleRecheck, { capture: true, passive: true });
  window.addEventListener("resize", scheduleRecheck, { passive: true });

  const addTo = <T>(map: Map<Element, Set<T>>, el: Element, listener: T, observe: (el: Element) => void): (() => void) => {
    const existing = map.get(el);
    if (existing) {
      existing.add(listener);
    } else {
      map.set(el, new Set([listener]));
      if (!paused) observe(el);
    }
    return () => {
      const set = map.get(el);
      if (!set) return;
      set.delete(listener);
      if (set.size > 0) return;
      map.delete(el);
      if (!paused) unobserveOne(el);
    };
  };

  const unobserveOne = (el: Element): void => {
    resizeObserver.unobserve(el);
    intersectionObserver.unobserve(el);
  };

  return {
    observeSize: (el, listener) =>
      addTo(sizeListeners, el, listener, (node) => resizeObserver.observe(node)),
    observeVisibility: (el, listener) => {
      const cached = lastVisible.get(el);
      if (cached !== undefined) listener(cached);
      return addTo(visibilityListeners, el, listener, (node) => intersectionObserver.observe(node));
    },
    pause: () => {
      if (paused) return;
      paused = true;
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
    },
    resume: () => {
      if (!paused) return;
      paused = false;
      for (const el of sizeListeners.keys()) resizeObserver.observe(el);
      for (const el of visibilityListeners.keys()) intersectionObserver.observe(el);
    },
  };
};
