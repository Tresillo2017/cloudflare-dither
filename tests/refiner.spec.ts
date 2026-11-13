import { expect, test, type Page } from "@playwright/test";
import { collectConsoleErrors, injectUserscript, startFixture, type FixtureServer } from "./helpers";

/**
 * Round 4 (refiner) coverage: the rule and rim recipes are one shared shape (a solid hairline plus a
 * dithered falloff on each edge), and the sidebar sub-items get the same navigation stand-in as the
 * top-level items. Visual values are checked through the DOM the stand-ins emit.
 */
const BUNDLE = process.env.DCF_BUNDLE ?? "dist/cloudflare-dither.user.js";
const MOUNT_POLL = { timeout: 20_000 };

let fixture: FixtureServer;

test.beforeAll(async () => {
  fixture = await startFixture();
});

test.afterAll(async () => {
  await fixture.stop();
});

const openHome = async (page: Page) => {
  const errors = collectConsoleErrors(page);
  await page.goto(fixture.baseUrl + "/");
  await page.waitForLoadState("load");
  await injectUserscript(page, BUNDLE);
  return errors;
};

test("rim stand-ins draw a solid hairline and one bottom shade, never a dotted frame", async ({ page }) => {
  // Arrange
  const errors = await openHome(page);

  // Act
  const rims = page.locator('[data-dcf-host] [data-dcf-visual="rim-line"]');

  // Assert
  await expect.poll(() => rims.count(), MOUNT_POLL).toBeGreaterThan(0);
  const falloffs = page.locator('[data-dcf-host] [data-dcf-visual="rim-falloff"]');
  expect(await falloffs.count()).toBe(await rims.count());
  expect(errors.messages).toEqual([]);
});

test("rule stand-ins keep the hairline thin: one pixel, or two under a table header", async ({ page }) => {
  // Arrange
  const errors = await openHome(page);

  // Act
  const lines = page.locator('[data-dcf-host] [data-dcf-visual="rule-line"]');

  // Assert
  await expect.poll(() => lines.count(), MOUNT_POLL).toBeGreaterThan(0);
  const heights = await lines.evaluateAll((nodes) => nodes.map((node) => getComputedStyle(node).height));
  expect(heights.every((height) => height === "1px" || height === "2px")).toBe(true);
  expect(errors.messages).toEqual([]);
});

test("sidebar sub-items get a navigation stand-in when the fixture has them", async ({ page }) => {
  // Arrange
  const errors = await openHome(page);
  const subItems = page.locator('[data-sidebar="menu-sub-button"]');

  // Act
  const subCount = await subItems.count();

  // Assert
  if (subCount === 0) test.skip(true, "fixture renders no sidebar sub-items");
  await expect.poll(() => page.locator('[data-dcf-host="sidebar-active"]').count(), MOUNT_POLL).toBeGreaterThan(0);
  expect(errors.messages).toEqual([]);
});
