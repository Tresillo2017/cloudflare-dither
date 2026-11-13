import { StatCard } from "@/components/dithercn/stat-card";
import type { Adapter, AdapterContext } from "../../core/types";
import { extractStatModel } from "./extract";
import { useTargetModel } from "./use-model";

/**
 * StatCard only prints its delta row when it has a percentage. Legacy tiles carry text such as
 * "Up vs previous period", so that text is kept as a note on a clean chip at the bottom.
 */
const StatNote = ({ text }: { text: string }) => (
  <span
    data-dcf-visual="stat-note"
    className="absolute top-2 right-2 max-w-[60%] truncate rounded-md bg-card px-1.5 py-0.5 text-[11px] text-muted-foreground"
  >
    {text}
  </span>
);

const StatStandIn = ({ ctx }: { ctx: AdapterContext }) => {
  const stat = useTargetModel(ctx.target, extractStatModel);
  const isNoteOnly = stat.delta === undefined && stat.deltaLabel !== undefined;
  return (
    <div
      data-dcf-visual="stat"
      className="relative text-foreground"
      style={{ width: ctx.rect.width, height: ctx.rect.height }}
    >
      <StatCard
        label={stat.label}
        value={stat.value}
        {...(stat.delta !== undefined ? { delta: stat.delta } : {})}
        {...(stat.deltaLabel !== undefined && !isNoteOnly ? { deltaLabel: stat.deltaLabel } : {})}
        // Sparser dotted area under the trend: the default gradient filled the bottom 40% of each tile
        // at full density and competed with the sparkline (critic MEDIUM).
        fill="dotted"
        className="h-full"
      />
      {isNoteOnly && stat.deltaLabel ? <StatNote text={stat.deltaLabel} /> : null}
    </div>
  );
};

/**
 * KPI tiles: label, large value and delta. The stand-in only reads the text, so React keeps
 * owning the original, which stays in the DOM (visually hidden) for assistive tech.
 */
export const statTileAdapter: Adapter = {
  id: "stat-tile",
  label: "KPI tiles",
  group: "charts",
  ditherComponents: ["stat-card"],
  selectors: [
    {
      selector: '[data-testid="kpi-card"], section[aria-label="Key metrics"] > *',
      confidence: "med",
      source: "fixture /legacy kpi-card (h2, .m8c3j, [data-trend]) and /, KpiSection LayerCard tiles (.tabular-nums, [data-delta])",
    },
  ],
  defaultEnabled: true,
  maxInstances: 16,
  match: (el) => extractStatModel(el) !== null,
  mode: "sibling-replace",
  render: (ctx) => <StatStandIn ctx={ctx} />,
};
