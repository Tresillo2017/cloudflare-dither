#!/usr/bin/env node
/**
 * Verifies the fixture with a real browser:
 *   node fixture/verify.mjs
 * - starts scripts/serve-fixture.mjs on a random port
 * - loads every route, fails on any console error or CSP violation (default CSP)
 * - screenshots each route in light and dark into fixture/screenshots/
 * - writes the selector census to fixture/census.json
 * - checks that a fixture button click reaches the original handler
 * - runs the home route under ?csp=strict and reports its console errors
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const FIXTURE_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(FIXTURE_DIR, "..");
const SCREENSHOT_DIR = path.join(FIXTURE_DIR, "screenshots");
const CENSUS_FILE = path.join(FIXTURE_DIR, "census.json");
const SERVER_SCRIPT = path.join(ROOT_DIR, "scripts", "serve-fixture.mjs");
const READY_PREFIX = "LISTENING ";
const SETTLE_MS = 800;
const THEME_SETTLE_MS = 400;
const VIEWPORT = { width: 1280, height: 900 };
const ROUTES = [
  { name: "home", path: "/", ready: "h1" },
  { name: "legacy", path: "/legacy", ready: "[data-testid=link-homepage]" },
  { name: "login", path: "/login", ready: "h1" },
  { name: "missing", path: "/missing", ready: "text=Page not found" },
];

function startServer() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SERVER_SCRIPT, "--port", "0"], { cwd: ROOT_DIR, stdio: ["ignore", "pipe", "pipe"] });
    let buffer = "";
    child.stdout.on("data", (chunk) => {
      buffer += chunk.toString();
      const line = buffer.split("\n").find((entry) => entry.startsWith(READY_PREFIX));
      if (line !== undefined) {
        resolve({ child, port: Number(line.slice(READY_PREFIX.length)) });
      }
    });
    child.stderr.on("data", (chunk) => process.stderr.write(chunk));
    child.on("error", reject);
    child.on("exit", (code) => reject(new Error(`server exited early with code ${code}`)));
  });
}

function attachErrorCollector(page, errors) {
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
}

async function openRoute(browser, baseUrl, route, query = "") {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  attachErrorCollector(page, errors);
  await page.goto(`${baseUrl}${route.path}${query}`, { waitUntil: "load" });
  await page.waitForSelector(route.ready, { timeout: 15000 });
  await page.waitForTimeout(SETTLE_MS);
  return { context, page, errors };
}

const CENSUS_SCRIPT = () => {
  const countBy = (nodes, read) => {
    const counts = {};
    nodes.forEach((node) => {
      const key = read(node);
      if (key !== null && key !== "") {
        counts[key] = (counts[key] ?? 0) + 1;
      }
    });
    return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
  };
  const all = (selector) => Array.from(document.querySelectorAll(selector));
  return {
    dataMode: document.documentElement.getAttribute("data-mode"),
    kumoComponent: countBy(all("[data-kumo-component]"), (n) => n.getAttribute("data-kumo-component")),
    kumoPart: countBy(all("[data-kumo-part]"), (n) => n.getAttribute("data-kumo-part")),
    sidebar: countBy(all("[data-sidebar]"), (n) => n.getAttribute("data-sidebar")),
    roles: countBy(all("[role]"), (n) => n.getAttribute("role")),
    testIds: countBy(all("[data-testid]"), (n) => n.getAttribute("data-testid")),
    echartsInstances: all("[_echarts_instance_]").length,
    canvases: all("canvas").length,
    svgs: all("svg").length,
    svgRoleImg: all("svg[role=img]").map((n) => n.getAttribute("aria-label")),
    cloudflareLogo: all('svg[aria-label="Cloudflare logo"]').length,
    images: all("img").map((n) => ({ src: n.getAttribute("src"), alt: n.getAttribute("alt") })),
    buttons: all("button").length,
    links: all("a[href]").length,
    inputs: countBy(all("input"), (n) => n.getAttribute("type") ?? "text"),
    tables: all("table").length,
    hr: all("hr").length,
    progressElements: all("progress").length,
    meters: all("[role=meter]").length,
    uploads: all('input[type="file"]').length,
    ranges: all('input[type="range"]').length,
    styleTags: all("style").length,
    dataKumoClassSample: all("[class*=kumo-]").length,
  };
};

async function captureRouteCensus(page, route) {
  const census = await page.evaluate(CENSUS_SCRIPT);
  return { route: route.path, ...census };
}

async function captureScreenshots(page, name) {
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}-light.png`), fullPage: true });
  await page.click('[data-testid="theme-toggle"]');
  await page.waitForTimeout(THEME_SETTLE_MS);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}-dark.png`), fullPage: true });
  await page.click('[data-testid="theme-toggle"]');
  await page.waitForTimeout(THEME_SETTLE_MS);
}

async function checkButtonClickReachesOriginal(page) {
  await page.getByRole("button", { name: "primary xs", exact: true }).click();
  const text = await page.locator('[data-testid="click-count"]').innerText();
  return { passed: /Clicks: [1-9]/.test(text), observed: text };
}

async function main() {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  const { child, port } = await startServer();
  const baseUrl = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch();
  const report = { routes: {}, strictCsp: null, clickCheck: null, failures: [] };
  try {
    for (const route of ROUTES) {
      const { context, page, errors } = await openRoute(browser, baseUrl, route);
      report.routes[route.name] = { consoleErrors: errors, census: await captureRouteCensus(page, route) };
      await captureScreenshots(page, route.name);
      if (route.name === "home") {
        report.clickCheck = await checkButtonClickReachesOriginal(page);
      }
      await context.close();
      if (errors.length > 0) {
        report.failures.push(`${route.path}: ${errors.length} console error(s)`);
      }
    }
    const strict = await openRoute(browser, baseUrl, ROUTES[0], "?csp=strict");
    report.strictCsp = { consoleErrors: strict.errors };
    await strict.context.close();
  } finally {
    await browser.close();
    child.kill("SIGTERM");
  }
  if (report.clickCheck !== null && !report.clickCheck.passed) {
    report.failures.push(`button click did not update counter (saw "${report.clickCheck.observed}")`);
  }
  const census = { routes: Object.fromEntries(Object.entries(report.routes).map(([k, v]) => [k, v.census])) };
  await writeFile(CENSUS_FILE, `${JSON.stringify(census, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ failures: report.failures, consoleErrors: Object.fromEntries(Object.entries(report.routes).map(([k, v]) => [k, v.consoleErrors])), strictCspConsoleErrors: report.strictCsp.consoleErrors, clickCheck: report.clickCheck }, null, 2)}\n`);
  if (report.failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`verify failed: ${message}\n`);
  process.exitCode = 1;
});
