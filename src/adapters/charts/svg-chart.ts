import type { CartesianModel, ChartModel, PieModel, SeriesModel } from "./model";
import { toPaletteName } from "./palette";
import { fitAxis, formatMinutes, parseNumericLabel, parsePathVertices, parseTimeLabel, stripChartSuffix, type AxisFit, type Point } from "./svg-math";

/**
 * Scrapes a legacy SVG chart (no chart library) into a ChartModel. Axes are calibrated from
 * the tick labels: numeric labels give the y axis, time labels ("06:00") give the x axis.
 * Every step returns null when the geometry does not support a confident reading.
 */

interface Tick {
  readonly value: number;
  readonly position: number;
}

interface Ticks {
  readonly yTicks: Tick[];
  readonly xTicks: Tick[];
}

const centreOf = (el: Element): Point => {
  const box = el.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
};

/** Maps a point in the element's user units to screen pixels. Null when the element has no layout box. */
const toScreen = (el: SVGGraphicsElement, point: Point): Point | null => {
  const m = el.getScreenCTM();
  if (!m) return null;
  return { x: m.a * point.x + m.c * point.y + m.e, y: m.b * point.x + m.d * point.y + m.f };
};

const readTicks = (svg: SVGSVGElement): Ticks => {
  const yTicks: Tick[] = [];
  const xTicks: Tick[] = [];
  for (const text of svg.querySelectorAll("text")) {
    const label = text.textContent ?? "";
    const centre = centreOf(text);
    const numeric = parseNumericLabel(label);
    const minutes = parseTimeLabel(label);
    if (numeric !== null) yTicks.push({ value: numeric, position: centre.y });
    else if (minutes !== null) xTicks.push({ value: minutes, position: centre.x });
  }
  return { yTicks, xTicks };
};

const labelsFor = (points: readonly Point[], xFit: AxisFit | null): string[] =>
  points.map((point, index) => (xFit ? formatMinutes(xFit.apply(point.x)) : String(index + 1)));

/** Bars whose bottom edge agrees with the common baseline (1 px tolerance). */
const BASELINE_TOLERANCE_PX = 1;
/** A rect at least this fraction of the svg width is a background panel, not a bar. */
const BACKGROUND_WIDTH_RATIO = 0.9;

interface BarCandidate {
  readonly centre: number;
  readonly top: number;
  readonly bottom: number;
  readonly color: string | undefined;
}

const barCandidates = (svg: SVGSVGElement): BarCandidate[] => {
  const svgWidth = svg.getBoundingClientRect().width;
  return [...svg.querySelectorAll("rect")]
    .map((rect) => ({ box: rect.getBoundingClientRect(), rect }))
    .filter(({ box }) => box.width > 0 && box.height > 0 && box.width < svgWidth * BACKGROUND_WIDTH_RATIO)
    .map(({ box, rect }) => ({
      centre: box.left + box.width / 2,
      top: box.top,
      bottom: box.bottom,
      color: toPaletteName(rect.getAttribute("fill")),
    }))
    .sort((a, b) => a.centre - b.centre);
};

/** True when every candidate sits on one baseline. Floating or mixed-sign bars make the reading ambiguous. */
const sharesBaseline = (bars: readonly BarCandidate[]): boolean => {
  const first = bars[0];
  if (!first) return false;
  return bars.every((bar) => Math.abs(bar.bottom - first.bottom) <= BASELINE_TOLERANCE_PX);
};

/**
 * Bars read against a calibrated y axis when one exists. Without y tick labels the heights
 * are kept relative to the tallest bar and labelled as such: no magnitude is invented.
 */
const barModel = (svg: SVGSVGElement, ticks: Ticks): CartesianModel | null => {
  const bars = barCandidates(svg);
  if (bars.length < 2 || !sharesBaseline(bars)) return null;
  const yFit = fitAxis(ticks.yTicks.map((t) => ({ position: t.position, value: t.value })));
  const xFit = yFit ? fitAxis(ticks.xTicks.map((t) => ({ position: t.position, value: t.value }))) : null;
  const points = bars.map((bar) => ({ x: bar.centre, y: bar.top }));
  const tallest = Math.max(...bars.map((bar) => bar.bottom - bar.top));
  const values = yFit
    ? bars.map((bar) => yFit.apply(bar.top))
    : bars.map((bar) => (tallest > 0 ? ((bar.bottom - bar.top) / tallest) * 100 : 0));
  const title = stripChartSuffix(svg.getAttribute("aria-label") ?? "");
  const color = bars[0]?.color;
  const series: SeriesModel = {
    label: yFit ? title : `${title} (relative)`,
    values,
    ...(color ? { color } : {}),
  };
  return { kind: "bar", xLabels: labelsFor(points, xFit), series: [series], stacked: false, axes: true, legend: false };
};

const isFilled = (path: Element): boolean => (path.getAttribute("fill") ?? "none") !== "none";

const lineModel = (svg: SVGSVGElement, ticks: Ticks): CartesianModel | null => {
  const yFit = fitAxis(ticks.yTicks.map((t) => ({ position: t.position, value: t.value })));
  if (!yFit) return null;
  const xFit = fitAxis(ticks.xTicks.map((t) => ({ position: t.position, value: t.value })));
  const paths = [...svg.querySelectorAll("path")];
  const candidates = paths
    .filter((path) => !isFilled(path) && path.getAttribute("stroke") !== null)
    .map((path) => ({ path, vertices: parsePathVertices(path.getAttribute("d") ?? "") }))
    .filter((item): item is { path: SVGPathElement; vertices: Point[] } => item.vertices !== null)
    .sort((a, b) => b.vertices.length - a.vertices.length);
  // Gridlines are short two-point strokes; the data series has the most vertices.
  const longest = candidates[0];
  if (!longest || (candidates[1] !== undefined && candidates[1].vertices.length === longest.vertices.length)) return null;
  const linePath = longest.path;
  const vertices = longest.vertices;
  const screen: Point[] = [];
  for (const vertex of vertices) {
    const point = toScreen(linePath, vertex);
    if (!point) return null;
    screen.push(point);
  }
  const isArea = paths.some((path) => path !== linePath && isFilled(path));
  const color = toPaletteName(linePath.getAttribute("stroke"));
  const series: SeriesModel = {
    label: stripChartSuffix(svg.getAttribute("aria-label") ?? ""),
    values: screen.map((point) => yFit.apply(point.y)),
    ...(color ? { color } : {}),
  };
  return { kind: isArea ? "area" : "line", xLabels: labelsFor(screen, xFit), series: [series], stacked: false, axes: true, legend: false };
};

const donutModel = (svg: SVGSVGElement): PieModel | null => {
  const slices = donutCircles(svg).map((circle, index) => {
    const radius = Number(circle.getAttribute("r"));
    const dash = Number.parseFloat(circle.getAttribute("stroke-dasharray") ?? "");
    const color = toPaletteName(circle.getAttribute("stroke"));
    return {
      label: circle.querySelector("title")?.textContent?.trim() || `Segment ${index + 1}`,
      value: radius > 0 && Number.isFinite(dash) ? (dash / (2 * Math.PI * radius)) * 100 : Number.NaN,
      ...(color ? { color } : {}),
    };
  });
  return { kind: "pie", label: stripChartSuffix(svg.getAttribute("aria-label") ?? ""), slices };
};

/** Circles drawn with a dash array are donut segments. Plain circles are markers, not slices. */
const donutCircles = (svg: SVGSVGElement): Element[] =>
  [...svg.querySelectorAll("circle")].filter((circle) => circle.hasAttribute("stroke-dasharray"));

/** Reads one legacy SVG chart. Null when the svg is not a chart this module can read with confidence. */
export const extractSvgChart = (svg: SVGSVGElement): ChartModel | null => {
  if (donutCircles(svg).length >= 2) return donutModel(svg);
  const ticks = readTicks(svg);
  if (svg.querySelectorAll("rect").length >= 2) {
    const bars = barModel(svg, ticks);
    if (bars) return bars;
  }
  return lineModel(svg, ticks);
};
