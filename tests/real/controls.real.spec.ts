import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { collectConsoleErrors, injectUserscript } from "../helpers";

/**
 * Offline replay of the real Cloudflare Workers settings page (owner's private dump, read in place,
 * never copied or quoted). The page has no scripts, so React does not run: this checks that the
 * controls adapters mount on the real markup and paint the intended look. Live verification on
 * dash.cloudflare.com is done separately.
 */
const REAL = resolve(process.cwd(), "real-dom");
const REPLAY_URL = "https://dash.cloudflare.com/__replay/worker-settings.html";
const BUNDLE = process.env.DCF_BUNDLE ?? "dist/cloudflare-dither.user.js";

const openReplay = async (page: Page): Promise<void> => {
  const html = readFileSync(resolve(REAL, "worker-settings-dark.html"), "utf8");
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (url === REPLAY_URL) return route.fulfill({ status: 200, contentType: "text/html", body: html });
    return route.fulfill({ status: 204, body: "" });
  });
  await page.goto(REPLAY_URL, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ path: resolve(REAL, "dash.css") });
  await page.evaluate(() => {
    document.documentElement.classList.add("dark-mode");
    document.documentElement.setAttribute("data-mode", "dark");
  });
};

/** Counts stand-in hosts by adapter id, reading into their shadow roots. */
const mountCounts = (page: Page) =>
  page.evaluate(() => {
    const counts: Record<string, number> = {};
    document.querySelectorAll("[data-dcf-host]").forEach((el) => {
      const id = el.getAttribute("data-dcf-host") ?? "";
      counts[id] = (counts[id] ?? 0) + 1;
    });
    return counts;
  });

test.describe("controls on the real Workers settings markup (offline replay)", () => {
  test("controls adapters mount on the real switches, checkboxes and buttons without console errors", async ({ page }) => {
    await openReplay(page);
    const errors = collectConsoleErrors(page);
    await injectUserscript(page, BUNDLE);
    await expect
      .poll(async () => (await mountCounts(page)).switch ?? 0, { timeout: 8000 })
      .toBeGreaterThan(0);
    const counts = await mountCounts(page);
    const registry = await page.evaluate(() => {
      const core = (document as unknown as Record<symbol, { registry: { list(): { id: string; matched: number; mounted: number; error: string | null }[] } }>)[Symbol.for("cloudflare-dither.core")];
      return core.registry.list().filter((a) => ["button", "switch", "checkbox", "tabs", "select"].includes(a.id));
    });
    expect(registry.every((adapter) => adapter.error === null)).toBe(true);
    expect(counts.button ?? 0).toBeGreaterThan(0);
    expect(errors.messages).toEqual([]);
  });

  test("plain button stand-ins on the real page carry no dashed mask", async ({ page }) => {
    await openReplay(page);
    await injectUserscript(page, BUNDLE);
    await expect.poll(async () => (await mountCounts(page)).button ?? 0, { timeout: 8000 }).toBeGreaterThan(0);
    const dashed = await page.evaluate(() => {
      let found = 0;
      document.querySelectorAll("[data-dcf-host='button']").forEach((host) => {
        const plain = host.shadowRoot?.querySelector('[data-dcf-visual="plain"]');
        if (plain && getComputedStyle(plain).maskComposite === "exclude") found += 1;
      });
      return found;
    });
    expect(dashed).toBe(0);
  });

  test("checkbox stand-ins mount once the real checkboxes scroll into view, and paint brand blue when checked", async ({ page }) => {
    await openReplay(page);
    await injectUserscript(page, BUNDLE);
    await page.evaluate(() => {
      const box = document.querySelector('[role="checkbox"]');
      box?.scrollIntoView({ block: "center" });
      window.dispatchEvent(new Event("scroll"));
    });
    await expect.poll(async () => (await mountCounts(page))["checkbox"] ?? 0, { timeout: 8000 }).toBeGreaterThan(0);
    const fill = await page.evaluate(() => {
      const host = document.querySelector("[data-dcf-host='checkbox']");
      const on = host?.shadowRoot?.querySelector('[data-dcf-visual="checkbox-on"] > div');
      return on ? getComputedStyle(on).backgroundColor : null;
    });
    expect(fill).toMatch(/^(oklch|rgb)/);
  });
});
