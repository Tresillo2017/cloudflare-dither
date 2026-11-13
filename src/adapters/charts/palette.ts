/**
 * Maps a source colour (hex, rgb(), or a Kumo/ECharts palette value) onto the dithercn
 * named palette. Anything too far from every named colour returns undefined, so the
 * renderer falls back to its own default order instead of a wrong hue.
 */

type Rgb = readonly [number, number, number];

/** Light-theme reference values of the named dithercn colours (see core/tokens.ts). */
const NAMED_RGB: Readonly<Record<string, Rgb>> = {
  ink: [31, 41, 55],
  blue: [37, 99, 235],
  purple: [147, 51, 234],
  green: [22, 163, 74],
  pink: [219, 39, 119],
  orange: [243, 128, 32],
  red: [239, 68, 68],
  grey: [148, 163, 184],
};

/** Euclidean distance in sRGB units. Beyond this the colour is not the named one. */
export const MAX_PALETTE_DISTANCE = 90;

const HEX_SHORT = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const HEX_LONG = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
const RGB_FUNCTION = /^rgba?\(\s*(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})/i;

const triple = (values: readonly number[]): Rgb | null => {
  const [r, g, b] = values;
  return r !== undefined && g !== undefined && b !== undefined && values.length === 3 && values.every(Number.isFinite)
    ? [r, g, b]
    : null;
};

/** Parses #rgb, #rrggbb and rgb()/rgba() with integer channels. Anything else is null. */
export const parseRgb = (value: string): Rgb | null => {
  const text = value.trim();
  const short = HEX_SHORT.exec(text);
  if (short) {
    const [r = "", g = "", b = ""] = [short[1], short[2], short[3]];
    return triple([r + r, g + g, b + b].map((hex) => Number.parseInt(hex, 16)));
  }
  const long = HEX_LONG.exec(text);
  if (long) return triple([long[1], long[2], long[3]].map((hex) => Number.parseInt(hex ?? "", 16)));
  const fn = RGB_FUNCTION.exec(text);
  if (fn) return triple([fn[1], fn[2], fn[3]].map((channel) => Number(channel)));
  return null;
};

const distance = (a: Rgb, b: Rgb): number =>
  Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);

/** Nearest dithercn palette name for a colour string, or undefined when none is close enough. */
export const toPaletteName = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const rgb = parseRgb(value);
  if (!rgb) return undefined;
  let best: { name: string; d: number } | undefined;
  for (const [name, reference] of Object.entries(NAMED_RGB)) {
    const d = distance(rgb, reference);
    if (!best || d < best.d) best = { name, d };
  }
  return best && best.d <= MAX_PALETTE_DISTANCE ? best.name : undefined;
};
