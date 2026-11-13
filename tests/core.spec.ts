import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  collectConsoleErrors,
  domSnapshot,
  injectUserscript,
  installMiniPage,
  MINI_URL,
  setAdapterEnabled,
  setSetting,
  type CspVariant,
} from "./helpers";

const ROOT = process.cwd();
const DEMO_BUNDLE = "dist/core-demo.user.js";
const PROD_BUNDLE = "dist/cloudflare-dither.user.js";
const VARIANTS: readonly CspVariant[] = ["default", "strict"];

const host = (page: Page, id: string) => page.locator(`[data-dcf-host="${id}"]`);

const openMini = async (page: Page, variant: CspVariant) => {
  await installMiniPage(page, variant);
  await page.goto(MINI_URL);
};

test("production bundle carries no demo adapters", () => {
  const source = readFileSync(resolve(ROOT, PROD_BUNDLE), "utf8");
  expect(source).not.toContain("demo-underlay");
  expect(source).toContain("cloudflare-dither.boot");
});

for (const variant of VARIANTS) {
  test.describe(`csp ${variant}`, () => {
    test("mounts an underlay stand-in, mirrors state, and keeps the original interactive", async ({ page }) => {
      await openMini(page, variant);
      const errors = collectConsoleErrors(page);
      await injectUserscript(page, DEMO_BUNDLE);
      await expect(host(page, "demo-underlay")).toHaveCount(1);
      const visual = page.locator('[data-demo-visual="underlay"]');
      await expect(visual).toHaveAttribute("data-state", "false");
      const background = await visual.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(background).not.toBe("rgba(0, 0, 0, 0)");
      await page.evaluate(() => document.getElementById("switch")!.setAttribute("aria-checked", "true"));
      await expect(visual).toHaveAttribute("data-state", "true");
      await page.locator("#switch").focus();
      expect(await page.evaluate(() => document.activeElement?.id)).toBe("switch");
      expect(errors.messages).toEqual([]);
    });

    test("sibling-replace hides the original, keeps it focusable and clickable, and mirrors its text", async ({ page }) => {
      await openMini(page, variant);
      const errors = collectConsoleErrors(page);
      await page.evaluate(() => {
        (window as unknown as { clicks: number }).clicks = 0;
        document.getElementById("sibling")!.addEventListener("click", () => {
          (window as unknown as { clicks: number }).clicks += 1;
        });
      });
      await injectUserscript(page, DEMO_BUNDLE);
      await expect(host(page, "demo-sibling")).toHaveCount(1);
      await expect(page.locator("#sibling")).toHaveAttribute("data-dcf-hidden", "demo-sibling");
      // The host sits next to its target (before it, since the target is not the first child), never inside it.
      const sibling = await page.evaluate(() => {
        const host = document.querySelector('[data-dcf-host="demo-sibling"]')!;
        return [host.previousElementSibling, host.nextElementSibling].find((node) => node?.id === "sibling")?.id ?? "";
      });
      expect(sibling).toBe("sibling");
      await expect(page.locator('[data-demo-visual="sibling"]')).toContainText("Deploy");
      await page.locator("#sibling").click();
      expect(await page.evaluate(() => (window as unknown as { clicks: number }).clicks)).toBe(1);
      await page.evaluate(() => (document.getElementById("sibling")!.textContent = "Ship"));
      await expect(page.locator('[data-demo-visual="sibling"]')).toContainText("Ship");
      expect(errors.messages).toEqual([]);
    });

    test("re-heals the underlay host after React-style textContent wipes it", async ({ page }) => {
      await openMini(page, variant);
      await injectUserscript(page, DEMO_BUNDLE);
      await expect(page.locator('#switch > [data-dcf-host="demo-underlay"]')).toHaveCount(1);
      await page.evaluate(() => (document.getElementById("switch")!.textContent = "Renamed"));
      await expect(page.locator('#switch > [data-dcf-host="demo-underlay"]')).toHaveCount(1);
    });

    test("disabling the master switch restores the DOM exactly", async ({ page }) => {
      await openMini(page, variant);
      const before = await domSnapshot(page);
      await injectUserscript(page, DEMO_BUNDLE);
      await expect(host(page, "demo-underlay")).toHaveCount(1);
      await setSetting(page, { master: false });
      await expect(page.locator("[data-dcf-host]")).toHaveCount(0);
      expect(await domSnapshot(page)).toBe(before);
    });

    test("disabling one adapter restores its targets exactly", async ({ page }) => {
      await openMini(page, variant);
      const switchBefore = await page.locator("#switch").evaluate((el) => el.outerHTML);
      await injectUserscript(page, DEMO_BUNDLE);
      await expect(host(page, "demo-underlay")).toHaveCount(1);
      await setAdapterEnabled(page, "demo-underlay", false);
      await expect(host(page, "demo-underlay")).toHaveCount(0);
      expect(await page.locator("#switch").evaluate((el) => el.outerHTML)).toBe(switchBefore);
    });

    test("theme flip recolours the stand-in tokens", async ({ page }) => {
      await openMini(page, variant);
      await injectUserscript(page, DEMO_BUNDLE);
      const visual = page.locator('[data-demo-visual="underlay"]');
      await expect(visual).toHaveAttribute("data-theme", "light");
      const light = await visual.evaluate((el) => getComputedStyle(el).getPropertyValue("--background"));
      await page.evaluate(() => document.documentElement.setAttribute("data-mode", "dark"));
      await expect(visual).toHaveAttribute("data-theme", "dark");
      const dark = await visual.evaluate((el) => getComputedStyle(el).getPropertyValue("--background"));
      expect(dark).not.toBe(light);
    });

    test("a throwing adapter is disposed alone and leaves the original visible", async ({ page }) => {
      await openMini(page, variant);
      const errors = collectConsoleErrors(page);
      await injectUserscript(page, DEMO_BUNDLE);
      await expect
        .poll(() => page.evaluate(() => {
          const handle = (document as unknown as Record<symbol, { registry: { errors(): Record<string, string> } }>)[
            Symbol.for("cloudflare-dither.core")
          ];
          return handle?.registry.errors()["demo-boom"] ?? null;
        }))
        .not.toBeNull();
      await expect(host(page, "demo-boom")).toHaveCount(0);
      await expect(page.locator("#boom")).not.toHaveAttribute("data-dcf-underlay", /.*/);
      expect(errors.messages).toEqual([]);
    });

    test("viewport gating mounts off-screen targets only when they scroll in", async ({ page }) => {
      await openMini(page, variant);
      await injectUserscript(page, DEMO_BUNDLE);
      await expect(host(page, "demo-far")).toHaveCount(0);
      await page.evaluate(() => document.getElementById("far")!.scrollIntoView());
      await expect(host(page, "demo-far")).toHaveCount(1);
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(host(page, "demo-far")).toHaveCount(0);
    });

    test("maxInstances caps mounted stand-ins", async ({ page }) => {
      await openMini(page, variant);
      await injectUserscript(page, DEMO_BUNDLE);
      await expect(host(page, "demo-capped")).toHaveCount(2);
      await page.waitForTimeout(300);
      await expect(host(page, "demo-capped")).toHaveCount(2);
    });

    test("a second injection does not double-initialise", async ({ page }) => {
      await openMini(page, variant);
      await injectUserscript(page, DEMO_BUNDLE);
      await injectUserscript(page, DEMO_BUNDLE);
      await expect(host(page, "demo-underlay")).toHaveCount(1);
    });
  });
}

test("strict CSP: component styles never reach React-inserted style elements", async ({ page }) => {
  await openMini(page, "strict");
  const errors = collectConsoleErrors(page);
  await injectUserscript(page, DEMO_BUNDLE);
  await expect(page.locator('[data-demo-visual="sibling"] button')).toHaveCount(1);
  const styleCount = await page.evaluate(() => document.querySelectorAll("style[data-href]").length);
  expect(styleCount).toBe(0);
  expect(errors.messages).toEqual([]);
});
