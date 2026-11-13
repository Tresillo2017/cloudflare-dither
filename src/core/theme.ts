import type { Log } from "./log";
import { ownAttribute, ownStyleProperty, restoreAll, type Restorable } from "./owned";

export type ThemeName = "light" | "dark";

export interface ThemeStore {
  get(): ThemeName;
  subscribe(listener: () => void): () => void;
  /**
   * The bridge (root marker, colour nudge, observers) runs only while at least one stand-in is
   * mounted, so turning every adapter off leaves <html> exactly as it was.
   */
  setActive(active: boolean): void;
  dispose(): void;
}

/** Cloudflare (Kumo) flips data-mode on <html>. Class, data-theme and OS preference are fallbacks. */
export const detectTheme = (root: HTMLElement, prefersDark: boolean): ThemeName => {
  const mode = root.getAttribute("data-mode");
  if (mode === "dark" || mode === "light") return mode;
  if (root.classList.contains("dark-mode") || root.classList.contains("dark")) return "dark";
  const named = root.getAttribute("data-theme") ?? "";
  if (/dark/i.test(named)) return "dark";
  if (/light/i.test(named)) return "light";
  return prefersDark ? "dark" : "light";
};

const OBSERVED_ATTRIBUTES = ["data-mode", "class", "data-theme", "style", "color-scheme"];
export const THEME_TICK_PROPERTY = "--dcf-theme-tick";

/**
 * Tracks the page theme. On change it marks <html> with data-dcf-theme (for the page
 * --dither-* tokens) and nudges --dcf-theme-tick, which makes dithercn's own
 * subscribeToTheme (watches html style/class) re-read its colours.
 */
export const createThemeStore = (log: Log): ThemeStore => {
  const root = document.documentElement;
  const media = window.matchMedia?.("(prefers-color-scheme: dark)") ?? null;
  const listeners = new Set<() => void>();
  let current: ThemeName = detectTheme(root, media?.matches ?? false);
  let observer: MutationObserver | null = null;
  let markerUndo: Restorable | null = null;
  let nudgeUndo: Restorable | null = null;
  let active = false;

  const applyMarker = (): void => {
    markerUndo?.restore();
    markerUndo = ownAttribute(root, "data-dcf-theme", current);
    nudgeUndo?.restore();
    nudgeUndo = ownStyleProperty(root, THEME_TICK_PROPERTY, String(Date.now()));
  };

  const refresh = (): void => {
    const next = detectTheme(root, media?.matches ?? false);
    if (next === current) return;
    current = next;
    log.debug(`theme -> ${next}`);
    applyMarker();
    for (const listener of listeners) listener();
  };

  const attach = (): void => {
    if (observer) return;
    current = detectTheme(root, media?.matches ?? false);
    applyMarker();
    observer = new MutationObserver(refresh);
    observer.observe(root, { attributes: true, attributeFilter: OBSERVED_ATTRIBUTES });
    media?.addEventListener("change", refresh);
  };

  const detach = (): void => {
    observer?.disconnect();
    observer = null;
    media?.removeEventListener("change", refresh);
    restoreAll([...(markerUndo ? [markerUndo] : []), ...(nudgeUndo ? [nudgeUndo] : [])]);
    markerUndo = null;
    nudgeUndo = null;
  };

  return {
    get: () => current,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setActive: (next) => {
      if (next === active) return;
      active = next;
      if (next) attach();
      else detach();
    },
    dispose: () => {
      active = false;
      detach();
    },
  };
};
