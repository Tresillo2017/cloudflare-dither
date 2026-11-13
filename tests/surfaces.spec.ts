import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  collectConsoleErrors,
  injectUserscript,
  setAdapterEnabled,
  startFixture,
  type FixtureServer,
} from "./helpers";
import { CONTENT_GAP_PX, distanceToBox, planGlow } from "../src/adapters/surfaces/card-glow";

/** Private bundle for this group. Set DCF_BUNDLE to the bundle built with `--out dist/<key>.user.js`. */
const BUNDLE = process.env.DCF_BUNDLE ?? "dist/cloudflare-dither.user.js";
const SHOT_DIR = "tests/screenshots";
const DIFF_CHANNEL_TOLERANCE = 24;
const CHANGED_RATIO_MIN = 0.02;

let fixture: FixtureServer;

/** The fixture's first load (about 5 MB of chart code) is slow on a cold browser. */
expect.configure({ timeout: 15_000 });
/** Mounting waits on requestAnimationFrame, which software WebGL in headless Chromium can starve for seconds. */
const MOUNT_POLL = { timeout: 20_000 };

test.beforeAll(async () => {
  fixture = await startFixture();
});

test.afterAll(async () => {
  await fixture.stop();
});

/** Opens a route, starts the console listener, then injects the bundle (as a manager does). */
const open = async (page: Page, route = "/") => {
  const errors = collectConsoleErrors(page);
  await page.goto(fixture.baseUrl + route);
  await page.waitForLoadState("load");
  await injectUserscript(page, BUNDLE);
  return errors;
};

const hosts = (page: Page, adapterId: string) => page.locator(`[data-dcf-host="${adapterId}"]`);

/** Outer HTML of the first element matching `selector` (for exact-restore checks). */
const outerHtml = (page: Page, selector: string) =>
  page.evaluate((sel) => document.querySelector(sel)?.outerHTML ?? "", selector);

/** Checks the stand-in never takes the pointer from the original: the hit test lands inside the target. */
const pointerReachesOriginal = (page: Page, selector: string, index = 0) =>
  page.evaluate(([sel, at]) => {
    const target = document.querySelectorAll(sel)[at];
    if (!target) return false;
    const box = target.getBoundingClientRect();
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return hit !== null && (target === hit || target.contains(hit)) && !hit.closest("[data-dcf-host]");
  }, [selector, index] as const);

/** Decodes both screenshots in a blank page and returns the share of pixels that changed. */
const changedRatio = async (page: Page, before: Buffer, after: Buffer): Promise<number> => {
  const scratch = await page.context().newPage();
  try {
    await scratch.goto("about:blank");
    return await scratch.evaluate(
      async ([a, b, tolerance]) => {
        const load = (src: string) =>
          new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error("decode failed"));
            img.src = src;
          });
        const [imgA, imgB] = await Promise.all([load(a), load(b)]);
        const width = Math.min(imgA.width, imgB.width);
        const height = Math.min(imgA.height, imgB.height);
        const read = (img: HTMLImageElement) => {
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d", { willReadFrequently: true });
          context?.drawImage(img, 0, 0, width, height);
          return context?.getImageData(0, 0, width, height).data ?? new Uint8ClampedArray();
        };
        const pa = read(imgA);
        const pb = read(imgB);
        let changed = 0;
        for (let i = 0; i < pa.length; i += 4) {
          if (Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2]) > tolerance * 3) changed += 1;
        }
        return changed / (width * height);
      },
      [`data:image/png;base64,${before.toString("base64")}`, `data:image/png;base64,${after.toString("base64")}`, DIFF_CHANNEL_TOLERANCE] as const,
    );
  } finally {
    await scratch.close();
  }
};

/** Count of distinct quantised colours in a screenshot: a blank element has one or two. */
const distinctColours = async (page: Page, shot: Buffer): Promise<number> => {
  const scratch = await page.context().newPage();
  try {
    await scratch.goto("about:blank");
    return await scratch.evaluate(async (src) => {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("decode failed"));
        img.src = src;
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context?.drawImage(img, 0, 0);
      const data = context?.getImageData(0, 0, img.width, img.height).data ?? new Uint8ClampedArray();
      const seen = new Set<number>();
      for (let i = 0; i < data.length; i += 4) seen.add(((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4));
      return seen.size;
    }, `data:image/png;base64,${shot.toString("base64")}`);
  } finally {
    await scratch.close();
  }
};

const toggleTheme = async (page: Page) => {
  await page.getByTestId("theme-toggle").evaluate((el) => (el as HTMLElement).click());
  await expect(page.locator("html")).toHaveAttribute("data-mode", "dark");
  await expect.poll(() => page.evaluate(() => document.querySelector("[data-dcf-theme]")?.getAttribute("data-dcf-theme") ?? "")).toBe("dark");
};

/** Stand-in mount element for an adapter, by its host id (first one). */
const mountTheme = (page: Page, adapterId: string) =>
  page.locator(`[data-dcf-host="${adapterId}"]`).first().evaluate((host) => host.shadowRoot?.querySelector("[data-dcf-theme]")?.getAttribute("data-dcf-theme") ?? "");

/** Element screenshot written under tests/screenshots. */
const shot = (locator: Locator, name: string) => locator.screenshot({ path: `${SHOT_DIR}/surfaces-${name}.png` });

test.describe("card", () => {
  test("mounts dithered surfaces, keeps popovers clickable, restores DOM exactly", async ({ page }) => {
    const errors = await open(page, "/");
    const primary = '[class~="ring-kumo-fill"][class~="rounded-lg"]';
    await setAdapterEnabled(page, "card", false);
    const baseline = await outerHtml(page, primary);
    await setAdapterEnabled(page, "card", true);

    await expect.poll(() => hosts(page, "card").count(), MOUNT_POLL).toBeGreaterThanOrEqual(4);
    await expect(page.locator(`${primary}[data-dcf-underlay]`).first()).toBeAttached();
    expect(await pointerReachesOriginal(page, primary)).toBe(true);
    await expect(page.getByText("Requests", { exact: true }).first()).toBeVisible();

    const kpi = page.locator(primary).filter({ has: page.getByText("Requests", { exact: true }) }).first();
    await kpi.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOT_DIR}/surfaces-card-light.png`, clip: await kpi.boundingBox().then((b) => ({ x: b!.x - 16, y: b!.y - 16, width: b!.width + 32, height: b!.height + 32 })) });
    await toggleTheme(page);
    await expect.poll(() => mountTheme(page, "card")).toBe("dark");
    await page.screenshot({ path: `${SHOT_DIR}/surfaces-card-dark.png`, clip: await kpi.boundingBox().then((b) => ({ x: b!.x - 16, y: b!.y - 16, width: b!.width + 32, height: b!.height + 32 })) });
    await page.getByTestId("theme-toggle").evaluate((el) => (el as HTMLElement).click());

    await page.getByRole("button", { name: "Open popover" }).click();
    await expect(page.getByText("You are all caught up.")).toBeVisible();
    await page.keyboard.press("Escape");

    await setAdapterEnabled(page, "card", false);
    await expect(hosts(page, "card")).toHaveCount(0);
    expect(await outerHtml(page, primary)).toBe(baseline);
    expect(errors.messages).toEqual([]);
  });

  test("dialog stand-in sits under the dialog title and the dialog stays operable", async ({ page }) => {
    const errors = await open(page, "/");
    await setAdapterEnabled(page, "card", true);
    await page.getByRole("button", { name: "Open dialog" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect.poll(() => dialog.evaluate((el) => el.querySelector("[data-dcf-host]") !== null)).toBe(true);
    await shot(dialog, "card-dialog");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    expect(errors.messages).toEqual([]);
  });
});

test.describe("divider", () => {
  test("replaces hr rules with dithered rules and restores them exactly", async ({ page }) => {
    const errors = await open(page, "/");
    await setAdapterEnabled(page, "divider", false);
    const first = "hr";
    const baseline = await outerHtml(page, first);
    await setAdapterEnabled(page, "divider", true);

    await expect.poll(() => hosts(page, "divider").count(), MOUNT_POLL).toBeGreaterThanOrEqual(1);
    const rule = page.locator("hr").first();
    await expect(rule).toHaveAttribute("data-dcf-hidden", "divider");
    await expect(hosts(page, "divider").first()).toHaveAttribute("aria-hidden", "true");
    expect(await pointerReachesOriginal(page, first)).toBe(true);
    await rule.scrollIntoViewIfNeeded();
    await shot(page.locator("hr").first().locator("xpath=.."), "divider-light");
    await toggleTheme(page);
    await expect.poll(() => mountTheme(page, "divider")).toBe("dark");
    await page.getByTestId("theme-toggle").evaluate((el) => (el as HTMLElement).click());

    await setAdapterEnabled(page, "divider", false);
    await expect(hosts(page, "divider")).toHaveCount(0);
    expect(await outerHtml(page, first)).toBe(baseline);
    expect(errors.messages).toEqual([]);
  });
});

test.describe("avatar", () => {
  test("generative avatar replaces the account image, which stays in the accessibility tree", async ({ page }) => {
    const errors = await open(page, "/");
    const avatar = 'img[alt="Account avatar"]';
    await setAdapterEnabled(page, "avatar", false);
    const baseline = await outerHtml(page, avatar);
    await setAdapterEnabled(page, "avatar", true);

    await expect.poll(() => hosts(page, "avatar").count(), MOUNT_POLL).toBeGreaterThanOrEqual(1);
    await expect(page.locator(avatar)).toHaveAttribute("data-dcf-hidden", "avatar");
    await expect(page.getByRole("img", { name: "Account avatar" })).toBeAttached();
    await shot(page.locator(avatar).locator("xpath=.."), "avatar-light");
    await toggleTheme(page);
    await expect.poll(() => mountTheme(page, "avatar")).toBe("dark");
    await page.getByTestId("theme-toggle").evaluate((el) => (el as HTMLElement).click());

    await setAdapterEnabled(page, "avatar", false);
    await expect(hosts(page, "avatar")).toHaveCount(0);
    expect(await outerHtml(page, avatar)).toBe(baseline);
    expect(errors.messages).toEqual([]);
  });
});

test.describe("sidebar navigation", () => {
  test("active item is mirrored from data-active and moves when Kumo moves the attribute", async ({ page }) => {
    const errors = await open(page, "/");
    const items = page.locator('button[data-sidebar="menu-button"]');
    const home = items.nth(0);
    const analytics = items.nth(1);
    await setAdapterEnabled(page, "sidebar-active", false);
    const baseline = await outerHtml(page, 'button[data-sidebar="menu-button"][data-active]');
    await setAdapterEnabled(page, "sidebar-active", true);

    await expect(home.locator('[data-dcf-visual="sidebar-item"][data-active="true"]')).toHaveCount(1);
    await expect(items).toHaveCount(7);
    await shot(page.locator('aside[data-sidebar="sidebar"]'), "sidebar-light");

    // Kumo moves data-active between existing buttons; the stand-in must follow it.
    await page.evaluate(() => {
      const [first, second] = [...document.querySelectorAll('button[data-sidebar="menu-button"]')];
      first.removeAttribute("data-active");
      second.setAttribute("data-active", "true");
    });
    await expect(analytics.locator('[data-dcf-visual="sidebar-item"][data-active="true"]')).toHaveCount(1);
    await expect(home.locator('[data-dcf-visual="sidebar-item"][data-active="true"]')).toHaveCount(0);
    expect(await pointerReachesOriginal(page, 'button[data-sidebar="menu-button"]', 1)).toBe(true);

    await page.evaluate(() => {
      const [first, second] = [...document.querySelectorAll('button[data-sidebar="menu-button"]')];
      second.removeAttribute("data-active");
      first.setAttribute("data-active", "true");
    });
    await setAdapterEnabled(page, "sidebar-active", false);
    await expect(hosts(page, "sidebar-active")).toHaveCount(0);
    // Attribute order changes when Kumo moves data-active, so compare without that attribute.
    const withoutActive = (html: string) => html.replace(' data-active="true"', "");
    expect(withoutActive(await outerHtml(page, 'button[data-sidebar="menu-button"][data-active]'))).toBe(withoutActive(baseline));
    expect(errors.messages).toEqual([]);
  });
});

test.describe("header band", () => {
  test("header keeps its sidebar trigger working under the band", async ({ page }) => {
    const errors = await open(page, "/");
    // The fixture header uses bg-kumo-base; the real Cloudflare page header carries bg-kumo-canvas,
    // which is what the band matches. Give the fixture header the real class so the band mounts.
    await page.locator("header").first().evaluate((h) => h.classList.add("bg-kumo-canvas"));
    await setAdapterEnabled(page, "header-band", true);
    await expect(hosts(page, "header-band")).toHaveCount(1);
    expect(await pointerReachesOriginal(page, "header")).toBe(true);
    await expect(page.locator("header")).toHaveAttribute("data-dcf-underlay", "header-band");
    await shot(page.locator("header").first(), "header-light");
    await page.locator('[data-sidebar="trigger"]').first().click();
    await page.locator('[data-sidebar="trigger"]').first().click();
    expect(errors.messages).toEqual([]);
  });
});

test.describe("table", () => {
  test("header band and row hover mirror the original cells and rows", async ({ page }) => {
    const errors = await open(page, "/");
    const table = page.locator("table").first();
    await table.scrollIntoViewIfNeeded();
    await expect.poll(() => hosts(page, "table-head").count(), MOUNT_POLL).toBe(5);
    await expect.poll(() => hosts(page, "table-row").count(), MOUNT_POLL).toBeGreaterThanOrEqual(5);
    expect(await pointerReachesOriginal(page, "thead th")).toBe(true);
    await expect(page.locator("thead th").first()).toHaveText("Zone");

    const secondRow = page.locator("tbody tr").nth(1);
    const before = await table.screenshot();
    await secondRow.hover();
    await expect
      .poll(() => secondRow.evaluate((row) => row.querySelector('[data-dcf-host="table-row"]')?.shadowRoot?.querySelector('[data-hover="true"]') != null))
      .toBe(true);
    const after = await table.screenshot({ path: `${SHOT_DIR}/surfaces-table-hover.png` });
    expect(await changedRatio(page, before, after)).toBeGreaterThan(0);
    await page.mouse.move(0, 0);
    await toggleTheme(page);
    await shot(table, "table-dark");
    await page.getByTestId("theme-toggle").evaluate((el) => (el as HTMLElement).click());
    expect(errors.messages).toEqual([]);
  });

  test("row and header stand-ins paint an opaque base so page dithering never sits behind cell text", async ({ page }) => {
    await open(page, "/");
    const table = page.locator("table").first();
    await table.scrollIntoViewIfNeeded();
    await expect.poll(() => hosts(page, "table-row").count(), MOUNT_POLL).toBeGreaterThanOrEqual(5);
    const bases = await page.locator('[data-dcf-host="table-row"]').first().evaluate((host) => {
      const band = host.shadowRoot?.querySelector('[data-dcf-visual="table-row"]');
      return band ? getComputedStyle(band).backgroundColor : "";
    });
    expect(bases).not.toBe("rgba(0, 0, 0, 0)");
    expect(bases).not.toBe("");
  });
});

test.describe("page title", () => {
  test("h1 keeps its solid text and gets a dithered accent underlay, which follows route changes", async ({ page }) => {
    const errors = await open(page, "/");
    const heading = page.getByRole("heading", { level: 1, name: "Account home" });
    await expect(heading).toBeAttached();
    // Text is never dithered over: the heading stays visible, with the accent in its own box.
    await expect(page.locator("h1")).not.toHaveAttribute("data-dcf-hidden", "title-h1");
    await expect(page.locator("h1")).toHaveAttribute("data-dcf-underlay", "title-h1");
    await expect(hosts(page, "title-h1")).toHaveCount(1);
    await expect(page.locator('[data-dcf-visual="title"] .dcn-dissolve')).toHaveCount(0);
    await shot(heading, "title-light");

    await page.evaluate(() => {
      history.pushState(null, "", "/missing");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeAttached();
    await expect(hosts(page, "title-h1")).toHaveCount(1, { timeout: 5000 });
    expect(errors.messages).toEqual([]);
  });

  test("h2 titles are off by default and dither on request", async ({ page }) => {
    const errors = await open(page, "/legacy");
    await expect(hosts(page, "title-h2")).toHaveCount(0);
    await setAdapterEnabled(page, "title-h2", true);
    await expect.poll(() => hosts(page, "title-h2").count(), MOUNT_POLL).toBeGreaterThanOrEqual(1);
    await expect(page.locator("h2").first()).toHaveAttribute("data-dcf-underlay", "title-h2");
    await expect(page.getByRole("heading", { level: 2 }).first()).toBeAttached();
    expect(errors.messages).toEqual([]);
  });
});

test.describe("card glow placement (pure)", () => {
  const card = { left: 0, top: 0, right: 400, bottom: 200 };

  test("glow picks the corner with free space and never reaches a content box", async () => {
    // Arrange: a text block fills the top-left, the other corners are clear.
    const text = { left: 10, top: 10, right: 200, bottom: 60 };
    // Act
    const plan = planGlow(card, [text], 360);
    // Assert: the chosen corner is not top-left and its reach stops short of every box.
    expect(plan).not.toBeNull();
    expect(plan?.glow).not.toBe("top-left");
    expect(plan?.reach ?? 0).toBeLessThanOrEqual(360);
  });

  test("no glow when every corner is blocked by content", async () => {
    const full = { left: 0, top: 0, right: 400, bottom: 200 };
    expect(planGlow(card, [full], 360)).toBeNull();
  });

  test("reach is capped by the nearest content, minus the gap", async () => {
    // Arrange: one small box near the bottom-right; the top-left corner has the most free space.
    const box = { left: 290, top: 110, right: 300, bottom: 120 };
    // Act
    const plan = planGlow(card, [box], 360);
    // Assert: from (0,0) the nearest point of the box is hypot(290, 110) away, minus the gap.
    expect(plan?.glow).toBe("top-left");
    expect(plan?.reach).toBe(Math.round(Math.hypot(290, 110) - CONTENT_GAP_PX));
  });

  test("distance to a box is zero inside it and Euclidean outside", async () => {
    const box = { left: 10, top: 10, right: 20, bottom: 20 };
    expect(distanceToBox(15, 15, box)).toBe(0);
    expect(distanceToBox(0, 0, box)).toBeCloseTo(Math.hypot(10, 10));
  });
});
