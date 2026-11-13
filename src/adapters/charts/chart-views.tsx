import { AreaChart } from "@/components/dithercn/area-chart";
import { BarChart } from "@/components/dithercn/bar-chart";
import { Heatmap } from "@/components/dithercn/heatmap";
import { LineChart } from "@/components/dithercn/line-chart";
import { RadarChart } from "@/components/dithercn/radar-chart";
import type { CartesianModel, ChartModel, HeatmapModel, PieModel, RadarModel, SeriesModel } from "./model";
import { ModelUnavailableError } from "./use-model";
import { PieView } from "./pie-view";

/**
 * Renders a ChartModel with the matching dithercn chart. Series are passed as accessor
 * functions over one row per x label, so no key of the source data leaks into the view.
 * Interaction is off: stand-ins are inert and the original keeps every event.
 */

type Row = Record<string, string | number>;

interface SeriesDef {
  readonly label: string;
  readonly value: (row: Row) => number;
  readonly color?: string;
}

const seriesKey = (index: number): string => `s${index}`;

/** Area density under a single-series line chart: lighter than a true area chart. */
const SINGLE_LINE_AREA_LEVEL = 0.375;

/** Narrows a list to the non-empty tuple the dithercn props require. Empty input is a bug upstream. */
export const nonEmpty = <T,>(items: readonly T[]): readonly [T, ...T[]] => {
  const [first, ...rest] = items;
  if (first === undefined) throw new ModelUnavailableError("chart has no series");
  return [first, ...rest];
};

export const cartesianRows = (model: CartesianModel): Row[] =>
  model.xLabels.map((label, index) => {
    const row: Row = { x: label };
    model.series.forEach((series, s) => {
      row[seriesKey(s)] = series.values[index] ?? 0;
    });
    return row;
  });

const seriesDefs = (series: readonly SeriesModel[]): SeriesDef[] =>
  series.map((item, index) => ({
    label: item.label,
    value: (row: Row) => Number(row[seriesKey(index)] ?? 0),
    ...(item.color ? { color: item.color } : {}),
  }));

const xOf = (row: Row): string => String(row.x ?? "");

const CartesianView = ({ model, height }: { model: CartesianModel; height: number }) => {
  const common = {
    data: cartesianRows(model),
    x: xOf,
    series: nonEmpty(seriesDefs(model.series)),
    height,
    interactive: false,
    tooltip: false,
    axes: model.axes,
    legend: model.legend,
    ...(model.yFormat ? { format: model.yFormat } : {}),
  };
  if (model.kind === "bar") {
    return <BarChart {...common} layout={model.stacked ? "stacked" : "grouped"} highlight="none" />;
  }
  if (model.kind === "area") return <AreaChart {...common} />;
  // A lone line gets a faint dithered area under it, so every real chart carries the texture.
  if (model.series.length === 1) return <AreaChart {...common} level={SINGLE_LINE_AREA_LEVEL} />;
  return <LineChart {...common} markers="none" />;
};

const RadarView = ({ model, width, height }: { model: RadarModel; width: number; height: number }) => (
  <RadarChart
    axes={nonEmpty(model.axes)}
    series={nonEmpty(model.series.map((series) => ({ label: series.label, values: series.values, ...(series.color ? { color: series.color } : {}) })))}
    {...(model.max !== undefined ? { max: model.max } : {})}
    size={Math.max(120, Math.floor(Math.min(width, height)))}
    interactive={false}
  />
);

const HeatmapView = ({ model }: { model: HeatmapModel }) => (
  <Heatmap mode="matrix" rows={model.rows} columns={model.columns} data={model.values} interactive={false} />
);

export const ChartView = ({ model, width, height }: { model: ChartModel; width: number; height: number }) => {
  switch (model.kind) {
    case "line":
    case "area":
    case "bar":
      return <CartesianView model={model} height={height} />;
    case "pie":
      return <PieView model={model} width={width} height={height} />;
    case "radar":
      return <RadarView model={model} width={width} height={height} />;
    case "heatmap":
      return <HeatmapView model={model} />;
  }
};

/** Fixed-size wrapper: the core sizes the host to the target, so the chart gets a definite box. */
export const ChartStage = ({ model, width, height }: { model: ChartModel; width: number; height: number }) => (
  <div data-dcf-visual="chart" data-dcf-kind={model.kind} className="overflow-hidden text-foreground" style={{ width, height }}>
    <ChartView model={model} width={width} height={height} />
  </div>
);
