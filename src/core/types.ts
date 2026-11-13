import type { ReactNode } from "react";
import type { Settings } from "./settings";

export type AdapterGroup = "controls" | "feedback" | "charts" | "surfaces" | "text" | "images" | "page";

export type SelectorConfidence = "high" | "med" | "low";

/**
 * How a stand-in host attaches to its target.
 * - underlay-child: host is the last child of the target, absolutely positioned,
 *   z-index -1. The target's own children stay on top and interactive.
 * - sibling-replace: host is inserted right after the target. The target keeps its
 *   layout but is made invisible (opacity 0); the host overlays it with a negative margin.
 * - overlay-fixed: host is a fixed layer appended to document.body (not per target).
 */
export type StandInMode = "underlay-child" | "sibling-replace" | "overlay-fixed";

export interface SelectorSpec {
  selector: string;
  confidence: SelectorConfidence;
  source: string;
}

export interface TargetStateOptions {
  /** Only re-read when these attributes change. Omit to watch all attributes. */
  attributes?: string[];
  /** Also re-read when descendants change (text, children). */
  subtree?: boolean;
}

export interface TargetPseudoState {
  hover: boolean;
  active: boolean;
  focusVisible: boolean;
}

export interface AdapterContext {
  target: Element;
  rect: { width: number; height: number };
  theme: "light" | "dark";
  settings: Settings;
  /** Re-renders when the target changes. Call only at the top level of render. */
  useTargetState<T>(read: (el: Element) => T, opts?: TargetStateOptions): T;
  /** Hover/active/focus of the ORIGINAL element (listeners only, never blocks events). */
  useTargetPseudo(): TargetPseudoState;
}

export interface Adapter {
  /** Settings key. Unique across adapters. */
  id: string;
  label: string;
  group: AdapterGroup;
  /** dithercn components used (coverage report). */
  ditherComponents: string[];
  selectors: SelectorSpec[];
  defaultEnabled: boolean;
  /** Cap on simultaneously mounted stand-ins for this adapter. */
  maxInstances?: number;
  /** Extra filtering after a selector match. Throwing skips that element and records the adapter error. */
  match?(el: Element): boolean;
  mode: StandInMode;
  /** Rendered into the stand-in's shadow mount. Hooks are allowed. */
  render(ctx: AdapterContext): ReactNode;
}
