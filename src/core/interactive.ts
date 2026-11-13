/**
 * Elements a visual stand-in must never hide. Sibling-replace hides its target with opacity,
 * which cascades to every descendant: a control nested in such a target would become
 * invisible while staying clickable and focusable.
 */
export const INTERACTIVE_SELECTOR = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "summary",
  '[tabindex]:not([tabindex="-1"])',
  '[role="button"]',
  '[role="link"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="slider"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[contenteditable]:not([contenteditable="false"])',
].join(",");

/** True when a control lives inside `el` (the element itself does not count). */
export const hasInteractiveDescendant = (el: Element): boolean =>
  el.querySelector(INTERACTIVE_SELECTOR) !== null;
