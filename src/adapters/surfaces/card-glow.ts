/**
 * Glow placement for card stand-ins. A glow may only sit where it cannot reach text,
 * controls, icons or charts (VISUAL-SPEC: never dither behind or through text).
 * Pure planning functions plus one DOM reader. The planner takes plain rectangles so
 * it can be unit-tested without a browser layout.
 */
import type { DitherCardGlow as GlowCorner } from "@/components/dithercn/dither-card";

export interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface GlowPlan {
  readonly glow: GlowCorner;
  /** Outer radius of the glow in px, measured from the corner. */
  readonly reach: number;
}

/** Space kept between the glow's outer edge and the nearest content. */
export const CONTENT_GAP_PX = 12;
/** A corner with less free radius than this gets no glow at all. */
export const MIN_FREE_REACH_PX = 40;

/** Elements whose box must stay free of glow (text is handled separately). */
const CONTENT_SELECTOR = [
  "button",
  "a",
  "input",
  "select",
  "textarea",
  "label",
  "svg",
  "img",
  "canvas",
  "[role='img']",
  "[_echarts_instance_]",
].join(",");

/** Anything inside a stand-in host belongs to another stand-in, not to the card's content. */
const HOST_SELECTOR = "[data-dcf-host]";

const CORNERS: readonly GlowCorner[] = ["top-left", "top-right", "bottom-left", "bottom-right"];

/** Distance from a point to the nearest point of a box (0 when inside it). */
export const distanceToBox = (x: number, y: number, box: Box): number => {
  const dx = Math.max(box.left - x, 0, x - box.right);
  const dy = Math.max(box.top - y, 0, y - box.bottom);
  return Math.hypot(dx, dy);
};

/** The corner point of a box of size `width` x `height`, in the box's own coordinates. */
const cornerPoint = (corner: GlowCorner, width: number, height: number): { x: number; y: number } => ({
  x: corner.endsWith("right") ? width : 0,
  y: corner.startsWith("bottom") ? height : 0,
});

/**
 * Chooses the corner with the most free space and the largest glow that still stops short of
 * every content box (plus a gap). `boxes` are in the same coordinates as `card`. Returns null
 * when no corner has room for a readable glow.
 */
export const planGlow = (card: Box, boxes: readonly Box[], maxReach: number): GlowPlan | null => {
  const width = card.right - card.left;
  const height = card.bottom - card.top;
  const local = boxes.map((box) => ({
    left: box.left - card.left,
    top: box.top - card.top,
    right: box.right - card.left,
    bottom: box.bottom - card.top,
  }));
  let best: GlowPlan | null = null;
  for (const corner of CORNERS) {
    const { x, y } = cornerPoint(corner, width, height);
    const nearest = local.reduce((min, box) => Math.min(min, distanceToBox(x, y, box)), Infinity);
    const reach = Math.min(maxReach, nearest - CONTENT_GAP_PX);
    if (reach >= MIN_FREE_REACH_PX && (best === null || reach > best.reach)) {
      best = { glow: corner, reach: Math.round(reach) };
    }
  }
  return best;
};

const toBox = (rect: DOMRect | Box): Box => ({
  left: rect.left,
  top: rect.top,
  right: rect.right,
  bottom: rect.bottom,
});

/** Boxes of every text run inside `root`, skipping text that belongs to a stand-in host. */
const textBoxes = (root: Element): Box[] => {
  const boxes: Box[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    if (!node.textContent?.trim()) continue;
    if (node.parentElement?.closest(HOST_SELECTOR)) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const rect of Array.from(range.getClientRects())) {
      if (rect.width > 0 && rect.height > 0) boxes.push(toBox(rect));
    }
  }
  return boxes;
};

/** Boxes of interactive, graphic and chart content inside `root`, outside stand-in hosts. */
const contentBoxes = (root: Element): Box[] =>
  Array.from(root.querySelectorAll(CONTENT_SELECTOR))
    .filter((el) => el.closest(HOST_SELECTOR) === null)
    .map((el) => toBox(el.getBoundingClientRect()))
    .filter((box) => box.right > box.left && box.bottom > box.top);

/** Every box a glow must avoid, read from the live DOM (text, controls, graphics, charts). */
export const readContentBoxes = (target: Element): Box[] => [...textBoxes(target), ...contentBoxes(target)];
