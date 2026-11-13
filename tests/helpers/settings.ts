import type { Page } from "@playwright/test";
import type { Settings } from "../../src/core/settings";

export const CORE_HANDLE_KEY = "cloudflare-dither.core";

/** Applies a settings patch through the debug handle on `document` (Symbol.for). */
export const setSetting = (page: Page, patch: Partial<Settings>): Promise<void> =>
  page.evaluate(
    ([key, next]) => {
      const handle = (document as unknown as Record<symbol, { settings: { update(p: object): void } }>)[
        Symbol.for(key)
      ];
      if (!handle) throw new Error("core handle missing");
      handle.settings.update(next);
    },
    [CORE_HANDLE_KEY, patch] as const,
  );

/** Enables or disables one adapter through the same handle. */
export const setAdapterEnabled = (page: Page, adapterId: string, enabled: boolean): Promise<void> =>
  page.evaluate(
    ([key, id, on]) => {
      const handle = (document as unknown as Record<symbol, { settings: { setAdapterEnabled(i: string, e: boolean): void } }>)[
        Symbol.for(key)
      ];
      if (!handle) throw new Error("core handle missing");
      handle.settings.setAdapterEnabled(id, on);
    },
    [CORE_HANDLE_KEY, adapterId, enabled] as const,
  );
