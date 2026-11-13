/**
 * The colour an opaque base should take behind a stand-in's text. The original's own
 * background is used when it is opaque. Otherwise the nearest opaque ancestor wins, so a
 * transparent row on a white card gets white, not the theme colour. Returns null when no
 * opaque colour is found, and the caller falls back to the theme token.
 */

/** Matches a fully transparent colour in `rgba(...)`, `rgb(... / 0)` or `transparent`. */
const TRANSPARENT = /^transparent$|^rgba\(.*,\s*0(\.0+)?\)$|\/\s*0(\.0+)?\)$/;

const MAX_ANCESTORS = 12;

export const isOpaqueColor = (value: string): boolean => value !== "" && !TRANSPARENT.test(value.trim());

export const opaqueBackdrop = (el: Element): string | null => {
  let node: Element | null = el;
  for (let depth = 0; node && depth < MAX_ANCESTORS; depth += 1) {
    const color = getComputedStyle(node).backgroundColor;
    if (isOpaqueColor(color)) return color;
    node = node.parentElement;
  }
  return null;
};
