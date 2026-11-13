import type { CSSProperties } from "react";

/** The computed type and colour of the original, so a stand-in wraps and aligns like the text it replaces. */
export const readTypography = (el: Element): CSSProperties => {
  const style = getComputedStyle(el);
  return {
    color: style.color,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    letterSpacing: style.letterSpacing,
    lineHeight: style.lineHeight,
    textAlign: style.textAlign as CSSProperties["textAlign"],
    textTransform: style.textTransform as CSSProperties["textTransform"],
  };
};

/** Visible text of an element, trimmed and whitespace collapsed. */
export const readText = (el: Element): string => (el.textContent ?? "").replace(/\s+/g, " ").trim();
