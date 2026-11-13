import type { Adapter, AdapterContext } from "../../core/types";
import { ChartStage } from "./chart-views";
import { extractEChartsModel } from "./extract";
import { useTargetModel } from "./use-model";

const EChartsStandIn = ({ ctx }: { ctx: AdapterContext }) => {
  const model = useTargetModel(ctx.target, extractEChartsModel);
  return <ChartStage model={model} width={ctx.rect.width} height={ctx.rect.height} />;
};

/**
 * ECharts canvas charts (Kumo Chart and TimeseriesChart). The option object is read from the
 * React props of the wrapper, so the data is the same data ECharts draws.
 */
export const echartsAdapter: Adapter = {
  id: "chart-echarts",
  label: "ECharts charts",
  group: "charts",
  ditherComponents: ["area-chart", "line-chart", "bar-chart", "donut-chart", "radar-chart", "heatmap"],
  selectors: [
    {
      selector: "div[_echarts_instance_]",
      confidence: "high",
      source: "ECharts sets _echarts_instance_ on its container; option read from the Kumo Chart fiber props (fixture /, ChartsSection)",
    },
  ],
  defaultEnabled: true,
  maxInstances: 24,
  match: (el) => extractEChartsModel(el) !== null,
  mode: "sibling-replace",
  render: (ctx) => <EChartsStandIn ctx={ctx} />,
};
