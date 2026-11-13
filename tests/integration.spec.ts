import { expect, test, type Page } from "@playwright/test";
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
const CORE_KEY = "cloudflare-dither.core";
const ROUTES = ["/", "/legacy", "/login", "/missing"] as const;
const SETTLE_MS = 1500;
/** Strict CSP blocks Base UI's hoisted <style>, which is a known fixture limit (see fixture/README.md). */
const EXPECTED_STRICT_CSP = /Content Security Policy|Refused to apply inline style|style-src/;

type Mode = "light" | "dark";

let fixture: FixtureServer;

test.beforeAll(async () => {
  mkdirSync(SHOTS, { recursive: true });
  fixture = await startFixture();
});

test.afterAll(async () => {
  await fixture?.stop();
});

test.setTimeout(240_000);

const readAdapterIds = (page: Page): Promise<string[]> =>
  page.evaluate((key) => {
    const handle = (document as unknown as Record<symbol, { registry: { list(): { id: string }[] } }>)[Symbol.for(key)];
    if (!handle) throw new Error("core handle missing");
    return handle.registry.list().map((info) => info.id);
  }, CORE_KEY);

const setMaster = (page: Page, master: boolean): Promise<void> =>
  page.evaluate(
    ([key, next]) => {
      const handle = (document as unknown as Record<symbol, { settings: { update(p: object): void } }>)[Symbol.for(key)];
      if (!handle) throw new Error("core handle missing");
      handle.settings.update({ master: next });
    },
    [CORE_KEY, master] as const,
  );

const enableEverything = async (page: Page): Promise<string[]> => {
  const ids = await readAdapterIds(page);
  for (const id of ids) await setAdapterEnabled(page, id, true);
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  return ids;
};

const setMode = (page: Page, mode: Mode) =>
  page.evaluate((next) => document.documentElement.setAttribute("data-mode", next), mode);

/** Every adapter's stand-ins, summed. Used to check nothing leaks across navigation. */
const hostCount = (page: Page): Promise<number> => page.locator("[data-dcf-host]").count();

const openRoute = async (page: Page, route: string, csp?: "strict") => {
  const query = csp ? `?csp=${csp}` : "";
  await page.goto(`${fixture.baseUrl}${route}${query}`);
  await page.waitForLoadState("networkidle");
};

const scrollThrough = async (page: Page) => {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 600) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(120);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(SETTLE_MS);
};

test.describe("all adapters enabled together", () => {
  for (const route of ROUTES) {
    for (const mode of ["light", "dark"] as const) {
      test(`${route} renders with every adapter on in ${mode} mode without console errors`, async ({ page }) => {
        await openRoute(page, route);
        const errors = collectConsoleErrors(page);
        await injectUserscript(page, BUNDLE);
        await enableEverything(page);
        await setMode(page, mode);
        await scrollThrough(page);
        const name = `full-${route === "/" ? "home" : route.slice(1)}-${mode}`;
        await page.screenshot({ path: resolve(SHOTS, `${name}.png`), fullPage: true });
        expect(errors.messages).toEqual([]);
      });
    }
  }

  test("strict CSP home route with every adapter on produces no console errors beyond the known Base UI limit", async ({ page }) => {
    await openRoute(page, "/", "strict");
    const errors = collectConsoleErrors(page);
    await injectUserscript(page, BUNDLE);
    await enableEverything(page);
    await scrollThrough(page);
    const unexpected = errors.messages.filter((message) => !EXPECTED_STRICT_CSP.test(message));
    expect(unexpected).toEqual([]);
  });
});

test.describe("master switch and restore", () => {
  test("master off restores the document exactly and removes every page-level global style", async ({ page }) => {
    await openRoute(page, "/");
    const before = await domSnapshot(page);
    await injectUserscript(page, BUNDLE);
    await enableEverything(page);
    await scrollThrough(page);
    expect(await hostCount(page)).toBeGreaterThan(0);
    await setMaster(page, false);
    await page.waitForTimeout(SETTLE_MS);
    expect(await hostCount(page)).toBe(0);
    expect(await page.evaluate(() => document.adoptedStyleSheets.length)).toBe(0);
    expect(await domSnapshot(page)).toBe(before);
  });

  test("rapid master toggling settles with no leftover hosts when off", async ({ page }) => {
    await openRoute(page, "/");
    const errors = collectConsoleErrors(page);
    await injectUserscript(page, BUNDLE);
    await enableEverything(page);
    for (let i = 0; i < 12; i += 1) {
      await setMaster(page, i % 2 === 0);
    }
    await setMaster(page, false);
    await page.waitForTimeout(SETTLE_MS);
    expect(await hostCount(page)).toBe(0);
    expect(errors.messages).toEqual([]);
  });
});

test.describe("SPA navigation", () => {
  test("moving between routes mounts and unmounts cleanly with no growth in hosts", async ({ page }) => {
    await openRoute(page, "/");
    const errors = collectConsoleErrors(page);
    await injectUserscript(page, BUNDLE);
    await enableEverything(page);
    await scrollThrough(page);
    const rounds: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      await page.evaluate(() => {
        history.pushState({}, "", "/legacy");
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
      await page.waitForTimeout(SETTLE_MS);
      await scrollThrough(page);
      await page.evaluate(() => {
        history.pushState({}, "", "/");
        window.dispatchEvent(new PopStateEvent("popstate"));
      });
      await page.waitForTimeout(SETTLE_MS);
      rounds.push(await hostCount(page));
    }
    // Round one is the steady state for this scroll position; later rounds must not accumulate hosts.
    const [steady, ...later] = rounds;
    for (const count of later) expect(count).toBeLessThanOrEqual(steady + 2);
    expect(errors.messages).toEqual([]);
  });
});

/** Snapshot of what a user can observe after the smoke flow. */
const smokeState = (page: Page) =>
  page.evaluate(() => ({
    clicks: document.querySelector('[data-testid="click-count"]')?.textContent ?? "",
    switches: [...document.querySelectorAll('[role="switch"]')].map((el) => el.getAttribute("aria-checked")),
    tabs: [...document.querySelectorAll('[role="tab"]')].map((el) => el.getAttribute("aria-selected")),
    inputs: [...document.querySelectorAll("input[type=text], input:not([type])")].map((el) => (el as HTMLInputElement).value),
  }));

const runSmokeFlow = async (page: Page) => {
  await page.getByRole("button", { name: "primary xs", exact: true }).click();
  await page.getByRole("switch", { name: "Auto-renew" }).click();
  const tab = page.getByRole("tab").nth(1);
  if (await tab.count()) await tab.click();
  const input = page.locator("input:not([type]), input[type=text]").first();
  if (await input.count()) await input.fill("smoke");
  await page.waitForTimeout(SETTLE_MS);
};

test.describe("interaction parity", () => {
  test("the smoke flow ends in the same state with the script on and off", async ({ page }) => {
    await openRoute(page, "/");
    await runSmokeFlow(page);
    const withoutScript = await smokeState(page);

    await openRoute(page, "/");
    await injectUserscript(page, BUNDLE);
    await enableEverything(page);
    await runSmokeFlow(page);
    const withScript = await smokeState(page);

    expect(withScript).toEqual(withoutScript);
  });
});
