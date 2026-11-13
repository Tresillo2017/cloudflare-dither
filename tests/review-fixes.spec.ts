import { expect, test, type Page } from "@playwright/test";
import { collectConsoleErrors, injectUserscript, setAdapterEnabled, startFixture, type FixtureServer } from "./helpers";

/** Regression tests for the review of the first build (see docs/review-log.md). */

const BUNDLE = process.env.DCF_BUNDLE ?? "dist/cloudflare-dither.user.js";
/** Mirrors MAX_TOTAL_MOUNTS in src/core/registry.ts. */
const TOTAL_MOUNT_BUDGET = 300;
/** Original tiles only: once mounted, sibling stand-in hosts are children of the same section. */
const KPI_TILES = 'section[aria-label="Key metrics"] > *:not([data-dcf-host])';

let fixture: FixtureServer;

test.beforeAll(async () => {
  fixture = await startFixture();
});

test.afterAll(async () => {
  await fixture?.stop();
});

const openHome = async (page: Page): Promise<void> => {
  await page.goto(`${fixture.baseUrl}/`);
  await page.waitForLoadState("networkidle");
};

const boxes = (page: Page, selector: string): Promise<{ x: number; y: number; width: number; height: number }[]> =>
  page.locator(selector).evaluateAll((els) =>
    els.map((el) => {
      const box = el.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    }),
  );

/** The chart stand-in host placed right after a given svg. */
const standInAfter = (page: Page, svgSelector: string) =>
  page.locator(svgSelector).locator('xpath=preceding-sibling::*[1][@data-dcf-host="chart-svg"] | following-sibling::*[1][@data-dcf-host="chart-svg"]');

test.describe("review regressions", () => {
  test("an overlay on a grid child does not move its neighbours", async ({ page }) => {
    await openHome(page);
    const errors = collectConsoleErrors(page);
    await page.locator('section[aria-label="Key metrics"]').scrollIntoViewIfNeeded();
    const before = await boxes(page, KPI_TILES);
    expect(before.length).toBeGreaterThan(1);

    await injectUserscript(page, BUNDLE);
    await expect(page.locator('[data-dcf-host="stat-tile"]')).toHaveCount(before.length, { timeout: 15_000 });
    const hostPosition = await page.locator('[data-dcf-host="stat-tile"]').first().evaluate((el) => getComputedStyle(el).position);
    expect(hostPosition).toBe("absolute");

    const after = await boxes(page, KPI_TILES);
    expect(after).toHaveLength(before.length);
    before.forEach((box, index) => {
      expect(Math.abs(after[index].x - box.x)).toBeLessThan(0.5);
      expect(Math.abs(after[index].y - box.y)).toBeLessThan(0.5);
      expect(Math.abs(after[index].width - box.width)).toBeLessThan(0.5);
    });
    expect(errors.messages).toEqual([]);
  });

  test("a control added inside a stat tile keeps working and visible when the tile is released", async ({ page }) => {
    await openHome(page);
    const tiles = page.locator(KPI_TILES);
    await page.locator('section[aria-label="Key metrics"]').scrollIntoViewIfNeeded();
    // Counted before mounting: once stand-ins exist they are children of the same section.
    const tileCount = await tiles.count();
    await injectUserscript(page, BUNDLE);
    await expect(page.locator('[data-dcf-host="stat-tile"]')).toHaveCount(tileCount, { timeout: 15_000 });

    await tiles.first().evaluate((el) => {
      const link = document.createElement("a");
      link.href = "#details";
      link.id = "dcf-review-link";
      link.textContent = "View details";
      el.append(link);
    });

    await expect(page.locator('[data-dcf-host="stat-tile"]')).toHaveCount(tileCount - 1, { timeout: 5_000 });
    const link = page.locator("#dcf-review-link");
    await expect(link).toBeVisible();
    const tileOpacity = await tiles.first().evaluate((el) => getComputedStyle(el).opacity);
    expect(tileOpacity).toBe("1");
  });

  test("keyboard focus ring stays on an underlaid button", async ({ page }) => {
    await openHome(page);
    await injectUserscript(page, BUNDLE);
    const button = page.getByRole("button", { name: "primary xs", exact: true }).first();
    await button.scrollIntoViewIfNeeded();
    await expect(button.locator('[data-dcf-host="button"]')).toHaveCount(1, { timeout: 15_000 });

    await button.focus();
    expect(await button.evaluate((el) => el.matches(":focus-visible"))).toBe(true);
    const withAdapter = await button.evaluate((el) => getComputedStyle(el).boxShadow);

    await setAdapterEnabled(page, "button", false);
    await expect(page.locator('[data-dcf-host="button"]')).toHaveCount(0, { timeout: 5_000 });
    await button.focus();
    const withoutAdapter = await button.evaluate((el) => getComputedStyle(el).boxShadow);

    expect(withoutAdapter).not.toBe("none");
    expect(withAdapter).toBe(withoutAdapter);
  });

  test("the mount budget caps stand-ins across adapters", async ({ page }) => {
    await openHome(page);
    await injectUserscript(page, BUNDLE);
    await page.evaluate(() => {
      const pane = document.createElement("div");
      pane.id = "dcf-budget-pane";
      pane.setAttribute("style", "position:fixed;inset:0;z-index:2147483000;background:#fff;display:grid;grid-template-columns:repeat(40,30px);grid-auto-rows:12px;overflow:hidden;");
      for (let index = 0; index < 120; index += 1) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = `b${index}`;
        button.setAttribute("data-kumo-component", "Button");
        pane.append(button);
      }
      for (let index = 0; index < 120; index += 1) {
        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.setAttribute("role", "switch");
        toggle.setAttribute("aria-checked", "false");
        toggle.textContent = `s${index}`;
        pane.append(toggle);
      }
      for (let index = 0; index < 200; index += 1) pane.append(document.createElement("hr"));
      document.body.append(pane);
    });

    await expect.poll(() => page.locator("[data-dcf-host]").count(), { timeout: 20_000 }).toBeGreaterThan(200);
    await page.waitForTimeout(1000);
    const mounted = await page.locator("[data-dcf-host]").count();
    expect(mounted).toBeLessThanOrEqual(TOTAL_MOUNT_BUDGET);
  });

  test("a chart in a hidden panel is re-skinned once the panel is shown", async ({ page }) => {
    await openHome(page);
    await injectUserscript(page, BUNDLE);
    await page.evaluate(() => {
      const panel = document.createElement("section");
      panel.id = "dcf-hidden-panel";
      panel.style.display = "none";
      panel.innerHTML = `<svg role="img" aria-label="Hidden line chart" viewBox="0 0 600 240" width="600" height="240">
        <text x="40" y="200" font-size="11">0</text>
        <text x="40" y="20" font-size="11">10k</text>
        <text x="40" y="230" font-size="11">00:00</text>
        <text x="560" y="230" font-size="11">24:00</text>
        <path d="M48,180 L200,120 L400,90 L580,40" fill="none" stroke="#f38020" stroke-width="2"></path>
      </svg>`;
      document.querySelector("main")?.append(panel);
    });
    await page.waitForTimeout(800);
    await expect(standInAfter(page, "#dcf-hidden-panel svg")).toHaveCount(0);

    await page.evaluate(() => {
      const panel = document.getElementById("dcf-hidden-panel");
      if (panel) panel.style.display = "block";
    });
    // Stand-ins mount only near the viewport, so bring the revealed chart on screen.
    await page.locator("#dcf-hidden-panel svg").scrollIntoViewIfNeeded();
    await expect(standInAfter(page, "#dcf-hidden-panel svg")).toHaveCount(1, { timeout: 10_000 });
  });

  test("a line chart with a background panel and a legend swatch is not read as bars", async ({ page }) => {
    await openHome(page);
    await injectUserscript(page, BUNDLE);
    await page.evaluate(() => {
      const panel = document.createElement("section");
      panel.id = "dcf-line-panel";
      panel.innerHTML = `<svg role="img" aria-label="Background line chart" viewBox="0 0 600 240" width="600" height="240">
        <rect x="0" y="0" width="600" height="240" fill="#ffffff"></rect>
        <rect x="500" y="5" width="10" height="10" fill="#f38020"></rect>
        <text x="40" y="200" font-size="11">0</text>
        <text x="40" y="20" font-size="11">10k</text>
        <path d="M48,180 L200,120 L400,90 L580,40" fill="none" stroke="#f38020" stroke-width="2"></path>
      </svg>`;
      document.querySelector("main")?.append(panel);
    });
    await page.locator("#dcf-line-panel svg").scrollIntoViewIfNeeded();
    const host = standInAfter(page, "#dcf-line-panel svg");
    await expect(host).toHaveCount(1, { timeout: 10_000 });
    await expect(host.locator('[data-dcf-visual="chart"]')).toHaveAttribute("data-dcf-kind", "line");
  });

  test("a pagehide from the back/forward cache keeps the stand-ins", async ({ page }) => {
    await openHome(page);
    await injectUserscript(page, BUNDLE);
    const hosts = page.locator("[data-dcf-host]");
    await expect.poll(() => hosts.count(), { timeout: 15_000 }).toBeGreaterThan(0);
    // Let lazy mounting settle first, so the count is not still growing while we measure.
    await page.waitForTimeout(1500);
    const settled = await hosts.count();
    await page.evaluate(() => {
      window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
    });
    await page.waitForTimeout(400);
    expect(await hosts.count()).toBe(settled);
  });
});
