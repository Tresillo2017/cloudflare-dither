import type { Adapter } from "../../core";
import { DitherRule } from "../../core/dither-rim";
import { CELL_PX_SMALL } from "../../core/visual";

const MAX_H1 = 2;
const MAX_H2 = 6;
/** Solid brand hairline of the accent, px. */
const ACCENT_LINE_PX = 2;
/** Dithered falloff under the hairline, in cells of CELL_PX_SMALL. */
const ACCENT_DEPTH_CELLS = 3;

/**
 * Heading accent. The heading keeps its own solid text, so no dither ever sits behind or through
 * a glyph (VISUAL-SPEC: dither-text only if fully legible, otherwise a dithered accent). The
 * underlay is the heading's own box: a solid brand bar with a dithered falloff under it, set on
 * the bottom edge below the baseline. Nothing is drawn over the letters.
 */
const TitleAccent = () => (
  <div
    data-dcf-visual="title"
    className="absolute inset-x-0 bottom-0 overflow-hidden"
    style={{ height: ACCENT_LINE_PX + ACCENT_DEPTH_CELLS * CELL_PX_SMALL }}
  >
    <DitherRule edge="bottom" cell={CELL_PX_SMALL} tone="brand" thickness={ACCENT_LINE_PX} depth={ACCENT_DEPTH_CELLS} level={0.75} />
  </div>
);

const isOutsideDialog = (el: Element): boolean => el.closest('[role="dialog"]') === null;
const hasText = (el: Element): boolean => (el.textContent ?? "").trim().length > 0;

const titleAdapter = (tag: "h1" | "h2", id: string, label: string, maxInstances: number, defaultEnabled: boolean): Adapter => ({
  id,
  label,
  group: "text",
  ditherComponents: [],
  selectors: [{ selector: tag, confidence: "high", source: `semantic ${tag} heading` }],
  defaultEnabled,
  maxInstances,
  match: (el) => el.closest("[data-dcf-host]") === null && isOutsideDialog(el) && hasText(el),
  mode: "underlay-child",
  render: () => <TitleAccent />,
});

export const titleH1Adapter = titleAdapter("h1", "title-h1", "Page title accent (h1)", MAX_H1, true);
export const titleH2Adapter = titleAdapter("h2", "title-h2", "Section title accent (h2)", MAX_H2, false);
