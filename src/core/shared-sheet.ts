import { createLog, type Log } from "./log";
import { buildHostTokenCss } from "./tokens";

/**
 * The one stylesheet every stand-in shadow root adopts: Tailwind utilities (no
 * preflight), stand-in tokens, and every component <style> block that was rewritten
 * to <DcfStyle> (see scripts/style-rewrite.mjs). Built with CSSOM, so page CSP
 * style-src does not apply to it.
 */
const hoisted = new Map<string, string>();
let log: Log = createLog(() => false);
let baseText: string | null = null;
let sheet: CSSStyleSheet | null = null;
let sheetFailed = false;

export const bindSharedSheetLog = (next: Log): void => {
  log = next;
};

const base = (): string => {
  if (baseText === null) {
    baseText = `${buildHostTokenCss()}\n${__DCF_TAILWIND_CSS__}`;
  }
  return baseText;
};

/** Full text of the shared sheet (also used by the <style> fallback). */
export const sharedCssText = (): string => [base(), ...hoisted.values()].join("\n");

/** Returns the constructable sheet, or null when the browser cannot build one. */
export const getSharedSheet = (): CSSStyleSheet | null => {
  if (sheet || sheetFailed) return sheet;
  try {
    const next = new CSSStyleSheet();
    next.replaceSync(sharedCssText());
    sheet = next;
  } catch (error) {
    sheetFailed = true;
    log.warn("constructable stylesheets unavailable, using <style> fallback", error);
  }
  return sheet;
};

/**
 * Registers CSS from a rewritten component <style> block. Idempotent per href.
 * Called during render, so it reports failures through the log and never throws.
 */
export const registerHoistedCss = (href: string, css: string): void => {
  if (hoisted.has(href)) return;
  hoisted.set(href, css);
  if (!sheet) return;
  try {
    sheet.replaceSync(sharedCssText());
  } catch (error) {
    log.warn(`could not add component styles for ${href}`, error);
  }
};
