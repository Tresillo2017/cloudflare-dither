import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_SETTINGS } from "../src/core/settings";
import { startFixture, type FixtureServer } from "./helpers/fixture";
import { collectConsoleErrors } from "./helpers/console";
import { domSnapshot } from "./helpers/dom";
import { injectUserscript } from "./helpers/inject";
import { setAdapterEnabled as setAdapterEnabledOnly, setSetting } from "./helpers/settings";

/** Toggles an adapter the way the panel does: setting, then a rescan of existing targets. */
const setAdapterEnabled = async (page: Page, adapterId: string, enabled: boolean): Promise<void> => {
  await setAdapterEnabledOnly(page, adapterId, enabled);
  await page.evaluate(() => {
    const handle = (document as unknown as Record<symbol, { registry: { rescan(): void } }>)[Symbol.for("cloudflare-dither.core")];
    handle?.registry.rescan();
  });
};

/** The page background is off by default (the dashboard keeps its own), so these tests opt in. */
const injectWithBackground = async (page: Page): Promise<void> => {
  await injectUserscript(page, BUNDLE);
  await setAdapterEnabled(page, "page-background", true);
};

const PAGE_HOSTS = '[data-dcf-host^="page-"]';
const BUNDLE = process.env.DCF_BUNDLE ?? "dist/cloudflare-dither.user.js";
const SHOT_DIR = "tests/screenshots";

let fixture: FixtureServer;

test.beforeAll(async () => {
  fixture = await startFixture();
});

test.afterAll(async () => {
  await fixture.stop();
});

/**
 * Visibility-gated stand-ins can take a second scan to mount on a first load. The poll rescans while it waits, so the assertion is on the outcome.
 */
const expectStandInMounted = async (page: Page, adapterId: string): Promise<void> => {
  await expect
    .poll(
      async () => {
        await page.evaluate(() => {
          const handle = (document as unknown as Record<symbol, { registry: { rescan(): void } }>)[Symbol.for("cloudflare-dither.core")];
          handle?.registry.rescan();
        });
        return page.locator(`[data-dcf-host="${adapterId}"]`).count();
      },
      { timeout: 8000, intervals: [500] },
    )
    .toBe(1);
};

const openFixture = async (page: Page, path = "/") => {
  const errors = collectConsoleErrors(page);
  await page.goto(`${fixture.baseUrl}${path}`);
  await page.waitForLoadState("load");
  return errors;
};

/** Counts WebGL canvases inside every dcf shadow root (what a live shader looks like). */
const liveShaderCanvases = (page: Page) =>
  page.evaluate(() => {
    const hosts = [...document.querySelectorAll("[data-dcf-host]")];
    return hosts.reduce((count, host) => {
      const root = host.shadowRoot;
      if (!root) return count;
      return count + root.querySelectorAll("canvas").length;
    }, 0);
  });

test.describe("page background", () => {
  test("is off by default: no background layer and the page keeps its own canvas", async ({ page }) => {
    // Arrange
    const errors = await openFixture(page, "/");
    const bodyBefore = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    // Act
    await injectUserscript(page, BUNDLE);
    await expect(page.locator("[data-dcf-host]").first()).toBeAttached({ timeout: 15_000 });

    // Assert
    await expect(page.locator('[data-dcf-host="page-background"]')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.hasAttribute("data-dcf-bg"))).toBe(false);
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(bodyBefore);
    expect(errors.messages).toEqual([]);
  });

  test("mounts one background behind the app, keeps content interactive, no console errors", async ({ page }) => {
    const errors = await openFixture(page, "/");
    await injectWithBackground(page);
    await expect(page.locator('[data-dcf-host="page-background"]')).toHaveCount(1);
    await expect(page.locator('[data-dcf-host="page-hero"]')).toHaveCount(1);

    const layer = await page.evaluate(() => {
      const host = document.querySelector('[data-dcf-host="page-background"]');
      const root = host?.shadowRoot;
      const visual = root?.querySelector('[data-dcf-visual="page-background"]');
      const style = host ? getComputedStyle(host) : null;
      return {
        visual: visual?.getAttribute("data-dcf-bg-id") ?? null,
        position: style?.position ?? null,
        zIndex: style?.zIndex ?? null,
        inert: host?.hasAttribute("inert") ?? false,
        ariaHidden: host?.getAttribute("aria-hidden") ?? null,
        canvasTranslucent: document.documentElement.getAttribute("data-dcf-bg"),
        bodyBg: getComputedStyle(document.body).backgroundColor,
      };
    });
    expect(layer.visual).toBe(DEFAULT_SETTINGS.background);
    expect(layer.position).toBe("fixed");
    expect(layer.zIndex).toBe("-1");
    expect(layer.inert).toBe(true);
    expect(layer.ariaHidden).toBe("true");
    expect(layer.canvasTranslucent).toBe("on");
    expect(layer.bodyBg).toBe("rgba(0, 0, 0, 0)");

    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SHOT_DIR}/pageui-background-light.png` });
    expect(await liveShaderCanvases(page)).toBeLessThanOrEqual(8);
    const darkToggle = page.getByRole("button", { name: "Dark mode" });
    await expect(darkToggle).toBeVisible();
    await darkToggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-mode", "dark");
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SHOT_DIR}/pageui-background-dark.png` });
    const lightToggle = page.getByRole("button", { name: "Light mode" });
    await expect(lightToggle).toBeVisible();
    await lightToggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-mode", "light");

    expect(errors.messages).toEqual([]);
  });

  test("disabling the adapter restores the page DOM exactly", async ({ page }) => {
    await openFixture(page, "/");
    await injectWithBackground(page);
    await setAdapterEnabled(page, "page-background", false);
    await setAdapterEnabled(page, "page-hero", false);
    await expect(page.locator(PAGE_HOSTS)).toHaveCount(0);
    const baseline = await domSnapshot(page);

    await setAdapterEnabled(page, "page-background", true);
    await expect(page.locator('[data-dcf-host="page-background"]')).toHaveCount(1);
    await setAdapterEnabled(page, "page-background", false);
    await expect(page.locator(PAGE_HOSTS)).toHaveCount(0);
    await expect.poll(() => domSnapshot(page)).toBe(baseline);
  });

  test("each dithercn background id mounts exactly one shader and the page stays clean", async ({ page }) => {
    const errors = await openFixture(page, "/");
    await injectWithBackground(page);
    await setAdapterEnabled(page, "page-hero", false);
    const ids = ["dot-map", "dither-globe", "horizon", "rain", "voronoi"];
    for (const id of ids) {
      await setSetting(page, { background: id });
      await expect(page.locator(`[data-dcf-host="page-background"]`)).toHaveCount(1);
      const shown = await page.evaluate(() => {
        const root = document.querySelector('[data-dcf-host="page-background"]')?.shadowRoot;
        return root?.querySelector("[data-dcf-bg-id]")?.getAttribute("data-dcf-bg-id") ?? null;
      });
      expect(shown).toBe(id);
    }
    expect(errors.messages).toEqual([]);
  });

  test("login route swaps to the hero background and back on SPA navigation", async ({ page }) => {
    const errors = await openFixture(page, "/");
    await injectWithBackground(page);
    await expect(page.locator('[data-dcf-visual="page-background"]')).toHaveCount(1);
    await page.evaluate(() => window.history.pushState({}, "", "/login"));
    await expect(page.locator('[data-dcf-visual="page-hero"]')).toHaveCount(1, { timeout: 4000 });
    await expect(page.locator('[data-dcf-visual="page-background"]')).toHaveCount(0);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SHOT_DIR}/pageui-hero-light.png` });
    const darkToggle = page.getByRole("button", { name: "Dark mode" });
    await expect(darkToggle).toBeVisible();
    await darkToggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-mode", "dark");
    expect(await liveShaderCanvases(page)).toBeLessThanOrEqual(8);
    await page.evaluate(() => window.history.pushState({}, "", "/"));
    await expect(page.locator('[data-dcf-visual="page-background"]')).toHaveCount(1, { timeout: 4000 });
    await expect(page.locator('[data-dcf-visual="page-hero"]')).toHaveCount(0);
    expect(errors.messages).toEqual([]);
  });
});

test.describe("page fade, map and globe", () => {
  test("header fade is off by default and, when enabled, restores the DOM exactly on disable", async ({ page }) => {
    await openFixture(page, "/");
    await injectWithBackground(page);
    await expect(page.locator('[data-dcf-host="page-fade"]')).toHaveCount(0);
    await setAdapterEnabled(page, "page-fade", true);
    await expect(page.locator('[data-dcf-host="page-fade"]')).toHaveCount(1);
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOT_DIR}/pageui-fade-light.png` });
    const baseline = await domSnapshot(page);
    await setAdapterEnabled(page, "page-fade", false);
    await expect(page.locator('[data-dcf-host="page-fade"]')).toHaveCount(0);
    await setAdapterEnabled(page, "page-fade", true);
    await setAdapterEnabled(page, "page-fade", false);
    await expect(page.locator('[data-dcf-host="page-fade"]')).toHaveCount(0);
    await expect.poll(() => domSnapshot(page)).not.toContain('data-dcf-host="page-fade"');
    expect(baseline).toContain('data-dcf-host="page-fade"');
  });

  test("a labelled map widget gets a dot-map stand-in, the original stays clickable, and off restores it", async ({ page }) => {
    const errors = await openFixture(page, "/");
    await page.evaluate(() => {
      const widget = document.createElement("div");
      widget.id = "sample-map";
      widget.setAttribute("role", "img");
      widget.setAttribute("aria-label", "World map of traffic");
      widget.tabIndex = 0;
      widget.style.cssText = "position:relative;width:520px;height:260px;margin:24px;border:1px solid #888;z-index:1;background:#fff;";
      widget.addEventListener("click", () => widget.setAttribute("data-clicked", "yes"));
      document.body.prepend(widget);
    });
    await injectWithBackground(page);
    await setAdapterEnabled(page, "page-map", true);
    await expectStandInMounted(page, "page-map");
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SHOT_DIR}/pageui-map-light.png` });
    await page.locator("#sample-map").click();
    await expect(page.locator("#sample-map")).toHaveAttribute("data-clicked", "yes");
    await setAdapterEnabled(page, "page-map", false);
    await expect(page.locator('[data-dcf-host="page-map"]')).toHaveCount(0);
    await expect(page.locator("#sample-map")).not.toHaveAttribute("data-dcf-hidden", /.*/);
    expect(errors.messages).toEqual([]);
  });

  test("a labelled globe widget gets a dither-globe stand-in and off restores its own footprint", async ({ page }) => {
    const errors = await openFixture(page, "/");
    await page.evaluate(() => {
      const widget = document.createElement("div");
      widget.id = "sample-globe";
      widget.setAttribute("role", "img");
      widget.setAttribute("aria-label", "Globe of edge locations");
      widget.style.cssText = "position:relative;width:300px;height:300px;margin:24px;";
      document.body.prepend(widget);
    });
    await injectWithBackground(page);
    await setAdapterEnabled(page, "page-background", false);
    await setAdapterEnabled(page, "page-hero", false);
    await expect(page.locator(PAGE_HOSTS)).toHaveCount(0);
    const widgetHtml = () => page.locator("#sample-globe").evaluate((el) => el.outerHTML);
    const before = await widgetHtml();

    await setAdapterEnabled(page, "page-globe", true);
    await expectStandInMounted(page, "page-globe");
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SHOT_DIR}/pageui-globe-light.png` });
    await setAdapterEnabled(page, "page-globe", false);
    await expect(page.locator('[data-dcf-host="page-globe"]')).toHaveCount(0);
    await expect.poll(widgetHtml).toBe(before);
    expect(errors.messages).toEqual([]);
  });
});

test.describe("login route", () => {
  test("the hero background mounts on /login with no app background and no console errors", async ({ page }) => {
    const errors = await openFixture(page, "/login");
    await injectWithBackground(page);
    await expect(page.locator('[data-dcf-visual="page-hero"]')).toHaveCount(1);
    await expect(page.locator('[data-dcf-visual="page-background"]')).toHaveCount(0);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SHOT_DIR}/pageui-login-light.png` });
    expect(await liveShaderCanvases(page)).toBeLessThanOrEqual(8);
    expect(errors.messages).toEqual([]);
  });
});
