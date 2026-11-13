import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { collectConsoleErrors, domSnapshot, injectUserscript, setAdapterEnabled, startFixture, type FixtureServer } from "./helpers";
import { normaliseEChartsOption } from "../src/adapters/charts/echarts-normalise";
import { isUsableModel } from "../src/adapters/charts/model";
import { parseRgb, toPaletteName } from "../src/adapters/charts/palette";
import { fitAxis, formatMinutes, parseNumericLabel, parsePathVertices, parseTimeLabel, stripChartSuffix } from "../src/adapters/charts/svg-math";
import { parseDelta } from "../src/adapters/charts/stat-dom";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
/** Computed colours of every node in the first chart stand-in, as one comparable fingerprint. */
const chartPalette = (page: Page): Promise<string> =>
  page.locator('[data-dcf-visual="chart"]').first().evaluate((root) => {
    const values = new Set<string>();
    for (const el of [root, ...root.querySelectorAll("*")]) {
      const style = getComputedStyle(el);
      values.add(`${style.color}|${style.fill}|${style.stroke}`);
    }
    return [...values].sort().join("\n");
  });

const BUNDLE = process.env.DCF_BUNDLE ?? "dist/cloudflare-dither.user.js";
const SHOTS = resolve(ROOT, "tests/screenshots");
const VIEWPORT = { width: 1280, height: 1800 };

// ---------------------------------------------------------------------------
// Pure unit tests: normalisation, palette, axis calibration, text parsing.
// ---------------------------------------------------------------------------

const HOUR = 3_600_000;
const START = Date.UTC(2026, 10, 1);
const timeline = (values: number[]): [number, number][] => values.map((v, i) => [START + i * HOUR, v]);

test.describe("echarts option normalisation", () => {
  test("reads a Kumo-style timeseries line option as a line with named palette colours", () => {
    // Arrange
    const option = {
      backgroundColor: "transparent",
      xAxis: { type: "time" },
      series: [
        { data: timeline([1, 2, 3]), color: "#f38020", name: "Requests", type: "line", showSymbol: false },
        { data: timeline([4, 5, 6]), color: "#2563eb", name: "Cached", type: "line", showSymbol: false },
        { data: timeline([9, 9, 9]), color: "#f38020", name: "Requests", type: "line", lineStyle: { type: "dashed" } },
        { data: [], name: "Markers", type: "line" },
      ],
    };
    // Act
    const model = normaliseEChartsOption(option);
    // Assert
    expect(model).toMatchObject({ kind: "line", stacked: false });
    if (model?.kind !== "line") throw new Error("expected a line model");
    expect(model.series.map((s) => s.label)).toEqual(["Requests", "Cached"]);
    expect(model.series.map((s) => s.color)).toEqual(["orange", "blue"]);
    expect(model.series[0]?.values).toEqual([1, 2, 3]);
    expect(model.xLabels[0]).toBe("00:00");
    expect(isUsableModel(model)).toBe(true);
  });

  test("marks a bar option with stack as a stacked bar", () => {
    const model = normaliseEChartsOption({
      xAxis: { type: "time" },
      series: [{ type: "bar", stack: "total", name: "5xx", color: "#dc2626", data: timeline([3, 4]) }],
    });
    expect(model).toMatchObject({ kind: "bar", stacked: true });
  });

  test("treats a line whose every series has areaStyle as an area", () => {
    const model = normaliseEChartsOption({
      xAxis: { type: "time" },
      series: [{ type: "line", name: "A", areaStyle: {}, data: timeline([1, 2]) }],
    });
    expect(model).toMatchObject({ kind: "area" });
  });

  test("reads a category line option", () => {
    const model = normaliseEChartsOption({
      xAxis: { type: "category", data: ["Mon", "Tue", "Wed"] },
      series: [{ type: "line", name: "Hits", data: [1, 2, 3] }],
    });
    expect(model).toMatchObject({ kind: "line", xLabels: ["Mon", "Tue", "Wed"] });
  });

  test("reads a pie option as donut slices with palette colours", () => {
    const model = normaliseEChartsOption({
      color: ["#f38020", "#2563eb", "#16a34a"],
      series: [
        {
          type: "pie",
          name: "Traffic by country",
          data: [
            { name: "US", value: 34 },
            { name: "DE", value: 18 },
            { name: "JP", value: 12 },
          ],
        },
      ],
    });
    expect(model).toEqual({
      kind: "pie",
      label: "Traffic by country",
      slices: [
        { label: "US", value: 34, color: "orange" },
        { label: "DE", value: 18, color: "blue" },
        { label: "JP", value: 12, color: "green" },
      ],
    });
  });

  test("reads a radar option with its indicator axes and shared max", () => {
    const model = normaliseEChartsOption({
      radar: { indicator: [{ name: "Speed", max: 100 }, { name: "Cost", max: 100 }, { name: "Quality", max: 100 }] },
      series: [{ type: "radar", data: [{ name: "A", value: [80, 40, 70] }] }],
    });
    expect(model).toMatchObject({ kind: "radar", axes: ["Speed", "Cost", "Quality"], max: 100 });
    expect(isUsableModel(model!)).toBe(true);
  });

  test("reads a heatmap option into a matrix with zero for empty cells", () => {
    const model = normaliseEChartsOption({
      xAxis: { type: "category", data: ["00", "01", "02"] },
      yAxis: { type: "category", data: ["Mon", "Tue"] },
      series: [{ type: "heatmap", data: [[0, 0, 4], [2, 1, 6]] }],
    });
    expect(model).toEqual({ kind: "heatmap", rows: ["Mon", "Tue"], columns: ["00", "01", "02"], values: [[4, 0, 0], [0, 0, 6]] });
  });

  test("returns null for mixed series types and unknown types", () => {
    expect(normaliseEChartsOption({ series: [{ type: "line", data: [] }, { type: "bar", data: [] }] })).toBeNull();
    expect(normaliseEChartsOption({ series: [{ type: "scatter", data: [[1, 2]] }] })).toBeNull();
    expect(normaliseEChartsOption(null)).toBeNull();
  });

  test("keeps the complete main series and drops a shorter series that does not cover its span", () => {
    // Arrange: the 2-point series has no value at the main series' later timestamps
    const model = normaliseEChartsOption({
      xAxis: { type: "time" },
      series: [{ type: "line", name: "A", data: timeline([1, 2, 3]) }, { type: "line", name: "B", data: timeline([1, 2]) }],
    });
    // Assert
    expect(model).toMatchObject({ kind: "line", xLabels: ["00:00", "01:00", "02:00"] });
    if (model?.kind !== "line") throw new Error("expected a line model");
    expect(model.series.map((s) => s.label)).toEqual(["A"]);
  });

  test("returns null when the main series has a gap inside its span", () => {
    expect(
      normaliseEChartsOption({
        xAxis: { type: "value" },
        series: [{ type: "line", data: [[0, 1], [1, null], [2, 3]] }],
      }),
    ).toBeNull();
  });

  test("a model with a single point fails the quality gate", () => {
    const model = normaliseEChartsOption({
      xAxis: { type: "category", data: ["only"] },
      series: [{ type: "line", data: [1] }],
    });
    expect(model).not.toBeNull();
    expect(isUsableModel(model!)).toBe(false);
  });
});

test.describe("sparse Kumo option shapes", () => {
  const sparseLine = (values: (number | null)[], name?: string) => ({
    id: name ?? "s",
    type: "line",
    data: values.map((value, index) => [index, value]),
    areaStyle: { color: "#4290F0", opacity: 0.12 },
    lineStyle: { color: "#4290F0", width: 1.5 },
  });

  test("a value-axis area with null edges and split pieces becomes one area over the complete span", () => {
    // Arrange: the same shape as the real home charts (indices, null edges, sparse split series)
    const option = {
      xAxis: { type: "value", min: 0, max: 4, axisLabel: { show: false } },
      yAxis: { type: "value", position: "right", axisLabel: { show: true } },
      series: [
        sparseLine([null, 838, 872, 774, 778, null]),
        sparseLine([71, 838, null, null, null, null]),
        sparseLine([null, null, null, null, null, null]),
      ],
    };
    // Act
    const model = normaliseEChartsOption(option);
    // Assert
    expect(model).toMatchObject({ kind: "area", xLabels: ["", "", "", ""], axes: true, legend: false, stacked: false });
    if (model?.kind !== "area") throw new Error("expected an area model");
    expect(model.series).toHaveLength(1);
    expect(model.series[0]?.values).toEqual([838, 872, 774, 778]);
    expect(model.series[0]?.color).toBe("blue");
    expect(isUsableModel(model!)).toBe(true);
  });

  test("a complete value-axis area passes the quality gate and keeps hidden labels empty", () => {
    const option = {
      xAxis: { type: "value", axisLabel: { show: false } },
      yAxis: { type: "value", axisLabel: { show: false } },
      series: [sparseLine([1, 2, 3, 4])],
    };
    const model = normaliseEChartsOption(option);
    expect(model).toMatchObject({ kind: "area", axes: false });
    expect(isUsableModel(model!)).toBe(true);
  });

  test("uses the page's y formatter when it works, and falls back when it throws", () => {
    const withFormat = normaliseEChartsOption({
      yAxis: { type: "value", axisLabel: { formatter: (value: number) => `${value} ms` } },
      series: [sparseLine([1, 2, 3])],
    });
    expect(withFormat?.kind === "area" || withFormat?.kind === "line").toBe(true);
    if (!withFormat || (withFormat.kind !== "area" && withFormat.kind !== "line")) throw new Error("expected cartesian");
    expect(withFormat.yFormat?.(12)).toBe("12 ms");
    expect(withFormat.yFormatProbe).toBe("1234.5 ms");

    const throwing = normaliseEChartsOption({
      yAxis: { type: "value", axisLabel: { formatter: () => { throw new Error("boom"); } } },
      series: [sparseLine([1, 2, 3])],
    });
    if (!throwing || (throwing.kind !== "area" && throwing.kind !== "line")) throw new Error("expected cartesian");
    expect(throwing.yFormat?.(1234)).toBe("1.2K");
  });

  test("shows a legend only when the source declares one", () => {
    const withLegend = normaliseEChartsOption({ legend: {}, series: [sparseLine([1, 2, 3], "a"), sparseLine([1, 2, 3], "b")] });
    const hidden = normaliseEChartsOption({ legend: { show: false }, series: [sparseLine([1, 2, 3])] });
    expect(withLegend).toMatchObject({ legend: true });
    expect(hidden).toMatchObject({ legend: false });
  });
});

test.describe("palette mapping", () => {
  test("parses hex and rgb() colours", () => {
    expect(parseRgb("#f38020")).toEqual([243, 128, 32]);
    expect(parseRgb("#fff")).toEqual([255, 255, 255]);
    expect(parseRgb("rgb(22, 163, 74)")).toEqual([22, 163, 74]);
    expect(parseRgb("oklch(0.6 0.2 270)")).toBeNull();
  });

  test("maps near colours to the named palette and rejects far ones", () => {
    expect(toPaletteName("#2563eb")).toBe("blue");
    expect(toPaletteName("#dc2626")).toBe("red");
    expect(toPaletteName("#94a3b8")).toBe("grey");
    expect(toPaletteName("#374151")).toBe("ink");
    expect(toPaletteName("#00ff00")).toBeUndefined();
    expect(toPaletteName(undefined)).toBeUndefined();
  });
});

test.describe("svg scraping helpers", () => {
  test("parses numeric and time tick labels", () => {
    expect(parseNumericLabel("10k")).toBe(10_000);
    expect(parseNumericLabel("0")).toBe(0);
    expect(parseNumericLabel("1.5M")).toBe(1_500_000);
    expect(parseNumericLabel("06:00")).toBeNull();
    expect(parseTimeLabel("06:00")).toBe(360);
    expect(parseTimeLabel("24:00")).toBe(1440);
    expect(parseTimeLabel("12")).toBeNull();
    expect(formatMinutes(131)).toBe("02:11");
  });

  test("fits an exact axis and rejects a noisy one", () => {
    const exact = fitAxis([
      { position: 200, value: 0 },
      { position: 116, value: 5000 },
      { position: 32, value: 10000 },
    ]);
    expect(exact?.apply(74)).toBeCloseTo(7500, 6);
    expect(fitAxis([{ position: 1, value: 1 }])).toBeNull();
    // Two labels with the same value cannot scale data: every point would map to one value.
    expect(fitAxis([{ position: 200, value: 0 }, { position: 16, value: 0 }])).toBeNull();
    expect(fitAxis([{ position: 1, value: 1 }, { position: 2, value: 90 }, { position: 3, value: 2 }, { position: 4, value: 80 }])).toBeNull();
  });

  test("reads absolute and relative line vertices and refuses curves", () => {
    expect(parsePathVertices("M48,200 L100,150 L152,120")).toEqual([
      { x: 48, y: 200 },
      { x: 100, y: 150 },
      { x: 152, y: 120 },
    ]);
    expect(parsePathVertices("M10 10 l5 5 h10 v-4")).toEqual([
      { x: 10, y: 10 },
      { x: 15, y: 15 },
      { x: 25, y: 15 },
      { x: 25, y: 11 },
    ]);
    expect(parsePathVertices("M0 0 C 10 10 20 20 30 30")).toBeNull();
  });

  test("strips chart suffixes from aria labels", () => {
    expect(stripChartSuffix("Requests line chart")).toBe("Requests");
    expect(stripChartSuffix("Errors bar chart")).toBe("Errors");
    expect(stripChartSuffix("Traffic by country donut")).toBe("Traffic by country");
  });
});

test.describe("stat text parsing", () => {
  test("splits a signed percent from its trailing label", () => {
    expect(parseDelta("+4.2% vs previous period")).toEqual({ delta: 4.2, deltaLabel: "vs previous period" });
    expect(parseDelta("-1.1% · vs last month")).toEqual({ delta: -1.1, deltaLabel: "vs last month" });
  });

  test("keeps text without a percent as the label only", () => {
    expect(parseDelta("Up vs previous period")).toEqual({ deltaLabel: "Up vs previous period" });
    expect(parseDelta("")).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// End to end against the fixture routes "/" (Kumo ECharts) and "/legacy" (SVG).
// ---------------------------------------------------------------------------

let fixture: FixtureServer;

test.beforeAll(async () => {
  fixture = await startFixture();
  mkdirSync(SHOTS, { recursive: true });
});

test.afterAll(async () => {
  await fixture?.stop();
});

const host = (page: Page, id: string): Locator => page.locator(`[data-dcf-host="${id}"]`);

/** The legacy page is taller than the default viewport; this keeps every legacy chart in view for the count assertions. */
const LEGACY_VIEWPORT = { width: VIEWPORT.width, height: 2600 };

const openRoute = async (page: Page, path: string, mode: "light" | "dark" = "light"): Promise<void> => {
  await page.setViewportSize(path.startsWith("/legacy") ? LEGACY_VIEWPORT : VIEWPORT);
  await page.goto(`${fixture.baseUrl}${path}`);
  if (mode === "dark") await page.evaluate(() => document.documentElement.setAttribute("data-mode", "dark"));
  await page.waitForLoadState("load");
};

const shot = async (page: Page, name: string): Promise<void> => {
  await page.screenshot({ path: resolve(SHOTS, `charts-${name}.png`), fullPage: false });
};

test.describe("kumo home route", () => {
  test("mounts a stand-in per ECharts chart and per KPI tile, keeping originals in place", async ({ page }) => {
    await openRoute(page, "/");
    const errors = collectConsoleErrors(page);
    await injectUserscript(page, BUNDLE);

    await expect(host(page, "chart-echarts")).toHaveCount(3);
    await expect(host(page, "stat-tile")).toHaveCount(4);
    await expect(page.locator('[_echarts_instance_][data-dcf-hidden="chart-echarts"]')).toHaveCount(3);
    await expect(page.locator('[_echarts_instance_]')).toHaveCount(3);

    // Stand-ins are visual, inert and aria-hidden.
    const first = host(page, "chart-echarts").first();
    await expect(first).toHaveAttribute("aria-hidden", "true");
    await expect(first).toHaveAttribute("inert", "");

    // Each chart stand-in draws (non-blank SVG with paths or rects) at the original's size.
    const charts = page.locator('[data-dcf-visual="chart"]');
    await expect(charts).toHaveCount(3);
    for (let index = 0; index < 3; index += 1) {
      const chart = charts.nth(index);
      await expect.poll(() => chart.locator("svg path, svg rect, svg circle").count()).toBeGreaterThan(0);
      const box = await chart.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThan(100);
      expect(box?.height ?? 0).toBeGreaterThan(100);
    }
    await expect(charts.first()).toHaveAttribute("data-dcf-kind", "line");
    await expect(charts.nth(1)).toHaveAttribute("data-dcf-kind", "pie");
    await shot(page, "home-light");

    // The original chart and tile text remain (for a11y) and are focusable containers only where they were.
    await expect(page.getByText("Requests", { exact: true }).first()).toBeAttached();
    expect(errors.messages).toEqual([]);
  });

  test("KPI stand-ins mirror the original text and the original stays in the accessibility tree", async ({ page }) => {
    await openRoute(page, "/");
    await injectUserscript(page, BUNDLE);
    const tile = host(page, "stat-tile").first();
    await expect(tile).toBeAttached();
    const shadowText = await page.evaluate(() => {
      const hostEl = document.querySelector('[data-dcf-host="stat-tile"]');
      return hostEl?.shadowRoot?.textContent ?? "";
    });
    expect(shadowText).toContain("1,284,552");
    await expect(page.locator('section[aria-label="Key metrics"] > *').first()).toHaveAttribute("data-dcf-hidden", "stat-tile");
  });

  test("theme flip keeps the stand-ins mounted and updates their theme", async ({ page }) => {
    await openRoute(page, "/");
    const errors = collectConsoleErrors(page);
    await injectUserscript(page, BUNDLE);
    await expect(host(page, "chart-echarts")).toHaveCount(3);
    await page.evaluate(() => document.documentElement.setAttribute("data-mode", "dark"));
    await expect(host(page, "chart-echarts").first()).toHaveAttribute("data-dcf-theme", "dark");
    await expect(host(page, "chart-echarts")).toHaveCount(3);
    await page.waitForTimeout(1200);
    await expect(host(page, "chart-echarts")).toHaveCount(3);
    await expect(page.locator('[data-dcf-visual="chart"]').first().locator("svg path, svg rect").first()).toBeAttached();
    // The colours must actually change: a nudge that never reaches the engine leaves the old palette.
    const darkPalette = await chartPalette(page);
    await shot(page, "home-dark");
    await page.evaluate(() => document.documentElement.setAttribute("data-mode", "light"));
    await expect(host(page, "chart-echarts").first()).toHaveAttribute("data-dcf-theme", "light");
    await page.waitForTimeout(1200);
    expect(await chartPalette(page)).not.toBe(darkPalette);
    expect(errors.messages).toEqual([]);
  });

  test("disabling the ECharts adapter restores the chart container exactly", async ({ page }) => {
    await openRoute(page, "/");
    await injectUserscript(page, BUNDLE);
    await expect(host(page, "chart-echarts")).toHaveCount(3);
    const withStandIn = await page.locator("[_echarts_instance_]").first().evaluate((el) => el.hasAttribute("data-dcf-hidden"));
    expect(withStandIn).toBe(true);
    await setAdapterEnabled(page, "chart-echarts", false);
    await expect(host(page, "chart-echarts")).toHaveCount(0);
    await expect(page.locator("[_echarts_instance_][data-dcf-hidden]")).toHaveCount(0);
  });

  test("disabling the chart adapters restores the ECharts containers exactly", async ({ page }) => {
    await openRoute(page, "/");
    const containers = page.locator("[_echarts_instance_]");
    const before = await containers.first().evaluate((el) => el.outerHTML);
    await injectUserscript(page, BUNDLE);
    await expect(host(page, "chart-echarts")).toHaveCount(3);
    await setAdapterEnabled(page, "chart-echarts", false);
    await expect(host(page, "chart-echarts")).toHaveCount(0);
    expect(await containers.first().evaluate((el) => el.outerHTML)).toBe(before);
  });
});

test.describe("legacy route", () => {
  test("mounts stand-ins for SVG charts, KPI cards and the uptime strip", async ({ page }) => {
    await openRoute(page, "/legacy");
    const errors = collectConsoleErrors(page);
    await injectUserscript(page, BUNDLE);

    await expect(host(page, "chart-svg")).toHaveCount(3);
    await expect(host(page, "stat-tile")).toHaveCount(4);
    await expect(host(page, "uptime-strip")).toHaveCount(1);
    await expect(host(page, "sparkline-svg")).toHaveCount(0);

    const kinds = await page.locator('[data-dcf-visual="chart"]').evaluateAll((els) => els.map((el) => el.getAttribute("data-dcf-kind")));
    expect(kinds).toEqual(["area", "bar", "pie"]);
    await expect(page.locator('[data-dcf-visual="uptime"]')).toHaveCount(1);
    await expect.poll(() => page.locator('[data-dcf-visual="chart"] svg path, [data-dcf-visual="chart"] svg rect').count()).toBeGreaterThan(10);
    await shot(page, "legacy-light");
    expect(errors.messages).toEqual([]);
  });

  test("original legacy controls keep working under the stand-ins", async ({ page }) => {
    await openRoute(page, "/legacy");
    await injectUserscript(page, BUNDLE);
    await expect(host(page, "chart-svg")).toHaveCount(3);
    await page.locator('[data-testid="button-primary"]').click();
    await expect(page.locator('[data-testid="legacy-click-count"]')).toHaveText("Clicks: 1");
    await page.locator('[data-testid="button-toggle-table"]').click();
    await expect(page.locator('[data-testid="zones-card"]')).toHaveCount(0);
  });

  test("an SVG whose tick labels cannot be calibrated is left untouched", async ({ page }) => {
    await openRoute(page, "/legacy");
    await page.evaluate(() => {
      const svg = document.querySelector('svg[aria-label="Requests line chart"]');
      svg?.querySelectorAll("text").forEach((text) => {
        if (/^\d/.test(text.textContent ?? "") && !text.textContent?.includes(":")) text.textContent = "n/a";
      });
    });
    await injectUserscript(page, BUNDLE);
    await expect(host(page, "chart-svg")).toHaveCount(2);
    await expect(page.locator('svg[aria-label="Requests line chart"]')).not.toHaveAttribute("data-dcf-hidden", /.*/);
  });

  test("uptime strip renders one bar per source status", async ({ page }) => {
    await openRoute(page, "/legacy");
    await injectUserscript(page, BUNDLE);
    await expect(host(page, "uptime-strip")).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => {
      const shadow = document.querySelector('[data-dcf-host="uptime-strip"]')?.shadowRoot;
      return shadow?.querySelectorAll("button").length ?? 0;
    })).toBe(30);
  });

  test("sparklines stay off by default and mount when enabled", async ({ page }) => {
    await openRoute(page, "/legacy");
    await injectUserscript(page, BUNDLE);
    await expect(host(page, "sparkline-svg")).toHaveCount(0);
    await setAdapterEnabled(page, "sparkline-svg", true);
    await expect(host(page, "sparkline-svg")).toHaveCount(5);
    await shot(page, "legacy-sparklines");
  });

  test("disabling the SVG chart adapter restores the svg exactly", async ({ page }) => {
    await openRoute(page, "/legacy");
    const before = await page.locator('svg[aria-label="Errors bar chart"]').evaluate((el) => el.outerHTML);
    await injectUserscript(page, BUNDLE);
    await expect(host(page, "chart-svg")).toHaveCount(3);
    await setAdapterEnabled(page, "chart-svg", false);
    await expect(host(page, "chart-svg")).toHaveCount(0);
    expect(await page.locator('svg[aria-label="Errors bar chart"]').evaluate((el) => el.outerHTML)).toBe(before);
  });

  test("legacy dark mode keeps the stand-ins and their colours readable", async ({ page }) => {
    await openRoute(page, "/legacy", "dark");
    await injectUserscript(page, BUNDLE);
    await expect(host(page, "chart-svg")).toHaveCount(3);
    await shot(page, "legacy-dark");
  });
});
