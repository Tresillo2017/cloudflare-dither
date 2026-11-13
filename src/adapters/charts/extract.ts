import type { ChartModel } from "./model";
import { isUsableModel } from "./model";
import { normaliseEChartsOption } from "./echarts-normalise";
import { findChartOptions } from "./react-option";
import { extractSvgChart } from "./svg-chart";
import { extractSparkline, extractStatTile, extractUptime, type SparkModel, type StatModel, type UptimeModel } from "./stat-dom";

/**
 * Entry points used by adapter matching and rendering. Each returns a model only when it is
 * usable. Null means "not a target" or "not confidently readable": the original stays untouched.
 */

/** ECharts container: option read from React props, normalised, then quality-gated. */
export const extractEChartsModel = (el: Element): ChartModel | null => {
  const model = normaliseEChartsOption(findChartOptions(el));
  return model && isUsableModel(model) ? model : null;
};

/** Legacy SVG chart with aria-label. */
export const extractSvgModel = (el: Element): ChartModel | null => {
  if (!(el instanceof SVGSVGElement)) return null;
  const model = extractSvgChart(el);
  return model && isUsableModel(model) ? model : null;
};

export const extractStatModel = (el: Element): StatModel | null => extractStatTile(el);

export const extractUptimeModel = (el: Element): UptimeModel | null => extractUptime(el);

export const extractSparkModel = (el: Element): SparkModel | null => extractSparkline(el);
