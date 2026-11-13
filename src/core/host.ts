import type { StylesApi } from "./styles";
import type { ThemeName } from "./theme";
import { ownAttribute, restoreAll, type Restorable } from "./owned";
import type { StandInMode } from "./types";

export interface Rect {
  readonly width: number;
  readonly height: number;
}

export interface StandIn {
  readonly host: HTMLElement;
  readonly mountEl: HTMLElement;
  isAttached(): boolean;
  /** Puts the host back where its mode expects it (after React wiped it). */
  reattach(): void;
  /** Re-reads the target position and moves a sibling overlay onto it. */
  place(): void;
  setTheme(theme: ThemeName): void;
  setRect(rect: Rect): void;
  /** Removes the host and undoes every attribute change on the target. */
  dispose(): void;
}

export interface StandInOptions {
  target: Element;
  mode: StandInMode;
  adapterId: string;
  theme: ThemeName;
  styles: StylesApi;
}

const isStaticPosition = (el: Element): boolean =>
  getComputedStyle(el).position === "static";

/**
 * Host layout is set as CSSOM properties on the host itself, so it does not depend on the
 * adopted sheet (a page CSP can block <style> elements, but not CSSOM writes).
 */
const applyHostLayout = (host: HTMLElement, mode: StandInMode): void => {
  host.style.pointerEvents = "none";
  if (mode === "underlay-child") {
    host.style.position = "absolute";
    host.style.top = "0";
    host.style.right = "0";
    host.style.bottom = "0";
    host.style.left = "0";
    host.style.zIndex = "-1";
    host.style.overflow = "hidden";
  } else if (mode === "sibling-replace") {
    // Absolute, so the host never takes a grid, flex or gap slot next to the original.
    host.style.display = "block";
    host.style.position = "absolute";
  } else {
    host.style.position = "fixed";
    host.style.top = "0";
    host.style.right = "0";
    host.style.bottom = "0";
    host.style.left = "0";
    host.style.zIndex = "-1";
  }
};

/**
 * A sibling host goes BEFORE its target, so the target stays the last child. An element placed
 * after an inline target changes the target's :last-child styling (space-y and similar rules),
 * which moved the target by 2px. A target that is the first child takes the host after it.
 */
const siblingPlacesBefore = (target: Element): boolean => target.previousElementSibling !== null;

/** Attaches the host as the mode requires. Throws when the target has no parent for sibling mode. */
const attachHost = (host: HTMLElement, target: Element, mode: StandInMode): void => {
  if (mode === "underlay-child") target.append(host);
  else if (mode === "sibling-replace") {
    if (siblingPlacesBefore(target)) target.before(host);
    else target.after(host);
  } else document.body.append(host);
};

const isHostAttached = (host: HTMLElement, target: Element, mode: StandInMode): boolean => {
  if (mode === "underlay-child") return host.parentElement === target;
  if (mode === "sibling-replace") {
    return host.parentElement === target.parentElement && (host.nextElementSibling === target || host.previousElementSibling === target);
  }
  return host.isConnected;
};

/** Marks the target for the mode and returns the undo handles. */
const markTarget = (target: Element, mode: StandInMode, adapterId: string): Restorable[] => {
  if (mode === "underlay-child") {
    const marks: Restorable[] = [ownAttribute(target, "data-dcf-underlay", adapterId)];
    if (isStaticPosition(target)) marks.push(ownAttribute(target, "data-dcf-pos", ""));
    return marks;
  }
  if (mode === "sibling-replace") return [ownAttribute(target, "data-dcf-hidden", adapterId)];
  return [];
};

interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * Viewport position of the padding edge of the host's containing block (its nearest
 * positioned ancestor), or of the document origin when there is none. Scroll offsets of
 * that ancestor are included, because an absolutely positioned child scrolls with it.
 */
const containingOrigin = (host: HTMLElement): Point => {
  let node = host.parentElement;
  while (node && node !== document.documentElement) {
    if (getComputedStyle(node).position !== "static") {
      const box = node.getBoundingClientRect();
      return { x: box.left + node.clientLeft - node.scrollLeft, y: box.top + node.clientTop - node.scrollTop };
    }
    node = node.parentElement;
  }
  return { x: -window.scrollX, y: -window.scrollY };
};

/** Moves a sibling overlay onto its target's border box, without touching the target's layout. */
const placeSibling = (host: HTMLElement, target: Element): void => {
  const box = target.getBoundingClientRect();
  const origin = containingOrigin(host);
  host.style.left = `${box.left - origin.x}px`;
  host.style.top = `${box.top - origin.y}px`;
};

/**
 * Creates a stand-in: a host element with an open shadow root (adopting the shared
 * sheet) and a mount node that React portals render into. Visual only: the host is
 * inert and aria-hidden, and pointer-events are off.
 */
export const createStandIn = (options: StandInOptions): StandIn => {
  const { target, mode, adapterId, styles } = options;
  // Underlay hosts live inside the target, which may be a button or link: phrasing content only.
  const host = document.createElement(mode === "underlay-child" ? "span" : "div");
  host.setAttribute("data-dcf-host", adapterId);
  host.setAttribute("data-dcf-mode", mode);
  host.setAttribute("data-dcf-theme", options.theme);
  host.setAttribute("aria-hidden", "true");
  host.setAttribute("inert", "");
  applyHostLayout(host, mode);

  const shadow = host.attachShadow({ mode: "open" });
  styles.adoptInto(shadow);
  const mountEl = document.createElement("div");
  mountEl.setAttribute("data-dcf-theme", options.theme);
  mountEl.setAttribute("data-dcf-mount", adapterId);
  shadow.append(mountEl);

  const undo = markTarget(target, mode, adapterId);
  try {
    attachHost(host, target, mode);
  } catch (error) {
    restoreAll(undo);
    throw error;
  }

  const place = (): void => {
    if (mode === "sibling-replace") placeSibling(host, target);
  };

  return {
    host,
    mountEl,
    isAttached: () => isHostAttached(host, target, mode),
    reattach: () => {
      if (!isHostAttached(host, target, mode)) attachHost(host, target, mode);
      place();
    },
    place,
    setTheme: (theme) => {
      host.setAttribute("data-dcf-theme", theme);
      mountEl.setAttribute("data-dcf-theme", theme);
    },
    setRect: ({ width, height }) => {
      if (mode !== "sibling-replace") return;
      host.style.width = `${width}px`;
      host.style.height = `${height}px`;
      place();
    },
    dispose: () => {
      host.remove();
      restoreAll(undo);
    },
  };
};
