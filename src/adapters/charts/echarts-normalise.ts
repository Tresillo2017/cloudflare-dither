import { isRecord, recordsOf, finiteOrNull, stringOrUndefined, type UnknownRecord } from "./guards";
import type { CartesianModel, ChartModel, HeatmapModel, PieModel, RadarModel, SeriesModel } from "./model";
import { toPaletteName } from "./palette";
import { alignPairSeries } from "./echarts-pairs";
import {
  axisFormatter,
  axisLabelsShown,
  firstAxis,
  legendShown,
  valueText,
  xLabelText,
  type PageFormatter,
} from "./echarts-axes";

/** Kumo adds these annotation series to TimeseriesChart; they are not data. */
const ANNOTATION_NAMES: ReadonlySet<string> = new Set(["Markers", "Thresholds"]);

const listSeries = (option: UnknownRecord): UnknownRecord[] => {
  const seen = new Set<string>();
  const kept: UnknownRecord[] = [];
  for (const series of recordsOf(option.series)) {
    const name = stringOrUndefined(series.name) ?? "";
    if (ANNOTATION_NAMES.has(name)) continue;
    // Kumo splits incomplete periods into extra series with the same name. The first one is the main series.
    if (name !== "" && seen.has(name) && series.type !== "pie") continue;
    seen.add(name);
    kept.push(series);
  }
  return kept;
};

/** The value of one ECharts data item: a number, {value}, or [x, y] pair (returned as the pair). */
const itemValue = (item: unknown): number | [number, number] | null => {
  if (typeof item === "number") return finiteOrNull(item);
  if (Array.isArray(item) && item.length >= 2) {
    const x = finiteOrNull(item[0]);
    const y = finiteOrNull(item[1]);
    return x !== null && y !== null ? [x, y] : null;
  }
  if (isRecord(item)) return itemValue(item.value);
  return null;
};

/**
 * Source colour of a series: its own colour, then item, line and area styles (Kumo sets the
 * colour on lineStyle and areaStyle, not on the series), then the option palette.
 */
const seriesColor = (series: UnknownRecord, option: UnknownRecord, index: number): string | undefined => {
  const itemStyle = isRecord(series.itemStyle) ? series.itemStyle : {};
  const lineStyle = isRecord(series.lineStyle) ? series.lineStyle : {};
  const areaStyle = isRecord(series.areaStyle) ? series.areaStyle : {};
  const palette = Array.isArray(option.color) ? option.color : [];
  return toPaletteName(series.color ?? itemStyle.color ?? lineStyle.color ?? areaStyle.color ?? palette[index]);
};

const labelOf = (series: UnknownRecord, index: number): string =>
  stringOrUndefined(series.name) ?? `Series ${index + 1}`;

const categoryValues = (series: UnknownRecord): number[] | null => {
  if (!Array.isArray(series.data)) return null;
  const values: number[] = [];
  for (const item of series.data) {
    const value = itemValue(item);
    if (typeof value !== "number") return null;
    values.push(value);
  }
  return values;
};

/** Series whose data are `[x, y]` pairs (ECharts value or time axes). */
const isPairSeries = (series: UnknownRecord): boolean =>
  Array.isArray(series.data) && series.data.some((item) => Array.isArray(item));

const pairAxisModel = (
  option: UnknownRecord,
  seriesList: readonly UnknownRecord[],
  kind: "line" | "bar",
): Omit<CartesianModel, "kind" | "stacked"> | null => {
  const table = alignPairSeries(seriesList);
  if (!table) return null;
  const xAxis = firstAxis(option, "xAxis");
  const yAxis = firstAxis(option, "yAxis");
  const xFormat: PageFormatter | undefined = axisFormatter(xAxis);
  const spanMs = (table.xs[table.xs.length - 1] ?? 0) - (table.xs[0] ?? 0);
  const xLabels = table.xs.map((x, index) => xLabelText(xAxis, xFormat, x, index, spanMs));
  const series: SeriesModel[] = table.kept.map((sourceIndex, column) => {
    const raw = seriesList[sourceIndex] ?? {};
    const color = seriesColor(raw, option, sourceIndex);
    return {
      label: labelOf(raw, sourceIndex),
      values: table.columns[column] ?? [],
      ...(color ? { color } : {}),
    };
  });
  const yFormat = axisFormatter(yAxis);
  return {
    xLabels,
    series,
    axes: axisLabelsShown(xAxis) || axisLabelsShown(yAxis),
    legend: legendShown(option),
    yFormat: (value: number) => valueText(yFormat, value),
    yFormatProbe: valueText(yFormat, 1234.5),
  };
};

/** Category axes (labels in `xAxis.data`, one number per label per series). */
const categoryAxisModel = (
  option: UnknownRecord,
  seriesList: readonly UnknownRecord[],
): Omit<CartesianModel, "kind" | "stacked"> | null => {
  const xAxis = firstAxis(option, "xAxis");
  const yAxis = firstAxis(option, "yAxis");
  if (!Array.isArray(xAxis?.data)) return null;
  const xLabels = xAxis.data.map((label) => String(label));
  const columns = seriesList.map(categoryValues);
  if (columns.some((column) => column === null || column.length !== xLabels.length)) return null;
  const series: SeriesModel[] = seriesList.map((raw, index) => {
    const color = seriesColor(raw, option, index);
    return { label: labelOf(raw, index), values: (columns[index] as number[]) ?? [], ...(color ? { color } : {}) };
  });
  const yFormat = axisFormatter(yAxis);
  return {
    xLabels,
    series,
    axes: axisLabelsShown(xAxis) || axisLabelsShown(yAxis),
    legend: legendShown(option),
    yFormat: (value: number) => valueText(yFormat, value),
    yFormatProbe: valueText(yFormat, 1234.5),
  };
};

const cartesianModel = (
  option: UnknownRecord,
  seriesList: readonly UnknownRecord[],
  kind: "line" | "bar",
): CartesianModel | null => {
  const base = seriesList.some(isPairSeries)
    ? pairAxisModel(option, seriesList, kind)
    : categoryAxisModel(option, seriesList);
  if (!base) return null;
  const isArea = kind === "line" && base.series.length > 0 && seriesList.every((series) => isRecord(series.areaStyle));
  return {
    ...base,
    kind: isArea ? "area" : kind,
    stacked: kind === "bar" && seriesList.some((raw) => stringOrUndefined(raw.stack) !== undefined),
  };
};

const pieModel = (option: UnknownRecord, seriesList: readonly UnknownRecord[]): PieModel | null => {
  const [first] = seriesList;
  if (!first || !Array.isArray(first.data)) return null;
  const palette = Array.isArray(option.color) ? option.color : [];
  const slices = first.data.map((raw, index) => {
    const item = isRecord(raw) ? raw : {};
    const value = itemValue(item.value ?? raw);
    const itemStyle = isRecord(item.itemStyle) ? item.itemStyle : {};
    const color = toPaletteName(itemStyle.color ?? palette[index]);
    return {
      label: stringOrUndefined(item.name) ?? `Slice ${index + 1}`,
      value: typeof value === "number" ? value : Number.NaN,
      ...(color ? { color } : {}),
    };
  });
  return { kind: "pie", label: stringOrUndefined(first.name) ?? "", slices };
};

const radarModel = (option: UnknownRecord, seriesList: readonly UnknownRecord[]): RadarModel | null => {
  const radar = recordsOf(option.radar)[0];
  const indicators = recordsOf(radar?.indicator);
  if (indicators.length < 3) return null;
  const axes = indicators.map((indicator, index) => stringOrUndefined(indicator.name) ?? `Axis ${index + 1}`);
  const maxValues = indicators.map((indicator) => finiteOrNull(indicator.max));
  const max = maxValues[0] ?? undefined;
  const sameMax = max !== undefined && maxValues.every((value) => value === max);
  const series: SeriesModel[] = seriesList.flatMap((raw, index) => {
    const data = Array.isArray(raw.data) ? raw.data.filter(isRecord) : [];
    return data.map((item, itemIndex) => {
      const values = Array.isArray(item.value) ? item.value.map(finiteOrNull) : [];
      const palette = Array.isArray(option.color) ? option.color : [];
      const color = toPaletteName(item.color ?? palette[itemIndex] ?? raw.color);
      return {
        label: stringOrUndefined(item.name) ?? `Series ${index + itemIndex + 1}`,
        values: values.map((value) => value ?? Number.NaN),
        ...(color ? { color } : {}),
      };
    });
  });
  return { kind: "radar", axes, series, ...(sameMax ? { max } : {}) };
};

const heatmapModel = (option: UnknownRecord, seriesList: readonly UnknownRecord[]): HeatmapModel | null => {
  const xAxis = recordsOf(option.xAxis)[0];
  const yAxis = recordsOf(option.yAxis)[0];
  if (!Array.isArray(xAxis?.data) || !Array.isArray(yAxis?.data)) return null;
  const columns = xAxis.data.map((label) => String(label));
  const rows = yAxis.data.map((label) => String(label));
  const values = rows.map(() => columns.map(() => 0));
  for (const series of seriesList) {
    if (!Array.isArray(series.data)) return null;
    for (const item of series.data) {
      if (!Array.isArray(item) || item.length < 3) return null;
      const [x, y, value] = item.map(finiteOrNull);
      if (x === null || y === null || value === null) return null;
      const row = values[y];
      if (!row || row[x] === undefined) return null;
      row[x] = value;
    }
  }
  return { kind: "heatmap", rows, columns, values };
};

/**
 * Normalises a plain ECharts option object (as Kumo passes it to its Chart wrapper) into a
 * ChartModel. Returns null for anything it does not understand (mixed series types, missing
 * axes, unaligned series). Callers treat null as "leave the original alone".
 */
export const normaliseEChartsOption = (option: unknown): ChartModel | null => {
  if (!isRecord(option)) return null;
  const seriesList = listSeries(option);
  if (seriesList.length === 0) return null;
  const types = new Set(seriesList.map((series) => series.type));
  if (types.size !== 1) return null;
  const [type] = [...types];
  switch (type) {
    case "pie":
      return pieModel(option, seriesList);
    case "radar":
      return radarModel(option, seriesList);
    case "heatmap":
      return heatmapModel(option, seriesList);
    case "line":
    case "bar":
      return cartesianModel(option, seriesList, type);
    default:
      return null;
  }
};
