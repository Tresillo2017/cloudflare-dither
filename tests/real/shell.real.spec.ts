import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

import { collectConsoleErrors, injectUserscript, setAdapterEnabled } from "../helpers";

/**
 * Offline replay of the real account home (sidebar, header, column lists, title). The page is a
 * saved DOM dump (real-dom/, private, gitignored): no scripts, the stylesheet inlined. Nothing
 * from the account is read back into the assertions.
 */
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const DUMP = resolve(ROOT, "real-dom/home-dark.html");
const STYLES = resolve(ROOT, "real-dom/dash.css");
const PAGE_URL = "https://dash.cloudflare.com/replay/home";
const MOUNT_POLL = { timeout: 10_000 };
const LIST_ROW_SELECTOR = '[data-sentry-component="ShortcutColumnFrame"] li';
const HAVE_DUMP = existsSync(DUMP) && existsSync(STYLES);

const hosts = (page: Page, adapterId: string) => page.locator(`[data-dcf-host="${adapterId}"]`);

const openHome = async (page: Page): Promise<void> => {
  const html = readFileSync(DUMP, "utf8");
  const css = readFileSync(STYLES, "utf8");
  const body = html.replace("</head>", `<style>${css}</style></head>`);
  await page.route(PAGE_URL, (route) => route.fulfill({ contentType: "text/html", body }));
  await page.goto(PAGE_URL, { waitUntil: "domcontentloaded" });
};

test.describe("account home shell (real DOM replay)", () => {
  test.skip(!HAVE_DUMP, "real-dom/home-dark.html and dash.css are private and not present");

  test("shell stand-ins mount on the real DOM and every original stays in place", async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await openHome(page);
    await injectUserscript(page, process.env.DCF_BUNDLE);

    await expect.poll(() => hosts(page, "sidebar-active").count(), MOUNT_POLL).toBeGreaterThanOrEqual(1);
    await expect.poll(() => hosts(page, "sidebar-switcher").count(), MOUNT_POLL).toBe(1);
    await expect.poll(() => hosts(page, "badge").count(), MOUNT_POLL).toBeGreaterThanOrEqual(3);
    await expect.poll(() => hosts(page, "list-head").count(), MOUNT_POLL).toBe(3);
    await expect.poll(() => hosts(page, "list-row").count(), MOUNT_POLL).toBeGreaterThanOrEqual(10);
    await expect.poll(() => hosts(page, "header-band").count(), MOUNT_POLL).toBe(1);
    await expect.poll(() => hosts(page, "title-h1").count(), MOUNT_POLL).toBe(1);

    // Originals are untouched: the heading is still visible text and the row links still exist.
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page.locator("h1").first()).not.toHaveAttribute("data-dcf-hidden", "title-h1");
    await expect(page.locator(`${LIST_ROW_SELECTOR} a`).first()).toHaveAttribute("href", /.+/);
    await expect(hosts(page, "list-row").first()).toHaveAttribute("aria-hidden", "true");
    expect(errors.messages).toEqual([]);
  });

  test("hovering a column row or a sidebar item paints the dithered band", async ({ page }) => {
    await openHome(page);
    await injectUserscript(page, process.env.DCF_BUNDLE);
    await expect.poll(() => hosts(page, "list-row").count(), MOUNT_POLL).toBeGreaterThanOrEqual(10);

    const row = page.locator(LIST_ROW_SELECTOR).nth(1);
    await row.hover();
    await expect
      .poll(() => row.evaluate((el) => el.querySelector('[data-dcf-host="list-row"]')?.shadowRoot?.querySelector('[data-hover="true"]') != null))
      .toBe(true);

    const item = page.locator('[data-sidebar="menu-button"]').nth(2);
    await item.hover();
    await expect
      .poll(() => item.evaluate((el) => el.querySelector('[data-dcf-host="sidebar-active"]')?.shadowRoot?.querySelector('[data-dcf-visual="sidebar-item"]') != null))
      .toBe(true);
  });

  test("disabling the list-row adapter restores the column exactly", async ({ page }) => {
    await openHome(page);
    await injectUserscript(page, process.env.DCF_BUNDLE);
    await expect.poll(() => hosts(page, "list-row").count(), MOUNT_POLL).toBeGreaterThanOrEqual(10);
    await setAdapterEnabled(page, "list-row", false);
    await expect(hosts(page, "list-row")).toHaveCount(0);
    const column = page.locator('[data-sentry-component="ShortcutColumnFrame"]').first();
    const before = await column.evaluate((el) => el.outerHTML);

    await setAdapterEnabled(page, "list-row", true);
    await expect.poll(() => hosts(page, "list-row").count(), MOUNT_POLL).toBeGreaterThanOrEqual(10);
    await setAdapterEnabled(page, "list-row", false);
    await expect(hosts(page, "list-row")).toHaveCount(0);
    expect(await column.evaluate((el) => el.outerHTML)).toBe(before);
  });
});
