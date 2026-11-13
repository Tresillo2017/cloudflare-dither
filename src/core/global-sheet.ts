import type { Restorable } from "./owned";
import { buildPageTokenCss } from "./tokens";
import type { Log } from "./log";
import GLOBAL_CSS from "../../styles/global.css";

const GLOBAL_STYLE_ID = "dcf-global-style";

/**
 * Adds the page-level sheet (dcf- rules + --dither-* on :root) to
 * document.adoptedStyleSheets. Only our own sheet is removed on restore.
 * Falls back to a single <style> in <head> when adoption is unavailable.
 */
export const installGlobalSheet = (log: Log): Restorable => {
  const cssText = `${GLOBAL_CSS}\n${buildPageTokenCss()}`;
  try {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(cssText);
    const previous = [...document.adoptedStyleSheets];
    document.adoptedStyleSheets = [...previous, sheet];
    return {
      restore: () => {
        document.adoptedStyleSheets = document.adoptedStyleSheets.filter((item) => item !== sheet);
      },
    };
  } catch (error) {
    log.warn("document stylesheet adoption failed, using <style> fallback", error);
    const style = document.createElement("style");
    style.id = GLOBAL_STYLE_ID;
    style.textContent = cssText;
    document.head.append(style);
    return { restore: () => style.remove() };
  }
};
