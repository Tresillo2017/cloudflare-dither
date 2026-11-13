/**
 * Normalised chart data shared by every chart extractor and renderer. Plain values only:
 * no DOM nodes, no React, so the extraction layer is unit-testable in node.
 * Colours are dithercn palette names ("orange", "blue", ...) when a source colour matches
 * the palette, otherwise undefined (the renderer uses the palette default order).
 */

export interface SeriesModel {
  readonly label: string;
  readonly values: readonly number[];
  readonly color?: string;
}

export interface CartesianModel {
  readonly kind: "line" | "area" | "bar";
  /** Text per x position; empty where the source hides its labels. */
  readonly xLabels: readonly string[];
  readonly series: readonly SeriesModel[];
  readonly stacked: boolean;
  /** Whether the source draws axis labels (sparklines do not). */
  readonly axes: boolean;
  /** Whether the source draws a legend. */
  readonly legend: boolean;
  /**
   * The page's own y formatter, guarded (never throws). A function, so it is left out of
   * modelKey; `yFormatProbe` carries its output so a formatter change still re-renders.
   */
  readonly yFormat?: (value: number) => string;
  readonly yFormatProbe?: string;
}

export interface SliceModel {
  readonly label: string;
  readonly value: number;
  readonly color?: string;
}

export interface PieModel {
  readonly kind: "pie";
  readonly label: string;
  readonly slices: readonly SliceModel[];
}

export interface RadarModel {
  readonly kind: "radar";
  readonly axes: readonly string[];
  readonly series: readonly SeriesModel[];
  readonly max?: number;
}

export interface HeatmapModel {
  readonly kind: "heatmap";
  readonly rows: readonly string[];
  readonly columns: readonly string[];
  readonly values: readonly (readonly number[])[];
}

export type ChartModel = CartesianModel | PieModel | RadarModel | HeatmapModel;

export const MIN_POINTS = 2;
export const MIN_SLICES = 2;
export const MIN_AXES = 3;

const allFinite = (values: readonly number[]): boolean => values.every((value) => Number.isFinite(value));

/**
 * Quality gate. A model that fails this is treated as "no data": the original chart stays
 * visible and nothing is rendered over it.
 */
export const isUsableModel = (model: ChartModel): boolean => {
  switch (model.kind) {
    case "line":
    case "area":
    case "bar":
      return (
        model.xLabels.length >= MIN_POINTS &&
        model.series.length > 0 &&
        model.series.every((series) => series.values.length === model.xLabels.length && allFinite(series.values))
      );
    case "pie":
      return (
        model.slices.length >= MIN_SLICES &&
        model.slices.every((slice) => Number.isFinite(slice.value) && slice.value >= 0) &&
        model.slices.reduce((sum, slice) => sum + slice.value, 0) > 0
      );
    case "radar":
      return (
        model.axes.length >= MIN_AXES &&
        model.series.length > 0 &&
        model.series.every((series) => series.values.length === model.axes.length && allFinite(series.values))
      );
    case "heatmap":
      return (
        model.rows.length > 0 &&
        model.columns.length > 0 &&
        model.values.length === model.rows.length &&
        model.values.every((row) => row.length === model.columns.length && allFinite(row))
      );
  }
};

/** Cheap structural key used to skip re-rendering when a poll finds the same data. */
export const modelKey = (model: ChartModel): string => JSON.stringify(model);
