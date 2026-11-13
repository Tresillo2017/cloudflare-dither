import { AreaChart } from "@/components/dithercn/area-chart";
import { BarChart } from "@/components/dithercn/bar-chart";
import { DonutChart } from "@/components/dithercn/donut-chart";
import { Heatmap } from "@/components/dithercn/heatmap";
import { LineChart } from "@/components/dithercn/line-chart";
import { RadarChart } from "@/components/dithercn/radar-chart";
import { Sparkline } from "@/components/dithercn/sparkline";
import { StatCard } from "@/components/dithercn/stat-card";
import { UptimeBar } from "@/components/dithercn/uptime-bar";
import { Gauge } from "@/components/dithercn/gauge";
import { ProgressBar } from "@/components/dithercn/progress-bar";
import { DitherNumber } from "@/components/dithercn/dither-number";
import type { LabEntry } from "./entry";
import { SAMPLE_HEATMAP_DAYS, SAMPLE_MATRIX, SAMPLE_SLICES, SAMPLE_UPTIME, TIME_SERIES } from "./sample-data";

const SERIES_LABELS = { requests: "Requests", errors: "Errors" } as const;

export const dataEntries: readonly LabEntry[] = [
  {
    file: "area-chart",
    title: "Area chart",
    render: () => (
      <AreaChart
        data={TIME_SERIES}
        x="day"
        series={[
          { label: SERIES_LABELS.requests, value: "requests" },
          { label: SERIES_LABELS.errors, value: "errors", color: "red" },
        ]}
        height={150}
        cell={2}
      />
    ),
  },
  {
    file: "bar-chart",
    title: "Bar chart",
    render: () => <BarChart data={TIME_SERIES} x="day" series={[{ label: "Requests", value: "requests" }]} height={150} cell={2} />,
  },
  {
    file: "line-chart",
    title: "Line chart",
    render: () => (
      <LineChart data={TIME_SERIES} x="day" series={[{ label: "Requests", value: "requests", range: { low: "low", high: "high" } }]} height={150} cell={2} />
    ),
  },
  {
    // cartesian-chart.tsx is the shared base of the bar and line charts. It has no standalone props worth sampling.
    file: "cartesian-chart",
    title: "Cartesian base (via bar chart)",
    render: () => <BarChart data={TIME_SERIES} x="day" series={[{ label: "Errors", value: "errors", color: "red" }]} height={150} cell={2} />,
  },
  {
    file: "donut-chart",
    title: "Donut chart",
    render: () => <DonutChart data={SAMPLE_SLICES} label="Traffic source" cell={2} />,
  },
  {
    file: "radar-chart",
    title: "Radar chart",
    render: () => (
      <RadarChart axes={["Edge", "Cache", "Origin", "DNS", "WAF"]} series={[{ label: "This week", values: [4, 3, 5, 2, 4] }]} cell={2} />
    ),
  },
  {
    file: "heatmap",
    title: "Heatmap",
    render: () => (
      <div className="flex flex-col gap-2">
        <Heatmap mode="calendar" data={SAMPLE_HEATMAP_DAYS} weeks={20} cell={2} />
        <Heatmap mode="matrix" data={SAMPLE_MATRIX} rows={["a", "b", "c"]} columns={["w", "x", "y", "z"]} cell={2} />
      </div>
    ),
  },
  {
    file: "sparkline",
    title: "Sparkline",
    render: () => <Sparkline data={TIME_SERIES.map((point) => point.requests)} label="Requests" height={48} area cell={2} />,
  },
  {
    file: "stat-card",
    title: "Stat card",
    render: () => <StatCard label="Requests" value="1,284,552" />,
  },
  {
    file: "uptime-bar",
    title: "Uptime bar",
    render: () => <UptimeBar label="API" days={SAMPLE_UPTIME} />,
  },
  {
    file: "gauge",
    title: "Gauge",
    render: () => <Gauge value={81} label="Workers requests" />,
  },
  {
    file: "progress-bar",
    title: "Progress bar",
    render: () => (
      <ProgressBar
        label="Workers requests"
        parts={[
          { label: "Used", value: 81, color: "orange" },
          { label: "Free", value: 19, color: "grey" },
        ]}
        segments={10}
        cell={2}
      />
    ),
  },
  {
    file: "dither-number",
    title: "Dither number",
    render: () => <DitherNumber value={99.98} />,
  },
];
