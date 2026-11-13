import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const DEFAULT_BUNDLE = "dist/cloudflare-dither.user.js";

export interface InjectOptions {
  /** Provide GM_getValue/GM_setValue/GM_registerMenuCommand backed by page localStorage. */
  gm?: boolean;
}

/** GM shim evaluated in the page world before the bundle, like a userscript manager would. */
const GM_SHIM = `(() => {
  const ns = "__dcfGM:";
  window.GM_getValue = (key, fallback) => {
    try { const raw = localStorage.getItem(ns + key); return raw === null ? fallback : JSON.parse(raw); } catch (e) { return fallback; }
  };
  window.GM_setValue = (key, value) => { try { localStorage.setItem(ns + key, JSON.stringify(value)); } catch (e) {} };
  window.__dcfMenuCommands = [];
  window.GM_registerMenuCommand = (label, handler) => { window.__dcfMenuCommands.push({ label, handler }); };
})();`;

/**
 * Injects a built userscript into `page` the way a manager does after load. Uses
 * Runtime.evaluate (page.evaluate), which page CSP does not block. Each call runs the
 * bundle again, so the boot guard is what prevents double init.
 */
export const injectUserscript = async (
  page: Page,
  bundlePath: string = process.env.DCF_BUNDLE ?? DEFAULT_BUNDLE,
  options: InjectOptions = {},
): Promise<void> => {
  const source = readFileSync(resolve(ROOT, bundlePath), "utf8");
  if (options.gm !== false) {
    await page.evaluate(GM_SHIM);
  }
  await page.evaluate(`(() => {\n${source}\n})()`);
};
