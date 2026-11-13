import type { Page } from "@playwright/test";

/**
 * Serialised document, for exact-restore comparisons. The settings launcher root
 * (`data-dcf-ui`) is excluded: it is the script's own control and stays visible on purpose
 * so the master switch can be turned back on.
 */
export const domSnapshot = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const clone = document.documentElement.cloneNode(true) as HTMLElement;
    for (const ui of clone.querySelectorAll("[data-dcf-ui]")) ui.remove();
    return clone.outerHTML;
  });
