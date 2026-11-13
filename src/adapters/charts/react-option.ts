import { isRecord } from "./guards";

/**
 * Reads the ECharts option object that a React component passed to the chart container.
 * React 19 stores a fiber on every DOM node under a `__reactFiber$<key>` own property. The
 * nearest ancestor fiber whose props carry an `options` object with `series` is the Kumo
 * `Chart` wrapper (TimeseriesChart renders one internally). Read-only: nothing is written.
 */

const FIBER_KEY_PREFIX = "__reactFiber$";
/** Kumo's Chart sits directly above its container div; the bound keeps the walk cheap. */
export const MAX_FIBER_DEPTH = 12;

export interface FiberLike {
  readonly return: FiberLike | null;
  readonly memoizedProps: unknown;
}

const isFiberLike = (value: unknown): value is FiberLike =>
  isRecord(value) && "memoizedProps" in value && "return" in value;

export const fiberOf = (el: Element): FiberLike | null => {
  const key = Object.keys(el).find((name) => name.startsWith(FIBER_KEY_PREFIX));
  if (!key) return null;
  const value = (el as unknown as Record<string, unknown>)[key];
  return isFiberLike(value) ? value : null;
};

/** The first `options` object (with a `series` array) found walking up from `el`, or null. */
export const findChartOptions = (el: Element): unknown => {
  let fiber = fiberOf(el);
  for (let depth = 0; fiber && depth < MAX_FIBER_DEPTH; depth += 1) {
    const props = fiber.memoizedProps;
    if (isRecord(props) && isRecord(props.options) && Array.isArray(props.options.series)) {
      return props.options;
    }
    fiber = fiber.return;
  }
  return null;
};
