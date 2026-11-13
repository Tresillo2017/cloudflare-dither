import { useEffect, useState, type RefObject } from "react";

/** Tiles mount a little before they scroll into view, so the content is ready. */
export const LAB_ROOT_MARGIN = "120px";

/** Tracks whether `target` is near `root` (the Lab's scroll container). */
export const useInView = (target: RefObject<Element | null>, root: RefObject<Element | null>): boolean => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = target.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const latest = entries[entries.length - 1];
        if (latest) setVisible(latest.isIntersecting);
      },
      { root: root.current, rootMargin: LAB_ROOT_MARGIN, threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, root]);
  return visible;
};
