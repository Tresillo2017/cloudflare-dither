import type { CSSProperties } from "react";

import { toneColor, toneFill, type Tone } from "../../core/visual";

/** Flat translucent tint of a tone (percent 0 to 100): the solid backing that text sits on. */
export const tintStyle = (tone: Tone, percent: number): CSSProperties => ({
  backgroundColor: `color-mix(in oklab, ${toneColor(tone)} ${percent}%, transparent)`,
});

/** Cells a pixel length covers at a given cell size, never less than one. */
const cellsFor = (px: number, cell: number): number => Math.max(1, Math.round(px / cell));

/**
 * Dithered ramp that starts solid at the left edge and thins out over `px` pixels. Used as the
 * leading edge of a band, so the dither never sits behind the label text on the right.
 */
export const leadingRamp = (tone: Tone, cell: number, px: number, from = 1): CSSProperties =>
  toneFill("gradient", tone, { cell, edge: "left", length: cellsFor(px, cell), from, to: 0 });

/**
 * The same ramp from the right edge. Used where the left of the band holds an icon and a label
 * (sidebar items), so the dither sits in the empty trailing end and never over a glyph.
 */
export const trailingRamp = (tone: Tone, cell: number, px: number, from = 1): CSSProperties => ({
  ...toneFill("gradient", tone, { cell, edge: "right", length: cellsFor(px, cell), from, to: 0 }),
  left: "auto",
  width: px,
});
