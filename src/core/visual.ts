/**
 * THE visual constants and recipes (docs/visual-spec.md, "One system"). Every adapter imports
 * its cell size, matrix, colours and dither recipes from here and nowhere else.
 *
 * Colours are CSS strings that read the real Kumo tokens live (so they flip with
 * data-mode and follow the brand). Fallbacks only apply when the page lacks the token.
 * Usage and the full API: docs/adapter-authoring.md, section "Visual system".
 */
import type { CSSProperties } from "react";

import { ditherMaskStyle, fillStyle, type DitherMatrix, type FillVariant } from "@/lib/dither";
import type { DitherColor } from "@/lib/dither/tokens";

/** Cell size in CSS px for ordinary elements. */
export const CELL_PX = 3;
/** Cell size for elements shorter than CELL_SMALL_MAX_HEIGHT px. */
export const CELL_PX_SMALL = 2;
export const CELL_SMALL_MAX_HEIGHT = 20;
/** The one threshold matrix used everywhere. */
export const MATRIX: DitherMatrix = "bayer4";
/** Cloudflare orange: the accent (chart series 2, warm highlights). */
export const CLOUDFLARE_ORANGE = "#f6821f";
/** Cloudflare blue, the brand fallback. Matches the real --color-kumo-brand in both themes. */
export const CLOUDFLARE_BLUE_LIGHT = "oklch(57.72% 0.2324 260)";
export const CLOUDFLARE_BLUE_DARK = "oklch(51.948% 0.2324 260)";

export type Tone = "brand" | "danger" | "success" | "warning" | "info" | "neutral";

interface ToneSpec {
  readonly variable: string;
  readonly fallback: string;
}

/** Real Kumo tokens (checked live on dash.cloudflare.com, dark and light). */
export const TONES: Readonly<Record<Tone, ToneSpec>> = {
  brand: { variable: "--color-kumo-brand", fallback: CLOUDFLARE_BLUE_LIGHT },
  danger: { variable: "--color-kumo-danger", fallback: "oklch(63.7% 0.237 25.331)" },
  success: { variable: "--color-kumo-success", fallback: "oklch(59.6% 0.145 163.225)" },
  warning: { variable: "--color-kumo-warning", fallback: "oklch(73.9% 0.177 58.2)" },
  info: { variable: "--color-kumo-info", fallback: "oklch(62.3% 0.214 259.815)" },
  neutral: { variable: "--color-kumo-fill", fallback: "oklch(92.2% 0 0)" },
};

const withFallback = (variable: string, fallback: string): string => `var(${variable}, ${fallback})`;

/** CSS colour for a semantic tone. Brand is Cloudflare blue (never purple). */
export const toneColor = (tone: Tone): string =>
  withFallback(TONES[tone].variable, TONES[tone].fallback);

/** Solid text colour on the page (ink). */
export const INK = withFallback("--text-color-kumo-default", "oklch(20.5% 0 0)");
/** Page paper (the solid backing behind text). */
export const PAPER = withFallback("--color-kumo-base", "#fff");
/** Hairline and rim colour. */
export const LINE = withFallback("--color-kumo-line", "oklch(14.5% 0 0 / 0.1)");
/** Raised surface (cards, popovers). */
export const ELEVATED = withFallback("--color-kumo-elevated", "oklch(98% 0 0)");
/** Quiet recessed surface (tracks, wells). */
export const RECESSED = withFallback("--color-kumo-recessed", "oklch(96.5% 0 0)");
/** Page canvas (sticky header band); falls back to the paper colour. */
export const CANVAS = withFallback("--color-kumo-canvas", PAPER);
/** Solid well behind toolbars and controls. */
export const CONTROL_WELL = withFallback("--color-kumo-control", "oklch(20% 0 0)");
/** Skeleton base in dark mode (no Kumo token exists for it). */
export const DARK_BASE = "oklch(0.36 0 0)";
/** Dark page paper, the solid tint behind the translucent page background. */
export const DARK_PAPER = "#0d0f12";

/** Cell size for an element of a given CSS height. */
export const cellFor = (heightPx: number): number =>
  heightPx > 0 && heightPx < CELL_SMALL_MAX_HEIGHT ? CELL_PX_SMALL : CELL_PX;

/** Dithered masked fill of one tone at `level` (0 = nothing, 1 = solid). */
export const ditherFill = (tone: Tone, level: number, cell: number = CELL_PX): CSSProperties => ({
  backgroundColor: toneColor(tone),
  ...ditherMaskStyle(level, { matrix: MATRIX, cell }),
});

/**
 * fillStyle wrapper for a tone. `variant` is one of the dithercn fill variants:
 * "solid" | "dotted" | "hatched" | "gradient". Gradient fades in from `edge`.
 */
export const toneFill = (
  variant: FillVariant,
  tone: Tone | DitherColor = "brand",
  options: { cell?: number; edge?: "top" | "bottom" | "left" | "right"; length?: number; from?: number; to?: number } = {}
): CSSProperties =>
  fillStyle(variant, {
    color: tone in TONES ? toneColor(tone as Tone) : tone,
    cell: options.cell ?? CELL_PX,
    edge: options.edge,
    length: options.length,
    from: options.from,
    to: options.to,
    matrix: MATRIX,
  });

/** Shade recipe for buttons: dithered shade rising from the bottom edge. */
export const shadeStyle = (tone: Tone, cell: number = CELL_PX): CSSProperties =>
  toneFill("gradient", tone, { cell, edge: "bottom", length: 8, from: 0.5, to: 0 });

/** Highlight recipe: a faint dithered sheen from the top edge (hover, active rows). */
export const highlightStyle = (tone: Tone, cell: number = CELL_PX): CSSProperties =>
  toneFill("gradient", tone, { cell, edge: "top", length: 6, from: 0.35, to: 0 });

/**
 * Hairline colour for every solid rule and rim: the page ink at a visible but quiet strength.
 * Kumo's line token is nearly invisible on the dark canvas. Ink flips with the theme.
 */
export const RULE_INK = `color-mix(in oklab, ${INK} 26%, transparent)`;

/**
 * Depth, in cells, of every dithered falloff (rims and rules). Rims and rules are a solid hairline
 * plus a deep, faint falloff. A shallow strip at mid level is a sparse dot lattice that reads as
 * dashes (verified on the real pages), so depth is kept wide and the level low.
 */
export const FALLOFF_CELLS = 4;
/** Falloff strength on a rim or rule edge. Low on purpose: it must read as texture, not dots. */
export const FALLOFF_LEVEL = 0.6;

/** Edges a rim or rule can be drawn on. */
export type RuleEdge = "top" | "bottom" | "left" | "right";

/**
 * Dithered falloff from one edge of a box, `cells` cells deep, starting at `level` on the edge and
 * thinning to nothing inward. This is the only dithered-edge recipe rims and rules use: a
 * continuous ramp, never a sparse dotted tile. Size the host to `cells * cell` on the edge axis.
 */
export const falloffStyle = (
  tone: Tone | DitherColor | string,
  edge: RuleEdge,
  cell: number = CELL_PX,
  cells: number = FALLOFF_CELLS,
  level: number = 0.5
): CSSProperties =>
  toneFill("gradient", tone, { cell, edge, length: cells, from: level, to: 0 });
