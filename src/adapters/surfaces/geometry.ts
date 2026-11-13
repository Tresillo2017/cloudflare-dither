import type { Rect } from "../../core";

/** Smallest and largest glow radius (px) a card stand-in may use. */
const MIN_GLOW_REACH = 140;
const MAX_GLOW_REACH = 360;
/** Share of the longer side the glow reaches across. */
const GLOW_SHARE = 0.7;
/** Ignore boxes smaller than this in both dimensions (icons, chips, focus rings). */
export const MIN_SURFACE_SIDE = 64;

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** Glow radius proportional to the target, clamped to a readable range. */
export const glowReach = (rect: Rect): number =>
  clamp(Math.round(Math.max(rect.width, rect.height) * GLOW_SHARE), MIN_GLOW_REACH, MAX_GLOW_REACH);

/** Top-left corner radius of the original, in px. Falls back to 0 when unreadable. */
export const cornerRadius = (el: Element): number => {
  const value = Number.parseFloat(getComputedStyle(el).borderTopLeftRadius);
  return Number.isFinite(value) ? value : 0;
};

/** True when the box is at least `MIN_SURFACE_SIDE` in both dimensions. */
export const isSurfaceSized = (el: Element): boolean => {
  const box = el.getBoundingClientRect();
  return box.width >= MIN_SURFACE_SIDE && box.height >= MIN_SURFACE_SIDE;
};
