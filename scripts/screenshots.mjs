// Captures the documentation screenshots (npm run screenshots).
//
//   BEFORE: fixture with the userscript absent.
//   AFTER:  fixture with dist/cloudflare-dither.user.js injected, default settings.
//
// Stand-ins mount only within 320px of the viewport, so the script first sweeps the page
// at normal viewport size (mounting everything), takes the close-up crops, and only then
// resizes the viewport to the full document height for the full-page shots. The fixed
// page background then covers the whole capture.
//
// Output: docs/screenshots/{before,after}-<route>-<theme>.png, settings-panel-<theme>.png,
// dither-lab-<theme>.png, after-home-loading-<theme>.png, and crops/<name>-<theme>.png.

import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const BUNDLE = join(ROOT, "dist/cloudflare-dither.user.js");
const OUT = join(ROOT, "docs/screenshots");
const CROP_DIR = join(OUT, "crops");
const VIEWPORT_WIDTH = 1280;
const VIEWPORT_HEIGHT = 800;
const ROUTES = ["/", "/legacy", "/login", "/missing"];
const THEMES = ["light", "dark"];
const LISTEN_PATTERN = /LISTENING (\d+)/;
const LAUNCH_ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"];
const SETTLE_INTERVAL_MS = 250;
const SETTLE_STABLE_CHECKS = 3;
const SETTLE_MAX_CHECKS = 40;

/** Same GM shim the test helpers use, so the bundle boots as it would under a manager. */
const GM_SHIM = `(() => {
  const ns = "__dcfGM:";
  window.GM_getValue = (key, fallback) => {
    try { const raw = localStorage.getItem(ns + key); return raw === null ? fallback : JSON.parse(raw); } catch (e) { return fallback; }
  };
  window.GM_setValue = (key, value) => { try { localStorage.setItem(ns + key, JSON.stringify(value)); } catch (e) {} };
  window.__dcfMenuCommands = [];
  window.GM_registerMenuCommand = (label, handler) => { window.__dcfMenuCommands.push({ label, handler }); };
})();`;

/** Crops: selector, how many ancestors to climb, and a file name. Missing targets are reported, not fatal. */
const CROPS = [
  { name: "buttons", selector: 'button:has-text("primary xs")', up: 3 },
  { name: "switches", selector: '[role="switch"]', up: 2 },
  { name: "tabs", selector: '[role="tablist"]', up: 0 },
  { name: "stat-tiles", selector: 'text=Bandwidth', up: 4 },
  { name: "chart-timeseries", selector: "[_echarts_instance_]", nth: 0, up: 0 },
  { name: "chart-bar", selector: "[_echarts_instance_]", nth: 1, up: 0 },
  { name: "chart-donut", selector: "[_echarts_instance_]", nth: 2, up: 0 },
  { name: "table", selector: "table", up: 0 },
  { name: "banner", selector: "text=Scheduled maintenance", up: 2 },
  { name: "sidebar", selector: 'aside[data-sidebar="sidebar"]', up: 0 },
  { name: "header", selector: "header", up: 0 },
  { name: "empty-state", selector: "text=No Workers yet", up: 4 },
  { name: "dropzone", selector: 'input[type="file"]', up: 2 },
  { name: "preview-images", selector: 'img[alt="Analytics screenshot"]', up: 0 },
  { name: "page-title", selector: "h1", up: 0 },
];

const startFixture = () =>
  new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, ["scripts/serve-fixture.mjs", "--port", "0"], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let buffer = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("serve-fixture did not print LISTENING in time"));
    }, 20_000);
    child.stdout.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const match = LISTEN_PATTERN.exec(buffer);
      if (!match) return;
      clearTimeout(timer);
      resolvePromise({
        baseUrl: `http://127.0.0.1:${match[1]}`,
        stop: () => {
          child.kill();
        },
      });
    });
    child.on("error", reject);
  });

/** Counts stand-in hosts across the document and every open shadow root. */
const countHosts = (page) =>
  page.evaluate(() => {
    const visit = (root) => {
      let n = root.querySelectorAll("[data-dcf-host]").length;
      for (const el of root.querySelectorAll("*")) {
        if (el.shadowRoot) n += visit(el.shadowRoot);
      }
      return n;
    };
    return visit(document);
  });

/** Waits until the host count stops changing and a couple of frames have painted. */
const settle = async (page) => {
  let last = -1;
  let stable = 0;
  for (let i = 0; i < SETTLE_MAX_CHECKS && stable < SETTLE_STABLE_CHECKS; i += 1) {
    await page.waitForTimeout(SETTLE_INTERVAL_MS);
    const count = await countHosts(page);
    stable = count === last ? stable + 1 : 0;
    last = count;
  }
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(undefined)))),
  );
};

/** Scrolls the page top to bottom so every target enters the 320px mount zone, then returns to top. */
const sweep = async (page) => {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += VIEWPORT_HEIGHT / 2) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(120);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page);
};

const setTheme = async (page, theme) => {
  const toggle = page.getByTestId("theme-toggle");
  const pressed = (await toggle.getAttribute("aria-pressed")) === "true";
  if ((theme === "dark") !== pressed) await toggle.click();
  await page.waitForFunction(
    (wanted) => document.documentElement.getAttribute("data-mode") === wanted,
    theme,
  );
};

/** Full-page capture: grow the viewport to the document height, then settle and shoot. */
const fullPage = async (page, path) => {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: VIEWPORT_WIDTH, height });
  await settle(page);
  await page.screenshot({ path, fullPage: false });
  await page.setViewportSize({ width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT });
  await settle(page);
};

const cropTarget = (page, crop) => {
  let locator = crop.nth === undefined ? page.locator(crop.selector).first() : page.locator(crop.selector).nth(crop.nth);
  for (let i = 0; i < crop.up; i += 1) locator = locator.locator("xpath=..");
  return locator;
};

const captureCrops = async (page, theme, failures) => {
  const missing = [];
  for (const crop of CROPS) {
    const path = join(CROP_DIR, `${crop.name}-${theme}.png`);
    try {
      const locator = cropTarget(page, crop);
      await locator.scrollIntoViewIfNeeded({ timeout: 3_000 });
      await settle(page);
      await locator.screenshot({ path, timeout: 5_000 });
    } catch (error) {
      missing.push(`${crop.name}: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
    }
  }
  if (missing.length > 0) failures.push(...missing.map((m) => `crop ${theme} ${m}`));
};

/** Captures one route. `after` injects the bundle with default settings. */
const captureRoute = async (browser, baseUrl, route, theme, mode, failures) => {
  const context = await browser.newContext({ viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(`${baseUrl}${route}`, { waitUntil: "load" });
    if (mode === "after") {
      const source = await readFile(BUNDLE, "utf8");
      await page.evaluate(GM_SHIM);
      await page.evaluate(`(() => {\n${source}\n})()`);
    }
    await setTheme(page, theme);
    if (mode === "after") await sweep(page);
    const name = route === "/" ? "home" : route.slice(1);
    if (mode === "after" && route === "/") {
      await captureCrops(page, theme, failures);
    }
    await fullPage(page, join(OUT, `${mode}-${name}-${theme}.png`));
    if (mode === "after" && route === "/") await captureHomeExtras(page, theme, failures);
  } catch (error) {
    failures.push(`${mode} ${route} ${theme}: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
  } finally {
    if (errors.length > 0) failures.push(`${mode} ${route} ${theme} page errors: ${errors.join("; ")}`);
    await context.close();
  }
};

/** Settings panel, Dither Lab and the loading state, all on the home route. */
const captureHomeExtras = async (page, theme, failures) => {
  const step = async (label, fn) => {
    try {
      await fn();
    } catch (error) {
      failures.push(`${label} ${theme}: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}`);
    }
  };
  await step("settings panel", async () => {
    // Settings open from the userscript manager's menu (the GM shim records the commands).
    await page.evaluate(() => {
      const command = (window.__dcfMenuCommands ?? []).find((item) => item.label === "Dither settings");
      if (!command) throw new Error("menu command not registered: Dither settings");
      command.handler();
    });
    const panel = page.locator("#dcf-settings-panel");
    await panel.waitFor({ state: "visible", timeout: 5_000 });
    await settle(page);
    await panel.screenshot({ path: join(OUT, `settings-panel-${theme}.png`) });
    await page.getByRole("button", { name: "Dither Lab" }).click();
    const lab = page.getByRole("dialog", { name: "Dither Lab" });
    await lab.waitFor({ state: "visible", timeout: 5_000 });
    await settle(page);
    await page.screenshot({ path: join(OUT, `dither-lab-${theme}.png`) });
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
  });
  await step("loading state", async () => {
    await page.getByRole("switch", { name: "Simulate loading" }).click();
    await page.waitForTimeout(600);
    await fullPage(page, join(OUT, `after-home-loading-${theme}.png`));
  });
};

const main = async () => {
  await mkdir(OUT, { recursive: true });
  await mkdir(CROP_DIR, { recursive: true });
  const failures = [];
  const fixture = await startFixture();
  const browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS });
  try {
    for (const theme of THEMES) {
      for (const route of ROUTES) {
        await captureRoute(browser, fixture.baseUrl, route, theme, "before", failures);
        await captureRoute(browser, fixture.baseUrl, route, theme, "after", failures);
        process.stdout.write(`captured ${route} ${theme}\n`);
      }
    }
  } finally {
    await browser.close();
    fixture.stop();
  }
  if (failures.length > 0) {
    process.stdout.write(`\n${failures.length} capture problem(s):\n${failures.map((f) => `  - ${f}`).join("\n")}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write("\nall screenshots captured\n");
  }
};

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
