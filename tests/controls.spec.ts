import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  collectConsoleErrors,
  domSnapshot,
  injectUserscript,
  setAdapterEnabled,
  startFixture,
  type FixtureServer,
} from "./helpers";

const BUNDLE = process.env.DCF_BUNDLE ?? "dist/cloudflare-dither.user.js";
const SHOTS = resolve(process.cwd(), "tests/screenshots");

let fixture: FixtureServer;

test.beforeAll(async () => {
  mkdirSync(SHOTS, { recursive: true });
  fixture = await startFixture();
});

test.afterAll(async () => {
  await fixture?.stop();
});

const openHome = async (page: Page) => {
  await page.goto(`${fixture.baseUrl}/`);
  await page.waitForLoadState("networkidle");
};

/** Sibling-replace stand-ins sit next to their target (before it, or after it when it is the first child), never inside it. */
const siblingHost = (target: Locator, id: string): Locator =>
  target.locator(`xpath=preceding-sibling::*[1][@data-dcf-host="${id}"] | following-sibling::*[1][@data-dcf-host="${id}"]`);

/** Stand-ins mount only near the viewport, so scroll the original target first. */
const reveal = (locator: Locator) => locator.scrollIntoViewIfNeeded();

const setMode = (page: Page, mode: "light" | "dark") =>
  page.evaluate((next) => document.documentElement.setAttribute("data-mode", next), mode);

test.describe("controls adapters on the fixture dashboard", () => {
  test("plain button stand-ins paint one solid rim on all four sides, never a dashed mask", async ({ page }) => {
    await openHome(page);
    await injectUserscript(page, BUNDLE);
    const outline = page.getByRole("button", { name: "outline base", exact: true });
    await reveal(outline);
    const plain = outline.locator('[data-dcf-host="button"] [data-dcf-visual="plain"]');
    await expect(plain).toBeAttached();
    const style = await plain.evaluate((el) => {
      const computed = getComputedStyle(el);
      return { boxShadow: computed.boxShadow, maskComposite: computed.maskComposite, opacity: computed.opacity };
    });
    expect(style.boxShadow).toContain("inset");
    expect(style.maskComposite).not.toBe("exclude");
    expect(style.opacity).toBe("1");
  });

  test("filled button stand-ins keep their full dithered fill", async ({ page }) => {
    await openHome(page);
    await injectUserscript(page, BUNDLE);
    const primary = page.getByRole("button", { name: "primary base", exact: true });
    await reveal(primary);
    const fill = primary.locator('[data-dcf-host="button"] [data-dcf-visual="fill"]');
    await expect(fill).toBeAttached();
    const composite = await fill.evaluate((el) => getComputedStyle(el).maskComposite);
    expect(composite === "" || composite === "none" || composite === "add").toBe(true);
  });

  test("button stand-ins mount on Kumo buttons, the label stays clickable, and clicks update the page", async ({ page }) => {
    await openHome(page);
    const errors = collectConsoleErrors(page);
    await injectUserscript(page, BUNDLE);
    const primary = page.getByRole("button", { name: "primary xs", exact: true });
    await reveal(primary);
    await expect(primary.locator('[data-dcf-host="button"]')).toHaveCount(1);
    await expect(primary).toBeEnabled();
    await primary.click();
    await expect(page.getByTestId("click-count")).toHaveText("Clicks: 1");
    await expect(primary).toHaveAttribute("data-dcf-underlay", "button");

    await page.screenshot({ path: resolve(SHOTS, "controls-buttons-light.png") });
    await setMode(page, "dark");
    await expect(primary.locator('[data-dcf-host="button"] [data-dcf-visual="fill"]')).toBeAttached();
    await page.screenshot({ path: resolve(SHOTS, "controls-buttons-dark.png") });
    await setMode(page, "light");
    expect(errors.messages).toEqual([]);
  });

  test("disabled buttons dim their stand-in", async ({ page }) => {
    await openHome(page);
    await injectUserscript(page, BUNDLE);
    const disabled = page.locator('button[disabled][data-kumo-component="Button"]').first();
    await reveal(disabled);
    await expect(disabled.locator('[data-dcf-host="button"]')).toHaveCount(1);
    const opacity = await disabled
      .locator('[data-dcf-host="button"] [data-dcf-visual="fill"]')
      .evaluate((el) => Number(getComputedStyle(el).opacity));
    expect(opacity).toBeCloseTo(0.45, 2);
  });

  test("switch stand-in mirrors aria-checked after a real click on the original", async ({ page }) => {
    await openHome(page);
    const errors = collectConsoleErrors(page);
    await injectUserscript(page, BUNDLE);
    const toggle = page.getByRole("switch", { name: "Auto-renew" });
    await reveal(toggle);
    const stand = toggle.locator('[data-dcf-host="switch"] [role="switch"]');
    await expect(stand).toHaveAttribute("data-state", "checked");
    await toggle.click();
    await expect(page.getByTestId("auto-renew-state")).toHaveText("Auto-renew is off");
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(stand).toHaveAttribute("data-state", "unchecked");
    await toggle.screenshot({ path: resolve(SHOTS, "controls-switch-light.png") });
    expect(errors.messages).toEqual([]);
  });

  test("disabled switch stand-in mirrors its checked state and the original stays disabled", async ({ page }) => {
    await openHome(page);
    await injectUserscript(page, BUNDLE);
    const disabled = page.getByRole("switch", { name: "Disabled switch (on)" });
    await reveal(disabled);
    await expect(disabled.locator('[data-dcf-host="switch"] [role="switch"]')).toHaveAttribute("data-state", "checked");
    await expect(disabled.locator('[data-dcf-host="switch"] [role="switch"]')).toBeDisabled();
    await expect(disabled).toBeDisabled();
  });

  test("native range stand-in mirrors the value after keyboard input on the original", async ({ page }) => {
    await openHome(page);
    const errors = collectConsoleErrors(page);
    await injectUserscript(page, BUNDLE);
    const nativeIndex = await page.evaluate(() =>
      Array.from(document.querySelectorAll('input[type="range"]')).findIndex((el) => !el.closest('[data-orientation]')),
    );
    expect(nativeIndex).toBeGreaterThanOrEqual(0);
    const range = page.locator('input[type="range"]').nth(nativeIndex);
    await reveal(range);
    const thumb = siblingHost(range, "slider").locator('[role="slider"]').first();
    await expect(thumb).toHaveAttribute("aria-valuenow", "25");
    await range.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(range).toHaveValue("27");
    await expect(thumb).toHaveAttribute("aria-valuenow", "27");
    expect(errors.messages).toEqual([]);
  });

  test("Base UI slider wrapper is left alone: its own thumb stays visible and usable", async ({ page }) => {
    // The wrapper holds the original thumb and input. An opacity overlay on it would hide those
    // controls while they stay clickable, so the slider adapter refuses the wrapper (core/interactive.ts).
    await openHome(page);
    const errors = collectConsoleErrors(page);
    await injectUserscript(page, BUNDLE);
    const thumb = page.getByRole("slider", { name: "Rate limit" });
    await reveal(thumb);
    const root = page.locator("[data-orientation]").filter({ has: thumb }).first();
    await expect(root).not.toHaveAttribute("data-dcf-hidden", "slider");
    const hasSliderOverlay = await root.evaluate((el) =>
      [el.previousElementSibling, el.nextElementSibling].some((node) => node?.getAttribute("data-dcf-host") === "slider"),
    );
    expect(hasSliderOverlay).toBe(false);
    expect(await thumb.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    const before = Number(await thumb.getAttribute("aria-valuenow"));
    await thumb.focus();
    await page.keyboard.press("ArrowRight");
    await expect(thumb).toHaveAttribute("aria-valuenow", String(before + 1));
    expect(errors.messages).toEqual([]);
  });

  test("tabs stand-in pill sits under the selected tab and follows a click", async ({ page }) => {
    await openHome(page);
    const errors = collectConsoleErrors(page);
    await injectUserscript(page, BUNDLE);
    // Tabs are off by default (the real dashboard draws its own opaque pill), so opt in here.
    await setAdapterEnabled(page, "tabs", true);
    const tablist = page.getByRole("tablist").first();
    await reveal(tablist);
    const tabs = tablist.getByRole("tab");
    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    const pill = tablist.locator('[data-dcf-host="tabs"] [data-dcf-visual="tab-pill"]');
    await expect(pill).toHaveCount(1);
    const aligned = await pill.evaluate(
      (el, tabEl) => {
        const p = el.getBoundingClientRect();
        const t = tabEl.getBoundingClientRect();
        return Math.abs(p.left - t.left) < 3 && Math.abs(p.width - t.width) < 3;
      },
      await tabs.nth(1).elementHandle(),
    );
    expect(aligned).toBe(true);
    // The selected tab carries the owned marker; the one it replaced is released exactly.
    await expect(tabs.nth(1)).toHaveAttribute("data-dcf-tab-selected", "tabs");
    await expect(tabs.nth(0)).not.toHaveAttribute("data-dcf-tab-selected");
    await tablist.screenshot({ path: resolve(SHOTS, "controls-tabs-light.png") });
    expect(errors.messages).toEqual([]);
  });

  test("dropzone stand-in mounts, file selection still works on the original input, and drag-over lights the zone", async ({ page }) => {
    await openHome(page);
    const errors = collectConsoleErrors(page);
    await injectUserscript(page, BUNDLE);
    const zone = page.getByTestId("dropzone");
    await reveal(zone);
    const standZone = zone.locator('[data-dcf-host="dropzone"]').locator(".dcn-drop");
    await expect(standZone).toHaveCount(1);
    await expect(standZone).toHaveAttribute("data-state", "idle");

    await zone.evaluate((el) => el.dispatchEvent(new DragEvent("dragenter", { bubbles: true })));
    await expect(standZone).toHaveAttribute("data-state", "active");
    await zone.evaluate((el) => el.dispatchEvent(new DragEvent("dragleave", { bubbles: true })));
    await expect(standZone).toHaveAttribute("data-state", "idle");

    await page.locator('input[type="file"][aria-label="Certificate file"]').setInputFiles({
      name: "cert.pem",
      mimeType: "application/x-pem-file",
      buffer: Buffer.from("-----BEGIN CERTIFICATE-----"),
    });
    await expect(page.getByTestId("upload-name")).toHaveText("Selected: cert.pem");
    await zone.screenshot({ path: resolve(SHOTS, "controls-dropzone-light.png") });
    expect(errors.messages).toEqual([]);
  });

  test("disabling every stand-in restores the DOM exactly", async ({ page }) => {
    await openHome(page);
    const before = await domSnapshot(page);
    await injectUserscript(page, BUNDLE);
    await setAdapterEnabled(page, "tabs", true);
    // Each control is mounted while it is in view, and disposed when it scrolls away.
    const buttonTarget = page.getByRole("button", { name: "primary xs", exact: true });
    const switchTarget = page.getByRole("switch", { name: "Auto-renew" });
    const tablist = page.getByRole("tablist").first();
    const zone = page.getByTestId("dropzone");
    const hostIds = () =>
      page.evaluate(() =>
        Array.from(new Set(Array.from(document.querySelectorAll("[data-dcf-host]"), (h) => h.getAttribute("data-dcf-host")))),
      );
    // Stand-ins leave when they scroll away, so collect ids while each one is still mounted.
    const seen = new Set<string>();
    const collect = async (): Promise<void> => {
      for (const id of await hostIds()) seen.add(id ?? "");
    };
    await reveal(buttonTarget);
    await expect(buttonTarget.locator('[data-dcf-host="button"]')).toHaveCount(1, { timeout: 15_000 });
    await collect();
    await reveal(switchTarget);
    await expect(switchTarget.locator('[data-dcf-host="switch"]')).toHaveCount(1, { timeout: 15_000 });
    await collect();
    await reveal(tablist);
    await expect(tablist.locator('[data-dcf-host="tabs"]')).toHaveCount(1, { timeout: 15_000 });
    await collect();
    await reveal(zone);
    await expect(zone.locator('[data-dcf-host="dropzone"]')).toHaveCount(1, { timeout: 15_000 });
    await collect();
    const ids = [...seen];
    expect(ids).toEqual(expect.arrayContaining(["button", "switch", "tabs", "dropzone"]));
    for (const id of ids) {
      await setAdapterEnabled(page, id ?? "", false);
    }
    await expect(page.locator("[data-dcf-host]")).toHaveCount(0);
    expect(await domSnapshot(page)).toBe(before);
  });
});

test.describe("controls adapters under strict CSP", () => {
  test("stand-ins mount and the page keeps its controls working", async ({ page }) => {
    await page.goto(`${fixture.baseUrl}/?csp=strict`);
    await page.waitForLoadState("networkidle");
    const errors = collectConsoleErrors(page);
    await injectUserscript(page, BUNDLE);
    const toggle = page.getByRole("switch", { name: "Email notifications" });
    await reveal(toggle);
    await expect(toggle.locator('[data-dcf-host="switch"]')).toHaveCount(1);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    const strictErrors = errors.messages.filter((message) => !message.includes("Content Security Policy"));
    expect(strictErrors).toEqual([]);
  });
});
