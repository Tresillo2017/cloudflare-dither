const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const LOGO_SELECTOR = 'svg[aria-label="Cloudflare logo"]';

/**
 * Serialises a live SVG into a data URL sized to `width` x `height` CSS px.
 * The clone is detached, so the original is never touched. Returns "" when the
 * element cannot be serialised (the caller then shows nothing).
 */
export const svgDataUrl = (svg: SVGSVGElement, width: number, height: number): string => {
  try {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", SVG_NAMESPACE);
    clone.setAttribute("width", String(Math.max(1, Math.round(width))));
    clone.setAttribute("height", String(Math.max(1, Math.round(height))));
    const markup = new XMLSerializer().serializeToString(clone);
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  } catch {
    return "";
  }
};

export interface PageLogo {
  readonly src: string;
  /** Width over height of the on-page logo. */
  readonly ratio: number;
}

/** Brand logo serialised at its current on-page size, or null when the page has none. */
export const pageLogo = (): PageLogo | null => {
  const svg = document.querySelector<SVGSVGElement>(LOGO_SELECTOR);
  if (!svg) return null;
  const box = svg.getBoundingClientRect();
  if (box.width <= 0 || box.height <= 0) return null;
  const src = svgDataUrl(svg, box.width, box.height);
  return src ? { src, ratio: box.width / box.height } : null;
};
