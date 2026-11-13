import { Chart, LayerCard, TimeseriesChart, type KumoChartOption } from "@cloudflare/kumo";
import * as echarts from "echarts";
import { useColorMode } from "../../app/mode";
import { COUNTRY_SHARES, ERROR_SERIES, REQUEST_SERIES } from "../../data/fixtures";

const DONUT_PALETTE = ["#f38020", "#2563eb", "#16a34a", "#9333ea", "#94a3b8"];

function donutOption(isDark: boolean): KumoChartOption {
  return {
    backgroundColor: "transparent",
    color: DONUT_PALETTE,
    tooltip: { trigger: "item" },
    legend: { bottom: 0, textStyle: { color: isDark ? "#e5e7eb" : "#374151" } },
    series: [
      {
        name: "Traffic by country",
        type: "pie",
        radius: ["45%", "70%"],
        center: ["50%", "45%"],
        data: COUNTRY_SHARES.map((share) => ({ name: share.name, value: share.value })),
        label: { show: false },
      },
    ],
  };
}

export function ChartsSection(): JSX.Element {
  const mode = useColorMode();
  const isDark = mode === "dark";
  return (
    <section aria-label="Traffic charts" className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <LayerCard className="lg:col-span-2">
        <LayerCard.Secondary>Requests over time</LayerCard.Secondary>
        <LayerCard.Primary>
          <TimeseriesChart
            echarts={echarts}
            isDarkMode={isDark}
            type="line"
            data={REQUEST_SERIES}
            xAxisName="Time (UTC)"
            yAxisName="Requests"
            height={260}
          />
        </LayerCard.Primary>
      </LayerCard>
      <LayerCard>
        <LayerCard.Secondary>Traffic by country</LayerCard.Secondary>
        <LayerCard.Primary>
          <Chart echarts={echarts} isDarkMode={isDark} options={donutOption(isDark)} height={260} />
        </LayerCard.Primary>
      </LayerCard>
      <LayerCard className="lg:col-span-3">
        <LayerCard.Secondary>5xx errors per hour</LayerCard.Secondary>
        <LayerCard.Primary>
          <TimeseriesChart
            echarts={echarts}
            isDarkMode={isDark}
            type="bar"
            data={ERROR_SERIES}
            xAxisName="Time (UTC)"
            yAxisName="Errors"
            height={200}
          />
        </LayerCard.Primary>
      </LayerCard>
    </section>
  );
}
