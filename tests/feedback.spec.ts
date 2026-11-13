import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  collectConsoleErrors,
  injectUserscript,
  setAdapterEnabled,
  startFixture,
  type FixtureServer,
} from "./helpers";

const ROOT = process.cwd();
const BUNDLE = process.env.DCF_BUNDLE ?? "dist/cloudflare-dither.user.js";
const SHOTS = resolve(ROOT, "tests/screenshots");
const CORE_KEY = "cloudflare-dither.core";

interface CoreHandle {
  registry: { list(): { id: string; group: string }[] };
  settings: { setAdapterEnabled(id: string, enabled: boolean): void };
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

let fixture: FixtureServer;

test.beforeAll(async () => {
  fixture = await startFixture();
});

test.afterAll(async () => {
  await fixture.stop();
});

const host = (page: Page, id: string): Locator => page.locator(`[data-dcf-host="${id}"]`);

/** Injects the private bundle and turns off every adapter, so only the one a test enables mutates the page. */
const isolate = async (page: Page): Promise<void> => {
  await injectUserscript(page, BUNDLE);
  await page.evaluate((key) => {
    const handle = (document as unknown as Record<symbol, CoreHandle>)[Symbol.for(key)];
    if (!handle) throw new Error("core handle missing");
    for (const adapter of handle.registry.list()) handle.settings.setAdapterEnabled(adapter.id, false);
  }, CORE_KEY);
  await settle(page);
};

/** Lets layout, the core's scan and React effects finish before a measurement or snapshot. */
const settle = (page: Page): Promise<void> => page.waitForTimeout(400);

/** Isolates the feedback group, then enables one adapter. */
const mountAdapter = async (page: Page, id: string): Promise<void> => {
  await isolate(page);
  await setAdapterEnabled(page, id, true);
};

const setMode = (page: Page, mode: "light" | "dark"): Promise<void> =>
  page.evaluate((next) => document.documentElement.setAttribute("data-mode", next), mode);

const boxOf = (page: Page, selector: string): Promise<Box> =>
  page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) throw new Error(`no element for ${sel}`);
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }, selector);

const expectNoShift = (before: Box, after: Box): void => {
  expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.width - before.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.height - before.height)).toBeLessThanOrEqual(1);
};

/** Serialised block around a target (its parent), used for exact-restore checks. */
const regionHtml = (page: Page, selector: string): Promise<string> =>
  page.evaluate((sel) => document.querySelector(sel)!.parentElement!.outerHTML, selector);

const shoot = async (locator: Locator, name: string): Promise<void> => {
  mkdirSync(SHOTS, { recursive: true });
  await locator.screenshot({ path: resolve(SHOTS, `${name}.png`) });
};

/** Count of painted (non-transparent) pixels in a stand-in's shadow-root canvas. */
const shadowCanvasInk = (page: Page, id: string): Promise<number> =>
  page.evaluate((hostId) => {
    const hostEl = document.querySelector(`[data-dcf-host="${hostId}"]`);
    const canvas = hostEl?.shadowRoot?.querySelector("canvas");
    if (!canvas || canvas.width === 0 || canvas.height === 0) return 0;
    const data = canvas.getContext("2d")?.getImageData(0, 0, canvas.width, canvas.height).data;
    if (!data) return 0;
    let ink = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) ink += 1;
    return ink;
  }, id);

/** Rendered box of a stand-in host, for "mounted and sized" checks. */
const hostBox = (page: Page, id: string): Promise<Box> =>
  host(page, id).first().evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });

const LOADING_SWITCH = { name: "Simulate loading" };

test.describe("progress (native <progress>)", () => {
  const STORAGE = 'progress[aria-label="Storage usage"]';
  const LABEL = 'p:has(+ progress[aria-label="Storage usage"])';

  test("overlays a dithered bar with the same value, keeps the original, mirrors changes", async ({ page }) => {
    await page.goto(`${fixture.baseUrl}/`);
    await page.locator(STORAGE).scrollIntoViewIfNeeded();
    const errors = collectConsoleErrors(page);
    await mountAdapter(page, "progress-native");
    await expect(host(page, "progress-native")).toHaveCount(1);
    await expect(page.locator(STORAGE)).toHaveAttribute("data-dcf-hidden", "progress-native");

    const bar = page.locator('[data-dcf-visual="progress"] [role="progressbar"]');
    await expect(bar).toHaveAttribute("aria-valuenow", "40");
    await page.evaluate((sel) => {
      (document.querySelector(sel) as HTMLProgressElement).value = 75;
    }, STORAGE);
    await expect(bar).toHaveAttribute("aria-valuenow", "75");
    expect(await page.locator(STORAGE).getAttribute("value")).toBe("75");
    expect(errors.messages).toEqual([]);
  });

  test("inline <progress> shifts and the overlay sits below the bar", async ({ page }) => {
    await page.goto(`${fixture.baseUrl}/`);
    await page.locator(STORAGE).scrollIntoViewIfNeeded();
    await isolate(page);
    const barBefore = await boxOf(page, STORAGE);
    await setAdapterEnabled(page, "progress-native", true);
    await expect(host(page, "progress-native")).toHaveCount(1);
    await settle(page);
    expectNoShift(barBefore, await boxOf(page, STORAGE));
    expectNoShift(barBefore, await hostBox(page, "progress-native"));
  });

  test("stand-in is sized and screenshotted in light and dark", async ({ page }) => {
    await page.goto(`${fixture.baseUrl}/`);
    await page.locator(STORAGE).scrollIntoViewIfNeeded();
    await mountAdapter(page, "progress-native");
    const block = page.locator(STORAGE).locator("xpath=..");
    for (const mode of ["light", "dark"] as const) {
      await setMode(page, mode);
      await page.waitForTimeout(150);
      await shoot(block, `feedback-progress-${mode}`);
    }
    const size = await hostBox(page, "progress-native");
    expect(size.width).toBeGreaterThan(20);
    expect(size.height).toBeGreaterThan(4);
  });

  test("disabling the adapter restores the region exactly", async ({ page }) => {
    await page.goto(`${fixture.baseUrl}/`);
    await page.locator(STORAGE).scrollIntoViewIfNeeded();
    await isolate(page);
    const original = await regionHtml(page, STORAGE);
    await setAdapterEnabled(page, "progress-native", true);
    await expect(host(page, "progress-native")).toHaveCount(1);
    await setAdapterEnabled(page, "progress-native", false);
    await expect(host(page, "progress-native")).toHaveCount(0);
    expect(await regionHtml(page, STORAGE)).toBe(original);
  });
});

test.describe("loader (Kumo spinner)", () => {
  const SPINNER = '[data-testid="loading-state"] svg[role="status"]';

  test("replaces the spinner with a dithered loader, the switch still toggles it", async ({ page }) => {
    await page.goto(`${fixture.baseUrl}/`);
    await page.getByRole("switch", LOADING_SWITCH).click();
    await page.locator(SPINNER).scrollIntoViewIfNeeded();
    const errors = collectConsoleErrors(page);
    await mountAdapter(page, "loader-kumo");
    await expect(host(page, "loader-kumo")).toHaveCount(1);
    await expect(page.locator(SPINNER)).toHaveAttribute("data-dcf-hidden", "loader-kumo");
    await expect(page.locator(SPINNER)).toHaveAttribute("role", "status");
    await expect.poll(() => shadowCanvasInk(page, "loader-kumo")).toBeGreaterThan(0);

    await page.getByRole("switch", LOADING_SWITCH).click();
    await expect(host(page, "loader-kumo")).toHaveCount(0);
    await page.getByRole("switch", LOADING_SWITCH).click();
    await expect(host(page, "loader-kumo")).toHaveCount(1);
    expect(errors.messages).toEqual([]);
  });

  test("stand-in matches the original box, screenshotted in light and dark", async ({ page }) => {
    await page.goto(`${fixture.baseUrl}/`);
    await page.getByRole("switch", LOADING_SWITCH).click();
    await page.locator(SPINNER).scrollIntoViewIfNeeded();
    const original = await boxOf(page, SPINNER);
    await mountAdapter(page, "loader-kumo");
    await expect(host(page, "loader-kumo")).toHaveCount(1);
    const stand = await hostBox(page, "loader-kumo");
    expect(Math.abs(stand.width - original.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(stand.height - original.height)).toBeLessThanOrEqual(1);
    const block = page.locator('[data-testid="loading-state"]');
    for (const mode of ["light", "dark"] as const) {
      await setMode(page, mode);
      await page.waitForTimeout(200);
      await shoot(block, `feedback-loader-${mode}`);
    }
  });

  test("the skeleton beside the spinner moves when the loader mounts", async ({ page }) => {
    await page.goto(`${fixture.baseUrl}/`);
    await page.getByRole("switch", LOADING_SWITCH).click();
    await page.locator(SPINNER).scrollIntoViewIfNeeded();
    await isolate(page);
    const neighbour = '[data-testid="loading-state"] .skeleton-line';
    const before = await boxOf(page, neighbour);
    await setAdapterEnabled(page, "loader-kumo", true);
    await expect(host(page, "loader-kumo")).toHaveCount(1);
    await settle(page);
    expectNoShift(before, await boxOf(page, neighbour));
  });

  test("disabling the adapter restores the region exactly", async ({ page }) => {
    await page.goto(`${fixture.baseUrl}/`);
    await page.getByRole("switch", LOADING_SWITCH).click();
    await page.locator(SPINNER).scrollIntoViewIfNeeded();
    await isolate(page);
    const original = await regionHtml(page, SPINNER);
    await setAdapterEnabled(page, "loader-kumo", true);
    await expect(host(page, "loader-kumo")).toHaveCount(1);
    await setAdapterEnabled(page, "loader-kumo", false);
    await expect(host(page, "loader-kumo")).toHaveCount(0);
    expect(await regionHtml(page, SPINNER)).toBe(original);
  });
});

test.describe("skeleton lines", () => {
  const LINE = '[data-testid="loading-state"] .skeleton-line';

  test("mounts a dithered skeleton in each line without moving the layout", async ({ page }) => {
    await page.goto(`${fixture.baseUrl}/`);
    await page.getByRole("switch", LOADING_SWITCH).click();
    await page.locator(LINE).first().scrollIntoViewIfNeeded();
    const errors = collectConsoleErrors(page);
    await isolate(page);
    const before = await boxOf(page, LINE);
    await setAdapterEnabled(page, "skeleton-line", true);
    await expect(host(page, "skeleton-line")).toHaveCount(3);
    await expect(page.locator(LINE).first()).toHaveAttribute("data-dcf-underlay", "skeleton-line");
    expectNoShift(before, await boxOf(page, LINE));
    const stand = await hostBox(page, "skeleton-line");
    expect(stand.width).toBeGreaterThan(20);
    expect(stand.height).toBeGreaterThan(4);

    await page.getByRole("switch", LOADING_SWITCH).click();
    await expect(host(page, "skeleton-line")).toHaveCount(0);
    expect(errors.messages).toEqual([]);
  });

  test("screenshots light and dark", async ({ page }) => {
    await page.goto(`${fixture.baseUrl}/`);
    await page.getByRole("switch", LOADING_SWITCH).click();
    await page.locator(LINE).first().scrollIntoViewIfNeeded();
    await mountAdapter(page, "skeleton-line");
    await expect(host(page, "skeleton-line")).toHaveCount(3);
    const block = page.locator('[data-testid="loading-state"]');
    for (const mode of ["light", "dark"] as const) {
      await setMode(page, mode);
      await page.waitForTimeout(200);
      await shoot(block, `feedback-skeleton-${mode}`);
    }
  });

  test("disabling the adapter restores the region exactly", async ({ page }) => {
    await page.goto(`${fixture.baseUrl}/`);
    await page.getByRole("switch", LOADING_SWITCH).click();
    await page.locator(LINE).first().scrollIntoViewIfNeeded();
    await isolate(page);
    const original = await regionHtml(page, LINE);
    await setAdapterEnabled(page, "skeleton-line", true);
    await expect(host(page, "skeleton-line")).toHaveCount(3);
    await setAdapterEnabled(page, "skeleton-line", false);
    await expect(host(page, "skeleton-line")).toHaveCount(0);
    expect(await regionHtml(page, LINE)).toBe(original);
  });
});

test.describe("meter (Kumo Meter)", () => {
  const TRACK = '[role="meter"] > div.h-2';
  const METER = '[role="meter"]';

  test("bar overlays the track and mirrors the root value when the meter changes", async ({ page }) => {
    await page.goto(`${fixture.baseUrl}/`);
    await page.locator(METER).scrollIntoViewIfNeeded();
    const errors = collectConsoleErrors(page);
    await mountAdapter(page, "meter-bar");
    await expect(host(page, "meter-bar")).toHaveCount(1);
    await expect(page.locator(TRACK)).toHaveAttribute("data-dcf-hidden", "meter-bar");
    const bar = page.locator('[data-dcf-visual="meter-bar"] [role="progressbar"]');
    await expect(bar).toHaveAttribute("aria-valuenow", "81");
    await page.evaluate(
      ([meter, track]) => {
        document.querySelector(meter)!.setAttribute("aria-valuenow", "30");
        (document.querySelector(`${track} > div`) as HTMLElement).style.width = "30%";
      },
      [METER, TRACK] as const,
    );
    await expect(bar).toHaveAttribute("aria-valuenow", "30");
    expect(errors.messages).toEqual([]);
  });

  test("bar stand-in screenshotted in light and dark", async ({ page }) => {
    await page.goto(`${fixture.baseUrl}/`);
    await page.locator(METER).scrollIntoViewIfNeeded();
    await mountAdapter(page, "meter-bar");
    const block = page.locator(METER).locator("xpath=..");
    for (const mode of ["light", "dark"] as const) {
      await setMode(page, mode);
      await page.waitForTimeout(200);
      await shoot(block, `feedback-meter-bar-${mode}`);
    }
  });

  test("the bar grows its flex-gap parent when it mounts", async ({ page }) => {
    await page.goto(`${fixture.baseUrl}/`);
    await page.locator(METER).scrollIntoViewIfNeeded();
    await isolate(page);
    const before = await boxOf(page, METER);
    await setAdapterEnabled(page, "meter-bar", true);
    await expect(host(page, "meter-bar")).toHaveCount(1);
    await settle(page);
    expectNoShift(before, await boxOf(page, METER));
  });

  test("the track keeps its own box while the bar overlays it", async ({ page }) => {
    await page.goto(`${fixture.baseUrl}/`);
    await page.locator(METER).scrollIntoViewIfNeeded();
    await isolate(page);
    const trackBefore = await boxOf(page, TRACK);
    await setAdapterEnabled(page, "meter-bar", true);
    await expect(host(page, "meter-bar")).toHaveCount(1);
    await settle(page);
    expectNoShift(trackBefore, await boxOf(page, TRACK));
  });

  test("disabling the adapter restores the region exactly", async ({ page }) => {
    await page.goto(`${fixture.baseUrl}/`);
    await page.locator(METER).scrollIntoViewIfNeeded();
    await isolate(page);
    const original = await regionHtml(page, TRACK);
    await setAdapterEnabled(page, "meter-bar", true);
    await expect(host(page, "meter-bar")).toHaveCount(1);
    await setAdapterEnabled(page, "meter-bar", false);
    await expect(host(page, "meter-bar")).toHaveCount(0);
    expect(await regionHtml(page, TRACK)).toBe(original);
  });
});

test.describe("meter gauge (synthetic large meter)", () => {
  const SYNTHETIC = "synthetic-gauge";

  /** Adds a role=meter outside React's tree, sized like a large usage dial. */
  const addLargeMeter = (page: Page, width: number, height: number): Promise<void> =>
    page.evaluate(
      ([id, w, h]) => {
        const root = document.createElement("div");
        root.id = id;
        root.setAttribute("role", "meter");
        root.setAttribute("aria-label", "Requests quota");
        root.setAttribute("aria-valuemin", "0");
        root.setAttribute("aria-valuemax", "100");
        root.setAttribute("aria-valuenow", "62");
        root.style.width = `${w}px`;
        root.style.height = `${h}px`;
        const wrap = document.createElement("div");
        wrap.append(root);
        document.body.append(wrap);
      },
      [SYNTHETIC, width, height] as const,
    );

  test("a large meter becomes a gauge and the meter root stays labelled", async ({ page }) => {
    await page.goto(`${fixture.baseUrl}/`);
    await isolate(page);
    const errors = collectConsoleErrors(page);
    await addLargeMeter(page, 300, 180);
    await page.locator(`#${SYNTHETIC}`).scrollIntoViewIfNeeded();
    await setAdapterEnabled(page, "meter-gauge", true);
    await expect(host(page, "meter-gauge")).toHaveCount(1);
    await expect(page.locator(`#${SYNTHETIC}`)).toHaveAttribute("data-dcf-hidden", "meter-gauge");
    await expect(page.locator(`#${SYNTHETIC}`)).toHaveAttribute("aria-valuenow", "62");
    const gauge = host(page, "meter-gauge").locator('[role="meter"]');
    await expect(gauge).toHaveAttribute("aria-valuenow", "62");
    await expect(gauge).toBeVisible();
    for (const mode of ["light", "dark"] as const) {
      await setMode(page, mode);
      await page.waitForTimeout(300);
      await shoot(page.locator(`#${SYNTHETIC}`).locator("xpath=.."), `feedback-meter-gauge-${mode}`);
    }
    expect(errors.messages).toEqual([]);
  });

  test("disabling the gauge restores the wrapper exactly", async ({ page }) => {
    await page.goto(`${fixture.baseUrl}/`);
    await isolate(page);
    await addLargeMeter(page, 300, 180);
    await page.locator(`#${SYNTHETIC}`).scrollIntoViewIfNeeded();
    const original = await regionHtml(page, `#${SYNTHETIC}`);
    await setAdapterEnabled(page, "meter-gauge", true);
    await expect(host(page, "meter-gauge")).toHaveCount(1);
    await setAdapterEnabled(page, "meter-gauge", false);
    await expect(host(page, "meter-gauge")).toHaveCount(0);
    expect(await regionHtml(page, `#${SYNTHETIC}`)).toBe(original);
  });

  test("the bar adapter ignores the same large meter", async ({ page }) => {
    await page.goto(`${fixture.baseUrl}/`);
    await isolate(page);
    await addLargeMeter(page, 300, 180);
    await setAdapterEnabled(page, "meter-bar", true);
    await expect(host(page, "meter-bar")).toHaveCount(0);
    await expect(page.locator(`#${SYNTHETIC}`)).not.toHaveAttribute("data-dcf-hidden", /.*/);
  });
});

test.describe("empty state (icon art)", () => {
  const EMPTY_ROOT = "div.rounded-xl.border-kumo-fill.bg-kumo-control";

  test("does nothing on the fixture, which passes no icon", async ({ page }) => {
    await page.goto(`${fixture.baseUrl}/`);
    await page.locator(EMPTY_ROOT).first().scrollIntoViewIfNeeded();
    await isolate(page);
    const before = await regionHtml(page, EMPTY_ROOT);
    await setAdapterEnabled(page, "empty-icon", true);
    await expect(host(page, "empty-icon")).toHaveCount(0);
    expect(await regionHtml(page, EMPTY_ROOT)).toBe(before);
  });

  test("the title moves when the icon art is overlaid", async ({ page }) => {
    await page.goto(`${fixture.baseUrl}/`);
    await page.locator(EMPTY_ROOT).first().scrollIntoViewIfNeeded();
    await isolate(page);
    await page.evaluate((sel) => {
      const root = document.querySelector(sel)!;
      const icon = document.createElement("div");
      icon.id = "synthetic-empty-icon";
      icon.style.cssText = "width:48px;height:48px;background:currentColor;border-radius:8px";
      root.prepend(icon);
    }, EMPTY_ROOT);
    const titleBefore = await boxOf(page, `${EMPTY_ROOT} h2`);
    await setAdapterEnabled(page, "empty-icon", true);
    await expect(host(page, "empty-icon")).toHaveCount(1);
    await settle(page);
    expectNoShift(titleBefore, await boxOf(page, `${EMPTY_ROOT} h2`));
  });

  test("with an icon slot, replaces only the icon and keeps title and actions real", async ({ page }) => {
    await page.goto(`${fixture.baseUrl}/`);
    await page.locator(EMPTY_ROOT).first().scrollIntoViewIfNeeded();
    await isolate(page);
    await page.evaluate((sel) => {
      const root = document.querySelector(sel)!;
      const icon = document.createElement("div");
      icon.id = "synthetic-empty-icon";
      icon.style.width = "48px";
      icon.style.height = "48px";
      icon.style.background = "currentColor";
      icon.style.borderRadius = "8px";
      root.prepend(icon);
    }, EMPTY_ROOT);
    const errors = collectConsoleErrors(page);
    await setAdapterEnabled(page, "empty-icon", true);
    await expect(host(page, "empty-icon")).toHaveCount(1);
    await expect(page.locator("#synthetic-empty-icon")).toHaveAttribute("data-dcf-hidden", "empty-icon");
    await expect(page.locator(EMPTY_ROOT).first().locator("h2").first()).toBeVisible();
    const create = page.locator(EMPTY_ROOT).first().getByRole("button", { name: "Create Worker" });
    await expect(create).toBeVisible();
    const counter = page.getByTestId("click-count");
    const clicksBefore = await counter.textContent();
    await create.click();
    await expect(counter).not.toHaveText(clicksBefore ?? "");
    for (const mode of ["light", "dark"] as const) {
      await setMode(page, mode);
      await page.waitForTimeout(200);
      await shoot(page.locator(EMPTY_ROOT).first(), `feedback-empty-${mode}`);
    }
    expect(errors.messages).toEqual([]);
  });

  test("disabling the adapter restores the empty region exactly", async ({ page }) => {
    await page.goto(`${fixture.baseUrl}/`);
    await page.locator(EMPTY_ROOT).first().scrollIntoViewIfNeeded();
    await isolate(page);
    await page.evaluate((sel) => {
      const root = document.querySelector(sel)!;
      const icon = document.createElement("div");
      icon.id = "synthetic-empty-icon";
      icon.style.cssText = "width:48px;height:48px;background:currentColor;border-radius:8px";
      root.prepend(icon);
    }, EMPTY_ROOT);
    const original = await regionHtml(page, "#synthetic-empty-icon");
    await setAdapterEnabled(page, "empty-icon", true);
    await expect(host(page, "empty-icon")).toHaveCount(1);
    await setAdapterEnabled(page, "empty-icon", false);
    await expect(host(page, "empty-icon")).toHaveCount(0);
    expect(await regionHtml(page, "#synthetic-empty-icon")).toBe(original);
  });
});

test.describe("not-found code (404 digits)", () => {
  const CODE = "main > p:first-of-type";

  test("replaces the 404 with dithered digits, keeps the heading and links real", async ({ page }) => {
    await page.goto(`${fixture.baseUrl}/missing`);
    const errors = collectConsoleErrors(page);
    await isolate(page);
    await setAdapterEnabled(page, "not-found-code", true);
    await expect(host(page, "not-found-code")).toHaveCount(1);
    await expect(page.locator(CODE)).toHaveAttribute("data-dcf-hidden", "not-found-code");
    await expect.poll(() => shadowCanvasInk(page, "not-found-code")).toBeGreaterThan(0);
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to home" })).toBeVisible();
    expect(errors.messages).toEqual([]);
  });

  test("the 404 overlay pushes the heading down 8px", async ({ page }) => {
    await page.goto(`${fixture.baseUrl}/missing`);
    await isolate(page);
    const headingBefore = await boxOf(page, "h1");
    await setAdapterEnabled(page, "not-found-code", true);
    await expect(host(page, "not-found-code")).toHaveCount(1);
    await settle(page);
    expect(await boxOf(page, "h1")).toEqual(headingBefore);
  });

  test("Back to home stays a real link: clicking it leaves the 404 and removes the stand-in", async ({ page }) => {
    await page.goto(`${fixture.baseUrl}/missing`);
    const errors = collectConsoleErrors(page);
    await isolate(page);
    await setAdapterEnabled(page, "not-found-code", true);
    await expect(host(page, "not-found-code")).toHaveCount(1);
    await page.getByRole("link", { name: "Back to home" }).click();
    await expect(page).toHaveURL(`${fixture.baseUrl}/`);
    await expect(host(page, "not-found-code")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Page not found" })).toHaveCount(0);
    expect(errors.messages).toEqual([]);
  });

  test("screenshots light and dark", async ({ page }) => {
    await page.goto(`${fixture.baseUrl}/missing`);
    await isolate(page);
    await setAdapterEnabled(page, "not-found-code", true);
    await expect(host(page, "not-found-code")).toHaveCount(1);
    for (const mode of ["light", "dark"] as const) {
      await setMode(page, mode);
      await page.waitForTimeout(400);
      await shoot(page.locator("main"), `feedback-not-found-${mode}`);
    }
  });

  test("disabling the adapter restores the region exactly", async ({ page }) => {
    await page.goto(`${fixture.baseUrl}/missing`);
    await isolate(page);
    const original = await regionHtml(page, CODE);
    await setAdapterEnabled(page, "not-found-code", true);
    await expect(host(page, "not-found-code")).toHaveCount(1);
    await setAdapterEnabled(page, "not-found-code", false);
    await expect(host(page, "not-found-code")).toHaveCount(0);
    expect(await regionHtml(page, CODE)).toBe(original);
  });
});

test.describe("strict CSP", () => {
  test("loader and skeleton stand-ins mount under ?csp=strict without console errors", async ({ page }) => {
    await page.goto(`${fixture.baseUrl}/?csp=strict`);
    await page.getByRole("switch", LOADING_SWITCH).click();
    await page.locator('[data-testid="loading-state"] .skeleton-line').first().scrollIntoViewIfNeeded();
    const errors = collectConsoleErrors(page);
    await isolate(page);
    await setAdapterEnabled(page, "skeleton-line", true);
    await setAdapterEnabled(page, "loader-kumo", true);
    await expect(host(page, "skeleton-line")).toHaveCount(3);
    await expect(host(page, "loader-kumo")).toHaveCount(1);
    const sweep = await page.evaluate(() => {
      const skeleton = document.querySelector('[data-dcf-host="skeleton-line"]')!.shadowRoot!.querySelector('[data-slot="skeleton"]')!;
      const animated = [...skeleton.querySelectorAll("*")].find((k) => getComputedStyle(k).animationName !== "none");
      return { animation: animated ? getComputedStyle(animated).animationName : "none", mask: animated ? getComputedStyle(animated).maskImage : "none" };
    });
    expect(sweep.animation).toBe("dcn-skeleton-sweep");
    expect(sweep.mask).not.toBe("none");
    expect(errors.messages.filter((m) => !m.includes("Content Security Policy"))).toEqual([]);
  });
});
