import { registerHoistedCss } from "./shared-sheet";

/**
 * Replaces the <style href precedence>{css}</style> blocks of vendored dithercn
 * components (rewritten at build time). Registers the CSS in the shared sheet and
 * renders nothing, so React never inserts a <style> element that page CSP would block.
 */
export const DcfStyle = ({ href, css }: { href: string; css: string }) => {
  registerHoistedCss(href, css);
  return null;
};
