import { DonutChart } from "@/components/dithercn/donut-chart";
import type { PieModel } from "./model";

/**
 * Donut stand-in. The ring and a compact legend (every slice, never clipped) share the target's
 * box: the ring is sized to what the box leaves after the legend, and the legend is placed beside
 * the ring when the box is too short to stack them. The original keeps the accessible data.
 */

export const LEGEND_ROW_PX = 16;
export const LEGEND_GAP_PX = 6;
export const MIN_RING_PX = 64;
/** Colour order when a slice has no colour of its own: the dithercn default order. */
const DEFAULT_ORDER = ["ink", "orange", "green", "pink", "purple", "blue", "red", "grey"] as const;

export type PieLayout = "stacked" | "side";

export interface PieGeometry {
  readonly layout: PieLayout;
  readonly ring: number;
}

/** Pure sizing: the ring never exceeds the box, and the legend fits next to or below it. */
export const pieGeometry = (width: number, height: number, rows: number): PieGeometry => {
  const legend = rows * LEGEND_ROW_PX + LEGEND_GAP_PX;
  const stacked = height - legend;
  if (stacked >= MIN_RING_PX) {
    return { layout: "stacked", ring: Math.floor(Math.min(width, stacked)) };
  }
  return { layout: "side", ring: Math.floor(Math.min(height, width * 0.5)) };
};

/** Palette name for each slice, matching the colours the ring is drawn with. */
export const pieColours = (model: PieModel): string[] =>
  model.slices.map((slice, index) => slice.color ?? DEFAULT_ORDER[index % DEFAULT_ORDER.length] ?? "ink");

const swatchStyle = (colour: string): { backgroundColor: string } => ({
  backgroundColor: `var(--dither-color-${colour}, var(--dither-${colour}))`,
});

const shareOf = (value: number, total: number): string =>
  total > 0 ? `${Math.round((value / total) * 100)}%` : "0%";

const Legend = ({ model, colours }: { model: PieModel; colours: readonly string[] }) => {
  const total = model.slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0);
  return (
    <ul aria-hidden="true" className="m-0 grid list-none gap-x-3 p-0 text-[11px] leading-4 text-foreground" style={{ gridTemplateColumns: "auto 1fr auto auto" }}>
      {model.slices.map((slice, index) => (
        <li key={`${slice.label}-${index}`} className="contents">
          <span className="my-[2px] h-2.5 w-2.5 rounded-[2px]" style={swatchStyle(colours[index] ?? "ink")} />
          <span className="truncate">{slice.label}</span>
          <span className="tabular-nums">{String(Math.round(slice.value))}</span>
          <span className="tabular-nums opacity-80">{shareOf(slice.value, total)}</span>
        </li>
      ))}
    </ul>
  );
};

export const PieView = ({ model, width, height }: { model: PieModel; width: number; height: number }) => {
  const colours = pieColours(model);
  const { layout, ring } = pieGeometry(width, height, model.slices.length);
  const ringSize = Math.max(MIN_RING_PX, ring);
  return (
    <div
      className={layout === "stacked" ? "flex h-full w-full flex-col items-center justify-center gap-1.5" : "flex h-full w-full items-center justify-center gap-4"}
    >
      <DonutChart
        className="m-0 shrink-0 gap-0"
        label={model.label || "Total"}
        data={model.slices.map((slice, index) => ({ label: slice.label, value: slice.value, color: colours[index] ?? "ink" }))}
        colors={colours}
        size={ringSize}
        legend={false}
        interactive={false}
        animate={false}
      />
      <Legend model={model} colours={colours} />
    </div>
  );
};
