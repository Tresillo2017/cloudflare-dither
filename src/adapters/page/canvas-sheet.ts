/**
 * Makes the Kumo canvas translucent while a page-level background is mounted. Keyed on
 * `html[data-dcf-bg]`, which only this module sets. Reference counted, so the hero and the
 * app background can hand over without restoring the canvas in between. Every failure is a
 * no-op: the page keeps its opaque canvas.
 */
import { DARK_PAPER } from "../../core/visual";

const BG_ATTRIBUTE = "data-dcf-bg";

const CANVAS_CSS = `
html[data-dcf-bg] body { background-color: transparent !important; }
/* Sidebar and app header: translucent tint so the one field reads through, calmly. */
html[data-dcf-bg] body header:not(main *):not([role="dialog"] *),
html[data-dcf-bg] body [data-sidebar] {
  background-color: color-mix(in oklab, var(--dcf-tint, #ffffff) 62%, transparent) !important;
}
/* Content column: clear, so the one field reads across the whole page. The field itself is kept
   sparse away from its origin corner, and cards, tables and inputs keep their own solid surfaces. */
html[data-dcf-bg] body div.bg-kumo-canvas:not(header),
html[data-dcf-bg] body footer.bg-kumo-canvas {
  background-color: transparent !important;
}
html[data-dcf-bg][data-mode="dark"] { --dcf-tint: ${DARK_PAPER}; --dcf-paper: ${DARK_PAPER}; }
`;

let users = 0;
let sheet: CSSStyleSheet | null = null;

const attach = (): void => {
  const root = document.documentElement;
  root.setAttribute(BG_ATTRIBUTE, "on");
  if (sheet !== null) return;
  try {
    const next = new CSSStyleSheet();
    next.replaceSync(CANVAS_CSS);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, next];
    sheet = next;
  } catch {
    // Adoption unavailable: the attribute alone changes nothing visible, so the page stays opaque.
    sheet = null;
  }
};

const detach = (): void => {
  document.documentElement.removeAttribute(BG_ATTRIBUTE);
  if (sheet === null) return;
  const current = sheet;
  sheet = null;
  document.adoptedStyleSheets = document.adoptedStyleSheets.filter((item) => item !== current);
};

/** Returns an idempotent release function. The last release restores the page exactly. */
export const acquireTranslucentCanvas = (): (() => void) => {
  users += 1;
  if (users === 1) attach();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    users = Math.max(0, users - 1);
    if (users === 0) detach();
  };
};
