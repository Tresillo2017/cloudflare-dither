import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  collectConsoleErrors,
  injectUserscript,
  setAdapterEnabled,
  startFixture,
  type FixtureServer,
} from "./helpers";

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
const shot = (locator: Locator, name: string) => locator.screenshot({ path: `${SHOT_DIR}/media-${name}.png` });

test.describe("cloudflare logo", () => {
  test("header logo is dithered from its serialised SVG, keeps its accessible name, restores exactly", async ({ page }) => {
    const errors = await open(page, "/");
    const logo = 'svg[aria-label="Cloudflare logo"]';
    await setAdapterEnabled(page, "logo", false);
    const baseline = await outerHtml(page, logo);
    // Measure only the logo's own box: the whole header is much larger than the glyph, so a
    // header-wide ratio cannot reach the threshold even when the stand-in is correct.
    const logoBox = await page.locator(logo).first().boundingBox();
    if (!logoBox) throw new Error("logo has no box");
    const idle = await page.screenshot({ clip: logoBox });
    await setAdapterEnabled(page, "logo", true);

    await expect.poll(() => hosts(page, "logo").count(), MOUNT_POLL).toBeGreaterThanOrEqual(1);
    await expect(page.locator(logo).first()).toHaveAttribute("data-dcf-hidden", "logo");
    await expect(page.getByRole("img", { name: "Cloudflare logo" }).first()).toBeAttached();
    await expect(hosts(page, "logo").first()).toHaveAttribute("aria-hidden", "true");
    expect(await pointerReachesOriginal(page, logo)).toBe(true);
    await expect.poll(() => page.locator("header").first().evaluate((h) => h.querySelector('[data-dcf-host="logo"]')?.shadowRoot?.querySelector("canvas") != null), MOUNT_POLL).toBe(true);
    const lit = await page.screenshot({ clip: logoBox, path: `${SHOT_DIR}/media-logo-light.png` });
    expect(await changedRatio(page, idle, lit)).toBeGreaterThan(CHANGED_RATIO_MIN);
    await toggleTheme(page);
    await expect.poll(() => mountTheme(page, "logo"), MOUNT_POLL).toBe("dark");
    await page.locator("header").screenshot({ path: `${SHOT_DIR}/media-logo-dark.png` });
    await page.getByTestId("theme-toggle").evaluate((el) => (el as HTMLElement).click());

    await setAdapterEnabled(page, "logo", false);
    await expect(hosts(page, "logo")).toHaveCount(0);
    expect(await outerHtml(page, logo)).toBe(baseline);
    expect(errors.messages).toEqual([]);
  });
});

test.describe("content images", () => {
  test("same-origin content image is dithered in place and the original keeps its alt text", async ({ page }) => {
    const errors = await open(page, "/");
    const shot = 'img[alt="Analytics screenshot"]';
    await page.locator(shot).scrollIntoViewIfNeeded();
    await expect.poll(() => hosts(page, "images").count(), MOUNT_POLL).toBeGreaterThanOrEqual(1);
    await expect(page.locator(shot)).toHaveAttribute("data-dcf-hidden", "images");
    await expect(page.getByRole("img", { name: "Analytics screenshot" })).toBeAttached();
    await expect.poll(() => page.locator(shot).evaluate((img) => [img.previousElementSibling, img.nextElementSibling].find((n) => n?.hasAttribute("data-dcf-host"))?.getAttribute("data-dcf-host") ?? ""), MOUNT_POLL).toBe("images");
    await expect.poll(() => page.locator(shot).evaluate((img) => [img.previousElementSibling, img.nextElementSibling].find((n) => n?.hasAttribute("data-dcf-host"))?.shadowRoot?.querySelector("canvas") != null), MOUNT_POLL).toBe(true);
    await page.locator(shot).screenshot({ path: `${SHOT_DIR}/media-images-light.png` });
    await toggleTheme(page);
    await expect.poll(() => mountTheme(page, "images"), MOUNT_POLL).toBe("dark");
    await page.locator(shot).screenshot({ path: `${SHOT_DIR}/media-images-dark.png` });
    await page.getByTestId("theme-toggle").evaluate((el) => (el as HTMLElement).click());
    expect(errors.messages).toEqual([]);
  });

  test("a failing image gives the original back (no hidden image left behind)", async ({ page }) => {
    const errors = await open(page, "/");
    await page.evaluate(() => {
      const img = document.createElement("img");
      img.alt = "Broken test image";
      img.width = 320;
      img.height = 200;
      img.src = "/assets/does-not-exist.png";
      document.querySelector("main")!.prepend(img);
    });
    const broken = page.locator('img[alt="Broken test image"]');
    await expect(broken).toBeAttached();
    await page.waitForTimeout(2000);
    await expect(broken).not.toHaveAttribute("data-dcf-hidden", "images");
    expect(await broken.evaluate((img) => [img.previousElementSibling, img.nextElementSibling].find((n) => n?.hasAttribute("data-dcf-host"))?.getAttribute("data-dcf-host") ?? "")).toBe("");
    expect(errors.messages.filter((m) => !/404|does-not-exist/.test(m))).toEqual([]);
  });

  test("cross-origin image is skipped cleanly", async ({ page }) => {
    const errors = await open(page, "/");
    await page.evaluate(() => {
      const img = document.createElement("img");
      img.alt = "Remote test image";
      img.width = 320;
      img.height = 200;
      img.src = "http://localhost:9/remote.png";
      document.querySelector("main")!.prepend(img);
    });
    const remote = page.locator('img[alt="Remote test image"]');
    await expect(remote).toBeAttached();
    await page.waitForTimeout(1000);
    expect(await remote.evaluate((img) => [img.previousElementSibling, img.nextElementSibling].find((n) => n?.hasAttribute("data-dcf-host"))?.getAttribute("data-dcf-host") ?? "")).toBe("");
    await expect(remote).not.toHaveAttribute("data-dcf-hidden", "images");
    expect(errors.messages.filter((m) => !/localhost:9|Failed to load resource|Refused to load/.test(m))).toEqual([]);
  });
});

test.describe("scroll-reveal image variant", () => {
  test("replaces content images only when switched on, and yields to them exactly", async ({ page }) => {
    const errors = await open(page, "/");
    await setAdapterEnabled(page, "images", false);
    await expect(hosts(page, "images")).toHaveCount(0);
    await setAdapterEnabled(page, "images-scroll-reveal", true);
    const shot = page.locator('img[alt="Analytics screenshot"]');
    await shot.scrollIntoViewIfNeeded();
    await expect.poll(() => hosts(page, "images-scroll-reveal").count(), MOUNT_POLL).toBeGreaterThanOrEqual(1);
    await expect(shot).toHaveAttribute("data-dcf-hidden", "images-scroll-reveal");
    await page.evaluate(() => window.scrollBy(0, 120));
    await page.waitForTimeout(600);
    await shot.screenshot({ path: `${SHOT_DIR}/media-scroll-reveal-light.png` });
    await setAdapterEnabled(page, "images-scroll-reveal", false);
    await expect(hosts(page, "images-scroll-reveal")).toHaveCount(0);
    expect(errors.messages).toEqual([]);
  });
});

test.describe("image compare variant", () => {
  test("hover shows the dithered side and leaving shows the original", async ({ page }) => {
    const errors = await open(page, "/");
    await setAdapterEnabled(page, "images", false);
    await setAdapterEnabled(page, "images-compare", true);
    const shot = page.locator('img[alt="Analytics screenshot"]');
    await shot.scrollIntoViewIfNeeded();
    await expect.poll(() => hosts(page, "images-compare").count(), MOUNT_POLL).toBeGreaterThanOrEqual(1);
    await page.mouse.move(0, 0);
    await page.waitForTimeout(400);
    const idle = await shot.screenshot();
    await shot.hover();
    await page.waitForTimeout(400);
    const hovered = await shot.screenshot({ path: `${SHOT_DIR}/media-compare-hover.png` });
    expect(await changedRatio(page, idle, hovered)).toBeGreaterThan(CHANGED_RATIO_MIN);
    await setAdapterEnabled(page, "images-compare", false);
    await expect(hosts(page, "images-compare")).toHaveCount(0);
    expect(errors.messages).toEqual([]);
  });
});

test.describe("login logo marquee", () => {
  test("login hero becomes a logo marquee when switched on, without touching the form", async ({ page }) => {
    const errors = await open(page, "/login");
    await setAdapterEnabled(page, "images", false);
    await expect(hosts(page, "images")).toHaveCount(0);
    await page.waitForTimeout(800);
    await setAdapterEnabled(page, "logo-marquee", true);
    const hero = page.locator('img[alt="Login hero"]');
    await expect.poll(() => hosts(page, "logo-marquee").count(), MOUNT_POLL).toBe(1);
    await expect(hero).toHaveAttribute("data-dcf-hidden", "logo-marquee");
    await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
    await page.locator("main, body").first().screenshot({ path: `${SHOT_DIR}/media-marquee-light.png` });
    await setAdapterEnabled(page, "logo-marquee", false);
    await expect(hosts(page, "logo-marquee")).toHaveCount(0);
    await expect(hero).not.toHaveAttribute("data-dcf-hidden", "logo-marquee");
    expect(errors.messages).toEqual([]);
  });
});

test.describe("breadcrumb scramble", () => {
  test("hover replays a scramble on the crumb, which keeps its text and link", async ({ page }) => {
    const errors = await open(page, "/");
    await setAdapterEnabled(page, "scramble-breadcrumb", true);
    // Kumo renders a hidden measuring copy of the crumbs; the visible one is the real target.
    const crumb = page.locator('nav[aria-label="breadcrumb"] a', { hasText: "Example Corp" }).filter({ visible: true });
    await expect.poll(() => hosts(page, "scramble-breadcrumb").count(), MOUNT_POLL).toBeGreaterThanOrEqual(1);
    await expect(crumb).toHaveAttribute("data-dcf-hidden", "scramble-breadcrumb", MOUNT_POLL);
    await crumb.hover();
    await expect.poll(() => crumb.evaluate((a) => [a.previousElementSibling, a.nextElementSibling].find((n) => n?.hasAttribute("data-dcf-host"))?.shadowRoot?.querySelector("[data-state]") != null), MOUNT_POLL).toBe(true);
    await page.waitForTimeout(1200);
    await expect(crumb).toHaveText("Example Corp");
    await expect(crumb).toHaveAttribute("href", "/");
    await page.locator('nav[aria-label="breadcrumb"]').screenshot({ path: `${SHOT_DIR}/media-scramble.png` });
    await setAdapterEnabled(page, "scramble-breadcrumb", false);
    await expect(hosts(page, "scramble-breadcrumb")).toHaveCount(0);
    expect(errors.messages).toEqual([]);
  });
});
