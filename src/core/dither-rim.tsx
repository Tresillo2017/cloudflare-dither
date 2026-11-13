/**
 * Rules and rims built from the visual.ts recipes. Both share one shape: a solid hairline on the
 * edge, plus a continuous dithered falloff inward. Used by dividers, list rules, field and card
 * rims, the account switcher and the title accent. Visual only (aria-hidden, pointer-free).
 */
import type { CSSProperties } from "react";

import { FALLOFF_CELLS, FALLOFF_LEVEL, RULE_INK, falloffStyle, toneColor, type RuleEdge, type Tone } from "./visual";
import type { DitherColor } from "@/lib/dither/tokens";

/** Colour of a rule or rim: a semantic tone, a dithercn colour name, or the neutral hairline. */
export type RuleTone = Tone | DitherColor | "ink";

const STRIP_STYLE: Record<RuleEdge, (depth: string) => CSSProperties> = {
  top: (depth) => ({ top: 0, left: 0, right: 0, height: depth }),
  bottom: (depth) => ({ bottom: 0, left: 0, right: 0, height: depth }),
  left: (depth) => ({ top: 0, bottom: 0, left: 0, width: depth }),
  right: (depth) => ({ top: 0, bottom: 0, right: 0, width: depth }),
};

const LINE_STYLE: Record<RuleEdge, (px: number) => CSSProperties> = {
  top: (px) => ({ top: 0, left: 0, right: 0, height: px }),
  bottom: (px) => ({ bottom: 0, left: 0, right: 0, height: px }),
  left: (px) => ({ top: 0, bottom: 0, left: 0, width: px }),
  right: (px) => ({ top: 0, bottom: 0, right: 0, width: px }),
};

const SEMANTIC_TONES: readonly Tone[] = ["brand", "danger", "success", "warning", "info", "neutral"];

/**
 * Colour of a falloff. Neutral falloff uses the same dim rule ink as the hairline: at full page ink,
 * a sparse dither reads as bright white dashes on the real pages.
 */
const falloffColor = (tone: RuleTone): Tone | string => (tone === "ink" ? RULE_INK : tone);

/** Solid colour of the hairline: the neutral rule ink, or the semantic tone's own colour. */
const lineColor = (tone: RuleTone): string =>
  (SEMANTIC_TONES as readonly string[]).includes(tone) ? toneColor(tone as Tone) : RULE_INK;

interface RuleProps {
  /** Edge the hairline sits on. The falloff runs inward from it. */
  edge: RuleEdge;
  cell: number;
  tone?: RuleTone;
  /** Hairline thickness in px. */
  thickness?: number;
  /** Falloff depth in cells. 0 draws the hairline alone. */
  depth?: number;
  /** Falloff strength on the edge, 0 to 1. */
  level?: number;
}

/** A solid hairline on one edge with a dithered falloff inward. Position it inside a relative parent. */
export const DitherRule = ({
  edge,
  cell,
  tone = "ink",
  thickness = 1,
  depth = FALLOFF_CELLS,
  level = FALLOFF_LEVEL,
}: RuleProps) => (
  <>
    {/* Falloff first, so the solid hairline on the same edge is painted over the dither. */}
    {depth > 0 ? (
      <div
        data-dcf-visual="rule-falloff"
        className="absolute"
        style={{ ...STRIP_STYLE[edge](`${depth * cell}px`), ...falloffStyle(falloffColor(tone), edge, cell, depth, level) }}
      />
    ) : null}
    <div
      data-dcf-visual="rule-line"
      className="absolute"
      style={{ ...LINE_STYLE[edge](thickness), backgroundColor: lineColor(tone) }}
    />
  </>
);

interface RimProps {
  cell: number;
  /** CSS corner radius of the box (for example "8px"). The rim follows it. */
  radius: string;
  tone?: RuleTone;
  depth?: number;
  level?: number;
}

/**
 * The rim of every raised surface (buttons, fields, cards): one solid hairline on all four sides,
 * plus a dithered shade rising from the bottom edge. A falloff on every side of a narrow frame
 * reads as a dotted chain on the real pages, so the shade sits on one edge only, like a lit
 * surface. The parent must be the same size as the box, and it clips to the radius.
 */
export const DitherRim = ({ cell, radius, tone = "ink", depth = FALLOFF_CELLS, level = FALLOFF_LEVEL }: RimProps) => {
  const size = `${depth * cell}px`;
  const edges: RuleEdge[] = ["bottom"];
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: radius }}>
      {depth > 0
        ? edges.map((edge) => (
            <div
              key={edge}
              data-dcf-visual="rim-falloff"
              className="absolute"
              style={{ ...STRIP_STYLE[edge](size), ...falloffStyle(falloffColor(tone), edge, cell, depth, level) }}
            />
          ))
        : null}
      <div
        data-dcf-visual="rim-line"
        className="absolute inset-0"
        style={{ borderRadius: radius, boxShadow: `inset 0 0 0 1px ${lineColor(tone)}` }}
      />
    </div>
  );
};
