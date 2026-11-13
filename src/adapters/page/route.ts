import { useSyncExternalStore } from "react";

/** Pathnames that show the hero background instead of the app background. */
const HERO_PATHS: readonly string[] = ["/login", "/signin", "/signup"];

export const isHeroPath = (pathname: string): boolean =>
  HERO_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

/** Poll interval for SPA navigations that bypass popstate (pushState). */
const POLL_MS = 400;

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let lastPath = "";

const currentPath = (): string => window.location.pathname;

const notify = (): void => {
  const next = currentPath();
  if (next === lastPath) return;
  lastPath = next;
  for (const listener of listeners) listener();
};

const start = (): void => {
  lastPath = currentPath();
  window.addEventListener("popstate", notify);
  timer = setInterval(notify, POLL_MS);
};

const stop = (): void => {
  window.removeEventListener("popstate", notify);
  if (timer !== null) clearInterval(timer);
  timer = null;
};

/** Subscribes to pathname changes. Polling runs only while someone is subscribed. */
const subscribe = (listener: () => void): (() => void) => {
  if (listeners.size === 0) start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
};

/** The current pathname, re-rendering the caller on change. */
export const usePathname = (): string =>
  useSyncExternalStore(subscribe, currentPath, currentPath);
