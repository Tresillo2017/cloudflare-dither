import type { Adapter } from "./types";
import type { Log } from "./log";

/**
 * Finds elements matching any selector of `adapter` inside `roots` (each root itself
 * included). Invalid selectors are reported and skipped, never thrown.
 */
export const findCandidates = (adapter: Adapter, roots: readonly Element[], log: Log): Element[] => {
  const found = new Set<Element>();
  for (const spec of adapter.selectors) {
    for (const root of roots) {
      try {
        if (root.matches(spec.selector)) found.add(root);
        for (const el of root.querySelectorAll(spec.selector)) found.add(el);
      } catch (error) {
        log.warn(`selector failed for ${adapter.id}: ${spec.selector}`, error);
      }
    }
  }
  return [...found];
};

/** True when `el` is one of our own stand-in hosts (or inside one). */
export const isOwnHost = (el: Element): boolean => el.hasAttribute("data-dcf-host");
