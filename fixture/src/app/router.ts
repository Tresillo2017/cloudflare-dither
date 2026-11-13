import { useSyncExternalStore } from "react";

export type RouteName = "home" | "legacy" | "login" | "missing";

const ROUTE_BY_PATH: Readonly<Record<string, RouteName>> = {
  "/": "home",
  "/legacy": "legacy",
  "/login": "login",
};

const NAVIGATE_EVENT = "fixture:navigate";

/** Maps a pathname to a route. Anything unknown is the 404 page. */
export function routeForPath(pathname: string): RouteName {
  const trimmed = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return ROUTE_BY_PATH[trimmed] ?? "missing";
}

export function navigate(href: string): void {
  window.history.pushState(null, "", href);
  window.dispatchEvent(new Event(NAVIGATE_EVENT));
}

function subscribe(listener: () => void): () => void {
  window.addEventListener("popstate", listener);
  window.addEventListener(NAVIGATE_EVENT, listener);
  return () => {
    window.removeEventListener("popstate", listener);
    window.removeEventListener(NAVIGATE_EVENT, listener);
  };
}

function currentRoute(): RouteName {
  return routeForPath(window.location.pathname);
}

export function useRoute(): RouteName {
  return useSyncExternalStore(subscribe, currentRoute, () => "home");
}

function isPlainLeftClick(event: MouseEvent): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

function internalPathFrom(anchor: HTMLAnchorElement): string | null {
  const rawHref = anchor.getAttribute("href");
  if (rawHref === null || !rawHref.startsWith("/")) {
    return null;
  }
  if (anchor.target !== "" && anchor.target !== "_self") {
    return null;
  }
  return rawHref;
}

/**
 * Client-side navigation for same-origin absolute links, like the real SPA router.
 * Links with `#`, external hosts or target=_blank keep their default behaviour.
 */
export function installLinkInterceptor(): () => void {
  const onClick = (event: MouseEvent): void => {
    if (event.defaultPrevented || !isPlainLeftClick(event)) {
      return;
    }
    const origin = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!(origin instanceof HTMLAnchorElement)) {
      return;
    }
    const internalPath = internalPathFrom(origin);
    if (internalPath === null) {
      return;
    }
    event.preventDefault();
    navigate(internalPath);
  };
  document.addEventListener("click", onClick);
  return () => {
    document.removeEventListener("click", onClick);
  };
}
