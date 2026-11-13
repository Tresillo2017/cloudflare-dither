import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_SETTINGS } from "../src/core/settings";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { startFixture, type FixtureServer } from "./helpers/fixture";
import { collectConsoleErrors } from "./helpers/console";
import { injectUserscript } from "./helpers/inject";
import { setAdapterEnabled, setSetting } from "./helpers/settings";

const BUNDLE = process.env.DCF_BUNDLE ?? "dist/cloudflare-dither.user.js";
const SHOT_DIR = "tests/screenshots";
const COMPONENTS_DIR = resolve(process.cwd(), "vendor/dithercn/components/dithercn");
const DATA_FILES = new Set(["world-land"]);
const MAX_LIVE_SHADERS = 8;

let fixture: FixtureServer;

test.beforeAll(async () => {
  fixture = await startFixture();
});

test.afterAll(async () => {
  await fixture.stop();
});

/** Every component file in the vendored dithercn folder, minus data-only modules. */
const componentFiles = (): string[] =>
  readdirSync(COMPONENTS_DIR)
    .map((name) => name.replace(/\.(tsx|ts)$/, ""))
    .filter((name) => !DATA_FILES.has(name))
    .sort();

const openFixture = async (page: Page, options: { gm?: boolean } = {}) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${fixture.baseUrl}/`);
  await page.waitForLoadState("load");
  await injectUserscript(page, BUNDLE, options);
  // The page background is off by default; the panel tests exercise it, so opt in.
  await setAdapterEnabled(page, "page-background", true);
  return errors;
};

/** Running shader count across every open shadow root (the engine's own cap is 8). */
const runningShaders = (page: Page) =>
  page.evaluate(() => {
    let total = 0;
    for (const el of document.querySelectorAll("*")) {
      const root = el.shadowRoot;
      if (root) total += root.querySelectorAll('[data-state="running"]').length;
    }
    return total;
  });

const panel = (page: Page) => page.locator("#dcf-settings-panel");
const launcher = (page: Page) => page.getByRole("button", { name: "Dither", exact: true });

/** Runs a userscript-manager menu command registered through the GM shim, as the manager's menu would. */
const runMenuCommand = (page: Page, label: string): Promise<void> =>
  page.evaluate((wanted) => {
    const commands = (window as unknown as { __dcfMenuCommands?: { label: string; handler: () => void }[] }).__dcfMenuCommands ?? [];
    const command = commands.find((item) => item.label === wanted);
    if (!command) throw new Error(`menu command not registered: ${wanted}`);
    command.handler();
  }, label);

const openPanel = (page: Page): Promise<void> => runMenuCommand(page, "Dither settings");

test.describe("settings UI", () => {
  test("the manager menu opens the panel and no launcher is drawn on the page", async ({ page }) => {
    // Arrange
    const errors = await openFixture(page);

    // Act
    await expect(launcher(page)).toHaveCount(0);
    await openPanel(page);

    // Assert
    await expect(panel(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel(page)).toHaveCount(0);
    await expect(launcher(page)).toHaveCount(0);
    expect(errors.messages).toEqual([]);
  });

  test("without a manager menu the fallback launcher opens the panel, Escape closes it and returns focus", async ({ page }) => {
    const errors = await openFixture(page, { gm: false });
    await expect(launcher(page)).toBeVisible();
    await launcher(page).click();
    await expect(panel(page)).toBeVisible();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${SHOT_DIR}/pageui-panel-light.png` });
    await page.keyboard.press("Escape");
    await expect(panel(page)).toHaveCount(0);
    const focusedLabel = await page.evaluate(() => {
      const host = document.querySelector('[data-dcf-ui="root"]');
      return host?.shadowRoot?.activeElement?.textContent?.trim() ?? null;
    });
    expect(focusedLabel).toBe("Dither");
    expect(errors.messages).toEqual([]);
  });

  test("focus stays inside the panel while tabbing, and the master switch restores the page", async ({ page }) => {
    const errors = await openFixture(page);
    await openPanel(page);
    await expect(panel(page)).toBeVisible();
    for (let step = 0; step < 40; step += 1) await page.keyboard.press("Tab");
    const inside = await page.evaluate(() => {
      const host = document.querySelector('[data-dcf-ui="root"]');
      const active = host?.shadowRoot?.activeElement;
      return active ? Boolean(active.closest("#dcf-settings-panel")) : false;
    });
    expect(inside).toBe(true);

    await page.keyboard.press("Alt+Shift+D");
    await expect(page.locator('[data-dcf-visual="page-background"]')).toHaveCount(0);
    await expect(page.locator('[data-dcf-host]')).toHaveCount(0);
    await expect(panel(page)).toHaveCount(1);
    await page.keyboard.press("Alt+Shift+D");
    await expect(page.locator('[data-dcf-visual="page-background"]')).toHaveCount(1);
    expect(errors.messages).toEqual([]);
  });

  test("adapter switches toggle stand-ins and show match counts", async ({ page }) => {
    const errors = await openFixture(page);
    await openPanel(page);
    await expect(panel(page)).toBeVisible();
    await expect(panel(page).getByText(/matched mounted/).first()).toBeVisible();
    await panel(page).getByRole("switch", { name: "Enable Page background" }).click();
    await expect(page.locator('[data-dcf-host="page-background"]')).toHaveCount(0);
    await panel(page).getByRole("switch", { name: "Enable Page background" }).click();
    await expect(page.locator('[data-dcf-host="page-background"]')).toHaveCount(1);
    expect(errors.messages).toEqual([]);
  });

  test("two quick switch clicks inside one registry poll both take effect", async ({ page }) => {
    // Regression: the switch was controlled by a registry snapshot polled every second, so a second
    // click within that window wrote the stale value back. The control now reads the settings store.
    const errors = await openFixture(page);
    await openPanel(page);
    const toggle = panel(page).getByRole("switch", { name: "Enable Page background" });
    await toggle.click();
    await toggle.click();
    await expect(page.locator('[data-dcf-host="page-background"]')).toHaveCount(1);
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(errors.messages).toEqual([]);
  });

  test("background picker updates the setting and Reset restores defaults", async ({ page }) => {
    const errors = await openFixture(page);
    await openPanel(page);
    await panel(page).getByRole("button", { name: "Dot map" }).click();
    await expect(page.locator('[data-dcf-visual="page-background"]')).toHaveAttribute("data-dcf-bg-id", "dot-map");
    await panel(page).getByRole("button", { name: "Reset" }).click();
    // Reset returns to the defaults, where the page background is off; opting back in shows the default field.
    await expect(page.locator('[data-dcf-host="page-background"]')).toHaveCount(0);
    await setAdapterEnabled(page, "page-background", true);
    await expect(page.locator('[data-dcf-visual="page-background"]')).toHaveAttribute("data-dcf-bg-id", DEFAULT_SETTINGS.background);
    expect(errors.messages).toEqual([]);
  });

  test("dark theme restyles the panel and the page background follows", async ({ page }) => {
    const errors = await openFixture(page);
    await page.getByRole("button", { name: "Dark mode" }).click();
    await openPanel(page);
    await expect(panel(page)).toBeVisible();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${SHOT_DIR}/pageui-panel-dark.png` });
    expect(errors.messages).toEqual([]);
  });

  test("intensity slider changes the background strength without errors", async ({ page }) => {
    const errors = await openFixture(page);
    await setSetting(page, { intensity: 0.2 });
    const opacity = await page.locator('[data-dcf-visual="page-background"]').evaluate((el) => (el.getRootNode() as ShadowRoot).host ? getComputedStyle(el).opacity : "missing");
    // Light theme draws the field as a faint texture: 0.12 of the intensity-driven strength (0.36 * 0.12).
    expect(Number(opacity)).toBeCloseTo(0.0432, 3);
    expect(errors.messages).toEqual([]);
  });
});

test.describe("Dither Lab", () => {
  test("every component file is represented and every tile mounts while scrolling", async ({ page }) => {
    const errors = await openFixture(page);
    await openPanel(page);
    await panel(page).getByRole("button", { name: "Dither Lab" }).click();
    const lab = page.getByRole("dialog", { name: "Dither Lab" });
    await expect(lab).toBeVisible();

    const items = await page.locator("[data-dcf-lab-item]").evaluateAll((els) => els.map((el) => el.getAttribute("data-dcf-lab-item") ?? ""));
    const expected = componentFiles();
    expect([...new Set(items)].sort()).toEqual(expected);

    let maxRunning = 0;
    for (let step = 0; step < 80; step += 1) {
      await page.evaluate(() => {
        const scroller = document.querySelector("[data-dcf-lab-scroll]");
        scroller?.dispatchEvent(new Event("scroll"));
        if (scroller) scroller.scrollTop += scroller.clientHeight;
      });
      await page.waitForTimeout(180);
      maxRunning = Math.max(maxRunning, await runningShaders(page));
      const seen = await page.evaluate(() => document.querySelectorAll('[data-dcf-lab-state="seen"]').length);
      if (seen === items.length) break;
    }
    const unseen = await page.evaluate(() =>
      [...document.querySelectorAll("[data-dcf-lab-item]")]
        .filter((el) => el.getAttribute("data-dcf-lab-state") !== "seen")
        .map((el) => el.getAttribute("data-dcf-lab-item")),
    );
    expect(unseen).toEqual([]);
    expect(maxRunning).toBeLessThanOrEqual(MAX_LIVE_SHADERS);
    await page.screenshot({ path: `${SHOT_DIR}/pageui-lab-light.png` });
    expect(errors.messages).toEqual([]);
  });

  test("Escape leaves the Lab and returns to the panel", async ({ page }) => {
    const errors = await openFixture(page);
    await openPanel(page);
    await panel(page).getByRole("button", { name: "Dither Lab" }).click();
    await expect(page.getByRole("dialog", { name: "Dither Lab" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Dither Lab" })).toHaveCount(0);
    await expect(panel(page)).toBeVisible();
    expect(errors.messages).toEqual([]);
  });
});
