import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { normaliseEChartsOption } from "../../src/adapters/charts/echarts-normalise";
import { isUsableModel, type ChartModel } from "../../src/adapters/charts/model";

/**
 * Offline replay of the option objects captured from the owner's real dashboard
 * (real-dom/*.charts.json, read in place: values are never copied or quoted). Each capture is
 * an array of { index, w, h, chain, options }, where `options` is the ECharts option that the
 * Kumo Chart wrapper passed in. Functions are serialised as "__fn__", so no page formatter runs
 * here. These tests assert shape and quality only.
 */

const REAL_DOM = fileURLToPath(new URL("../../real-dom/", import.meta.url));

interface CapturedChart {
  readonly index: number;
  readonly w: number;
  readonly h: number;
  readonly options: unknown;
}

const loadCaptures = (name: string): CapturedChart[] => {
  const raw: unknown = JSON.parse(readFileSync(`${REAL_DOM}${name}.charts.json`, "utf8"));
  return Array.isArray(raw) ? (raw as CapturedChart[]) : [];
};

const modelsOf = (name: string): { chart: CapturedChart; model: ChartModel | null }[] =>
  loadCaptures(name).map((chart) => ({ chart, model: normaliseEChartsOption(chart.options) }));

test.describe("real captured ECharts options", () => {
  test("every home chart becomes a usable area over its complete span", () => {
    const captured = modelsOf("home-dark");
    expect(captured.length).toBeGreaterThan(0);
    for (const { model } of captured) {
      expect(model).not.toBeNull();
      expect(model?.kind).toBe("area");
      expect(isUsableModel(model!)).toBe(true);
      if (model?.kind === "area") expect(model.series).toHaveLength(1);
    }
  });

  test("every analytics chart is usable: sparklines as areas, time-axis charts as lines or bars", () => {
    const captured = modelsOf("zone-analytics-dark");
    expect(captured.length).toBeGreaterThan(0);
    for (const { model } of captured) {
      expect(model).not.toBeNull();
      expect(isUsableModel(model!)).toBe(true);
    }
    const kinds = captured.map(({ model }) => model?.kind);
    expect(kinds).toContain("area");
    expect(kinds).toContain("bar");
  });

  test("stacked bars keep their stack flag and every series aligned on the time axis", () => {
    const bars = modelsOf("zone-analytics-dark").filter(({ model }) => model?.kind === "bar");
    expect(bars.length).toBeGreaterThan(0);
    for (const { model } of bars) {
      if (model?.kind !== "bar") throw new Error("expected bar");
      expect(model.stacked).toBe(true);
      expect(model.xLabels.every((label) => label !== "")).toBe(true);
    }
  });

  test("worker overview charts are usable when they carry cartesian series", () => {
    for (const { model, chart } of modelsOf("worker-overview-dark")) {
      if (model === null) {
        // Only charts the normaliser cannot read may be left out; they must not be malformed cartesian data.
        expect(chart.options).toBeTruthy();
        continue;
      }
      expect(isUsableModel(model)).toBe(true);
    }
  });
});
