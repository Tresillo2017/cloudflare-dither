// Offline replay of a saved real dashboard page (real-dom/, private) with crisp screenshots.
// Usage: node scripts/real-shots.mjs <page> [--before] [--light] [--scroll y] [--clip x,y,w,h] [--out file]
//        [--scale 2] [--eval "js"]   (page = home-dark | workers-dark | dns-dark | ...)
import { chromium } from 'playwright';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VIEWPORT = { width: 1440, height: 900 };
const SETTLE_MS = Number(process.env.SETTLE_MS ?? 3500);

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : fallback;
};
const pageName = args.find((arg) => !arg.startsWith('--')) ?? 'home-dark';
const before = flag('before');
const light = flag('light');
const scale = Number(option('scale', '2'));
const clipArg = option('clip', '');
const evalArg = option('eval', '');
const out = resolve(
  ROOT,
  option('out', `docs/real/offline-${before ? 'before' : 'after'}-${pageName}${light ? '-light' : ''}.png`),
);

const htmlPath = resolve(ROOT, `real-dom/${pageName}.html`);
if (!existsSync(htmlPath)) {
  process.stderr.write(`missing ${htmlPath}\n`);
  process.exit(1);
}
const css = readFileSync(resolve(ROOT, 'real-dom/dash.css'), 'utf8');
const chartsPath = resolve(ROOT, `real-dom/${pageName}.charts.json`);
const charts = existsSync(chartsPath) ? JSON.parse(readFileSync(chartsPath, 'utf8')) : [];
const bundle = readFileSync(resolve(ROOT, option('bundle', 'dist/cloudflare-dither.user.js')), 'utf8');

/** Re-attaches fake React fibers so chart adapters can read the captured ECharts options. */
const attachFibers = (captures) => {
  function Chart() {}
  function StatTile() {}
  const hosts = [...document.querySelectorAll('[_echarts_instance_]')];
  hosts.forEach((host, index) => {
    const capture = captures[index];
    if (!capture) return;
    const statFiber = { type: StatTile, memoizedProps: capture.stat ?? {}, return: null };
    const wrapB = { type: 'div', memoizedProps: {}, return: statFiber };
    const wrapA = { type: 'div', memoizedProps: {}, return: wrapB };
    const chartFiber = { type: Chart, memoizedProps: { options: capture.options }, return: wrapA };
    host['__reactFiber$dcfreplay'] = { type: 'div', memoizedProps: {}, return: chartFiber };
  });
  return hosts.length;
};

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: scale });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error.message).slice(0, 200)));
  await page.route('**/*', (route) =>
    route.request().url().startsWith('http://replay.local/')
      ? route.fulfill({ contentType: 'text/html', body: readFileSync(htmlPath, 'utf8') })
      : route.abort(),
  );
  await page.goto('http://replay.local/', { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ content: css });
  if (light) {
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark-mode');
      document.documentElement.removeAttribute('data-mode');
    });
  }
  const chartHosts = await page.evaluate(attachFibers, charts);
  if (!before) {
    await page.evaluate(`(() => {\n${bundle}\n})()`);
    await page.waitForTimeout(SETTLE_MS);
  }
  if (evalArg) {
    const value = await page.evaluate(evalArg);
    process.stdout.write(`eval: ${JSON.stringify(value)}\n`);
    await page.waitForTimeout(800);
  }
  const mounts = await page.evaluate(() => {
    const counts = {};
    for (const host of document.querySelectorAll('[data-dcf-host]')) {
      const key = host.getAttribute('data-dcf-host');
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  });
  mkdirSync(dirname(out), { recursive: true });
  // Clips are in viewport coordinates after --scroll, so the capture never resizes the page.
  const scrollY = Number(option('scroll', '0'));
  if (scrollY > 0) {
    await page.evaluate((y) => window.scrollTo(0, y), scrollY);
    await page.waitForTimeout(SETTLE_MS);
  }
  const clip = clipArg ? clipArg.split(',').map(Number) : null;
  await page.screenshot(
    clip
      ? { path: out, clip: { x: clip[0], y: clip[1], width: clip[2], height: clip[3] } }
      : { path: out, fullPage: flag('full') },
  );
  process.stdout.on('error', () => {});
  process.stdout.write(`${JSON.stringify({ out, chartHosts, mounts, errors })}\n`);
} finally {
  await browser.close();
}
