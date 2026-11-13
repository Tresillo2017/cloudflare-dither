import { toPaletteName } from "./palette";

/**
 * Readers for KPI tiles, status strips and sparklines. Each returns null unless the element
 * has the shape it expects, so an unrelated element is never rendered over.
 */

/** Mirrors the dithercn UptimeStatus union, kept local so this module stays free of vendor imports. */
export type UptimeStatus = "up" | "degraded" | "down" | "none";

export interface StatModel {
  readonly label: string;
  readonly value: string;
  readonly delta?: number;
  readonly deltaLabel?: string;
}

export interface UptimeModel {
  readonly statuses: readonly UptimeStatus[];
}

export interface SparkModel {
  readonly values: readonly number[];
  readonly color?: string;
}

const DELTA_PERCENT = /([+-]?\d+(?:\.\d+)?)\s*%/;
const TRIMMED_SEPARATORS = /^[\s·\-–—|,]+|[\s·\-–—|,]+$/g;

/** "+4.2% vs previous period" -> { delta: 4.2, deltaLabel: "vs previous period" }. Text without a percent gives only the label. */
export const parseDelta = (text: string | undefined): Pick<StatModel, "delta" | "deltaLabel"> => {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  if (clean === "") return {};
  const match = DELTA_PERCENT.exec(clean);
  if (!match) return { deltaLabel: clean };
  const delta = Number(match[1]);
  const rest = clean.replace(match[0], "").replace(TRIMMED_SEPARATORS, "");
  return {
    ...(Number.isFinite(delta) ? { delta } : {}),
    ...(rest !== "" ? { deltaLabel: rest } : {}),
  };
};

const textOf = (el: Element | null | undefined): string => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

/** Legacy `kpi-card` (h2 label, value and [data-trend]) or a Kumo tile (label node, `.tabular-nums` value, [data-delta]). */
export const extractStatTile = (el: Element): StatModel | null => {
  const legacyValue = el.querySelector(".m8c3j");
  const kumoValue = el.querySelector(".tabular-nums");
  const valueNode = legacyValue ?? kumoValue;
  if (!valueNode) return null;
  const label = legacyValue ? textOf(el.querySelector("h2")) : textOf(valueNode.previousElementSibling);
  const value = textOf(valueNode);
  if (label === "" || value === "") return null;
  const deltaNode = el.querySelector("[data-trend], [data-delta]");
  return { label, value, ...parseDelta(deltaNode ? textOf(deltaNode) : undefined) };
};

const UPTIME_STATUSES: ReadonlySet<string> = new Set(["up", "degraded", "down"]);

/** A row of `span[data-status]` bars. Unknown statuses become "none" (no data). */
export const extractUptime = (el: Element): UptimeModel | null => {
  const bars = [...el.children].filter((child) => child.hasAttribute("data-status"));
  if (bars.length < 2 || bars.length !== el.children.length) return null;
  const statuses = bars.map((bar): UptimeStatus => {
    const status = bar.getAttribute("data-status") ?? "";
    return UPTIME_STATUSES.has(status) ? (status as UptimeStatus) : "none";
  });
  return { statuses };
};

/** An inline polyline sparkline. Values are the negated y coordinates (SVG y grows downwards). */
export const extractSparkline = (svg: Element): SparkModel | null => {
  const line = svg.querySelector("polyline");
  if (!line) return null;
  const pairs = (line.getAttribute("points") ?? "").trim().split(/\s+/).filter((pair) => pair !== "");
  const values = pairs.map((pair) => -Number(pair.split(",")[1]));
  if (values.length < 2 || values.some((value) => !Number.isFinite(value))) return null;
  const color = toPaletteName(line.getAttribute("stroke"));
  return { values, ...(color ? { color } : {}) };
};
