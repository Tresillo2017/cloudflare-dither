/** Shared readers for feedback targets. Pure functions, no DOM writes. */

/** Text of the element an aria-labelledby points at, or its aria-label. */
export const readAccessibleLabel = (el: Element, fallback: string): string => {
  const labelledBy = el.getAttribute("aria-labelledby");
  const labelled = labelledBy ? document.getElementById(labelledBy)?.textContent?.trim() : undefined;
  if (labelled) return labelled;
  return el.getAttribute("aria-label")?.trim() || fallback;
};

/** Parses a numeric attribute; returns null when absent or not a finite number. */
export const readNumberAttribute = (el: Element, name: string): number | null => {
  const raw = el.getAttribute(name);
  if (raw === null || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
};
