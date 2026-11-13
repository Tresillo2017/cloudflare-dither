import type { KeyboardEvent as ReactKeyboardEvent } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
  '[role="slider"]',
  '[role="switch"]',
  '[role="tab"]',
].join(",");

/** Focusable elements inside the panel's own shadow root, in document order. */
export const focusableIn = (root: ParentNode): HTMLElement[] =>
  [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.hasAttribute("disabled") && el.tabIndex >= 0);

/** Keeps Tab and Shift+Tab inside the container. Works through the shadow root. */
export const trapTab = (event: ReactKeyboardEvent<HTMLElement>): void => {
  if (event.key !== "Tab") return;
  const container = event.currentTarget;
  const root = container.getRootNode() as ShadowRoot | Document;
  const items = focusableIn(container);
  if (items.length === 0) return;
  const active = root.activeElement as HTMLElement | null;
  const index = active ? items.indexOf(active) : -1;
  const last = items.length - 1;
  if (event.shiftKey && (index <= 0)) {
    event.preventDefault();
    items[last]?.focus();
  } else if (!event.shiftKey && (index === -1 || index === last)) {
    event.preventDefault();
    items[0]?.focus();
  }
};
