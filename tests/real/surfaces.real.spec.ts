import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, test, type Page } from "@playwright/test";

import { collectConsoleErrors, injectUserscript, setAdapterEnabled } from "../helpers";

/**
 * Offline replay of real dashboard pages (private dumps in real-dom/, never quoted here).
 * The HTML is served with page.route under the real origin, dash.css is served as the shared
 * stylesheet, and the bundle is injected after load the way a userscript manager does.
 * Only surface stand-ins are asserted: counts, rim geometry and exact restore.
 */
const REAL_DOM = fileURLToPath(new URL("../../real-dom/", import.meta.url));
const ORIGIN = "https://dash.cloudflare.com";
const DNS_PATH = "/account/example.com/dns/records";
const SETTINGS_PATH = "/account/workers/services/view/example/production/settings";

const readDump = (name: string): string => readFileSync(`${REAL_DOM}${name}`, "utf8");

/** Serves one real dump as the page at `path`, with the shared stylesheet and a dark theme. */
const serveDump = async (page: Page, dump: string, path: string): Promise<void> => {
  const css = readDump("dash.css");
  const html = readDump(dump).replace("<head>", `<head><link rel="stylesheet" href="${ORIGIN}/dash.css">`);
  await page.route(`${ORIGIN}/dash.css`, (route) => route.fulfill({ contentType: "text/css", body: css }));
  await page.route(`${ORIGIN}${path}`, (route) => route.fulfill({ contentType: "text/html", body: html }));
  await page.goto(`${ORIGIN}${path}`);
};

const forceDark = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    document.documentElement.classList.add("dark-mode");
    document.documentElement.setAttribute("data-mode", "dark");
  });
};

const hostCount = (page: Page, id: string): Promise<number> =>
  page.evaluate((hostId) => document.querySelectorAll(`[data-dcf-host="${hostId}"]`).length, id);

test.describe("surface stand-ins on the real DNS page (offline replay)", () => {
  test("table header, row and card stand-ins mount and restore exactly", async ({ page }) => {
    await serveDump(page, "dns-dark.html", DNS_PATH);
    await forceDark(page);
    const errors = collectConsoleErrors(page);
    await injectUserscript(page);

    await expect.poll(() => hostCount(page, "table-head")).toBeGreaterThan(0);
    await expect.poll(() => hostCount(page, "table-row")).toBeGreaterThan(0);
    await expect.poll(() => hostCount(page, "card")).toBeGreaterThan(0);

    // The originals stay in the DOM: the ARIA table and its header are still there and focusable.
    await expect(page.locator('[role="table"]')).toHaveCount(1);
    await expect(page.locator('[role="columnheader"]').first()).toBeVisible();

    await setAdapterEnabled(page, "table-row", false);
    await expect.poll(() => hostCount(page, "table-row")).toBe(0);
    await setAdapterEnabled(page, "table-head", false);
    await expect.poll(() => hostCount(page, "table-head")).toBe(0);
    expect(errors.messages).toEqual([]);
  });

  test("every card rim is one solid hairline on all four sides with a single bottom shade", async ({ page }) => {
    await serveDump(page, "dns-dark.html", DNS_PATH);
    await forceDark(page);
    await injectUserscript(page);
    await expect.poll(() => hostCount(page, "card")).toBeGreaterThan(0);

    const rims = await page.evaluate(() => {
      const hosts = Array.from(document.querySelectorAll<HTMLElement>('[data-dcf-host="card"]'));
      return hosts.map((host) => {
        const card = host.shadowRoot?.querySelector<HTMLElement>('[data-dcf-visual="card"]');
        const line = card?.querySelector<HTMLElement>('[data-dcf-visual="rim-line"]');
        if (!card || !line) return null;
        return {
          falloffs: card.querySelectorAll('[data-dcf-visual="rim-falloff"]').length,
          // The hairline is an inset ring, so it is the same on every side by construction.
          ring: getComputedStyle(line).boxShadow,
        };
      });
    });
    const present = rims.filter((rim): rim is { falloffs: number; ring: string } => rim !== null);
    expect(present.length).toBeGreaterThan(0);
    for (const rim of present) {
      expect(rim.falloffs).toBe(1);
      expect(rim.ring).toMatch(/inset/);
      expect(rim.ring).toMatch(/0px 0px 0px 1px/);
    }
  });
});

test.describe("surface stand-ins on the real Worker settings page (offline replay)", () => {
  test("settings tables and toolbars get stand-ins without touching the originals", async ({ page }) => {
    await serveDump(page, "worker-settings-dark.html", SETTINGS_PATH);
    await forceDark(page);
    await injectUserscript(page);

    await expect.poll(() => hostCount(page, "toolbar")).toBeGreaterThan(0);
    await expect.poll(() => hostCount(page, "card")).toBeGreaterThan(0);
    await expect(page.locator("table")).not.toHaveCount(0);
    await expect(page.locator('[role="toolbar"]').first()).toBeVisible();
  });
});
