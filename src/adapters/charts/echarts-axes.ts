import { isRecord, recordsOf, type UnknownRecord } from "./guards";

/**
 * Axis readers for ECharts options: label text, label visibility and legend visibility. Page
 * formatters are called only inside a guard, so a formatter that throws or returns something
 * other than text falls back to a default instead of breaking the chart.
 */

/** Largest magnitude a JavaScript Date can hold (ECMAScript time value range). */
const MAX_DATE_MS = 8.64e15;

/** Spans up to this length label the axis by time of day; longer spans by date. */
export const SHORT_SPAN_MS = 2 * 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/**
 * Formats an axis label in UTC. Short spans read "HH:mm", longer ones "Mon D" so that thinned
 * tick labels stay short enough not to collide. UTC is the fallback only: when the page supplies
 * its own axis formatter, that formatter wins (it knows the display zone). Out-of-range numbers
 * are printed as-is, so one bad point cannot throw the whole chart.
 */
export const formatAxisLabel = (timestamp: number, spanMs: number): string => {
  if (!Number.isFinite(timestamp) || Math.abs(timestamp) > MAX_DATE_MS) return String(timestamp);
  const date = new Date(timestamp);
  if (spanMs <= SHORT_SPAN_MS) return date.toISOString().slice(11, 16);
  return `${MONTHS[date.getUTCMonth()] ?? ""} ${date.getUTCDate()}`;
};

export type PageFormatter = (value: number, index: number) => string | undefined;

/**
 * Wraps a page-supplied ECharts `axisLabel.formatter`. Returns undefined when the formatter is
 * absent. The wrapper itself returns undefined for a throw, a non-string or an empty string.
 */
export const pageFormatter = (fn: unknown): PageFormatter | undefined => {
  if (typeof fn !== "function") return undefined;
  return (value: number, index: number): string | undefined => {
    try {
      const out: unknown = fn(value, index);
      return typeof out === "string" && out !== "" ? out : undefined;
    } catch {
      return undefined;
    }
  };
};

const compact = new Intl.NumberFormat("en", { notation: "compact" });

/** Value text for the y axis: the page formatter when it works, else compact notation. */
export const valueText = (formatter: PageFormatter | undefined, value: number): string =>
  formatter?.(value, 0) ?? compact.format(value);

/** The `axisLabel` object of an axis record, or an empty record when absent. */
const axisLabelOf = (axis: UnknownRecord | undefined): UnknownRecord =>
  axis && isRecord(axis.axisLabel) ? axis.axisLabel : {};

/** ECharts shows axis labels unless told otherwise. */
export const axisLabelsShown = (axis: UnknownRecord | undefined): boolean => axisLabelOf(axis).show !== false;

export const firstAxis = (option: UnknownRecord, key: "xAxis" | "yAxis"): UnknownRecord | undefined =>
  recordsOf(option[key])[0];

/** The page's own formatter for an axis, if it has one. */
export const axisFormatter = (axis: UnknownRecord | undefined): PageFormatter | undefined =>
  pageFormatter(axisLabelOf(axis).formatter);

/** A legend is drawn when the option declares one that is not switched off. */
export const legendShown = (option: UnknownRecord): boolean => {
  const legend = recordsOf(option.legend)[0];
  return legend !== undefined && legend.show !== false;
};

/**
 * Text of one x label. Hidden labels are empty (the chart still reserves the axis row). A page
 * formatter wins; otherwise a time axis is formatted in UTC and a value or category axis prints
 * the value.
 */
export const xLabelText = (
  xAxis: UnknownRecord | undefined,
  formatter: PageFormatter | undefined,
  x: number,
  index: number,
  spanMs: number,
): string => {
  if (!axisLabelsShown(xAxis)) return "";
  const own = formatter?.(x, index);
  if (own !== undefined) return own;
  return xAxis?.type === "time" ? formatAxisLabel(x, spanMs) : String(x);
};
