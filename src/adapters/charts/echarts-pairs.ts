import { finiteOrNull, type UnknownRecord } from "./guards";

/**
 * Point-series alignment for ECharts `[x, y]` data, as Kumo's Chart and TimeseriesChart pass it.
 * Real dashboards send sparse data: a current period, plus split "incomplete period" and
 * "previous period" series whose y values are mostly `null`. The gaps are not drawn as data.
 * The main series is the one with the most real points. The chart keeps the main series'
 * contiguous span and every other series that has a value at every x of that span. Anything
 * else is a split piece of the same data and is left to the original chart.
 */

/** Smallest span a chart can be drawn from. */
export const MIN_SPAN_POINTS = 2;

export interface PairPoint {
  readonly x: number;
  /** null is a gap in the source series. */
  readonly y: number | null;
}

export interface PairTable {
  /** x of every row, in source order. */
  readonly xs: readonly number[];
  /** Indices (into the input series list) of the series kept, in input order. */
  readonly kept: readonly number[];
  /** One complete column per kept series, aligned with `xs`. */
  readonly columns: readonly (readonly number[])[];
}

/** One `[x, y]` item. Returns null when the item is malformed, so the caller can refuse the chart. */
const pairOf = (item: unknown): PairPoint | null => {
  if (!Array.isArray(item) || item.length < 2) return null;
  const x = finiteOrNull(item[0]);
  if (x === null) return null;
  const rawY: unknown = item[1];
  if (rawY === null || rawY === undefined) return { x, y: null };
  const y = finiteOrNull(rawY);
  return y === null ? null : { x, y };
};

/** All points of one series, or null when its data is not a list of `[x, y|null]` pairs. */
export const pairPoints = (series: UnknownRecord): PairPoint[] | null => {
  if (!Array.isArray(series.data)) return null;
  const points: PairPoint[] = [];
  for (const item of series.data) {
    const point = pairOf(item);
    if (point === null) return null;
    points.push(point);
  }
  return points;
};

const realCount = (points: readonly PairPoint[]): number => points.filter((point) => point.y !== null).length;

/** Index of the series with the most real points (the first one on a tie). */
const mainIndexOf = (perSeries: readonly (readonly PairPoint[])[]): number =>
  perSeries.reduce((best, points, index) => (realCount(points) > realCount(perSeries[best] ?? []) ? index : best), 0);

/** The main series' contiguous span: from its first to its last real point. Null if a gap is inside it. */
const spanOf = (main: readonly PairPoint[]): PairPoint[] | null => {
  const first = main.findIndex((point) => point.y !== null);
  const last = main.findLastIndex((point) => point.y !== null);
  if (last - first + 1 < MIN_SPAN_POINTS) return null;
  const span = main.slice(first, last + 1);
  return span.every((point) => point.y !== null) ? span : null;
};

/** The y of every span x in one series, or null if the series has a gap there or lacks the x. */
const columnOver = (points: readonly PairPoint[], xs: readonly number[]): number[] | null => {
  const byX = new Map<number, number | null>(points.map((point) => [point.x, point.y]));
  const column: number[] = [];
  for (const x of xs) {
    const y = byX.get(x);
    if (y === undefined || y === null) return null;
    column.push(y);
  }
  return column;
};

/**
 * Aligns sparse pair series on one x sequence. Returns null when no contiguous span exists,
 * when any series is malformed, or when the main series has an inner gap (a gap cannot be
 * drawn honestly, so the original keeps the data).
 */
export const alignPairSeries = (seriesList: readonly UnknownRecord[]): PairTable | null => {
  const perSeries: PairPoint[][] = [];
  for (const series of seriesList) {
    const points = pairPoints(series);
    if (points === null) return null;
    perSeries.push(points);
  }
  const main = perSeries[mainIndexOf(perSeries)];
  const span = main ? spanOf(main) : null;
  if (!span) return null;
  const xs = span.map((point) => point.x);
  const kept: number[] = [];
  const columns: number[][] = [];
  perSeries.forEach((points, index) => {
    const column = columnOver(points, xs);
    if (column === null) return;
    kept.push(index);
    columns.push(column);
  });
  return kept.length > 0 ? { xs, kept, columns } : null;
};
