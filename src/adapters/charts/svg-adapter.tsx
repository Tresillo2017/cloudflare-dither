import type { Adapter, AdapterContext } from "../../core/types";
import { ChartStage } from "./chart-views";
import { extractSvgModel } from "./extract";
import { useTargetModel } from "./use-model";

const SvgChartStandIn = ({ ctx }: { ctx: AdapterContext }) => {
  const model = useTargetModel(ctx.target, extractSvgModel);
  return <ChartStage model={model} width={ctx.rect.width} height={ctx.rect.height} />;
};

/**
 * Legacy SVG charts without a chart library. Data is scraped from the marks and calibrated
 * against the tick labels (see svg-chart.ts). Only svgs labelled as charts are candidates.
 */
export const chartSvgAdapter: Adapter = {
  id: "chart-svg",
  label: "Legacy SVG charts",
  group: "charts",
  ditherComponents: ["area-chart", "line-chart", "bar-chart", "donut-chart"],
  selectors: [
    {
      selector: 'svg[role="img"][aria-label$="chart"], svg[role="img"][aria-label$="donut"]',
      confidence: "med",
      source: "fixture /legacy LegacyCharts (role=img with aria-label); scraped marks, axes from tick labels",
    },
  ],
  defaultEnabled: true,
  maxInstances: 12,
  match: (el) => extractSvgModel(el) !== null,
  mode: "sibling-replace",
  render: (ctx) => <SvgChartStandIn ctx={ctx} />,
};
