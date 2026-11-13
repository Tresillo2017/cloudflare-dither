import { useEffect } from "react";
import type { Adapter, AdapterContext } from "../../core";
import { ownAttribute, type Restorable } from "../../core/owned";
import { toneFill } from "../../core/visual";
import { RIM_INK } from "./rim";

const TAB_SELECTOR = '[role="tab"]';
const TABS_ATTRIBUTES = ["aria-selected", "data-active", "data-state"];
const PILL_RADIUS = "8px";
/** Marks the selected tab so the page sheet can make its own background transparent over the pill. */
const SELECTED_TAB_ATTRIBUTE = "data-dcf-tab-selected";

/** Keeps the selected tab marked for as long as it is selected (owned attribute, restored exactly). */
const useSelectedTabMark = (list: Element, index: number): void => {
  useEffect(() => {
    const tab = index >= 0 ? list.querySelectorAll(TAB_SELECTOR).item(index) : null;
    if (!tab) return undefined;
    const undo: Restorable = ownAttribute(tab, SELECTED_TAB_ATTRIBUTE, "tabs");
    return () => undo.restore();
  }, [list, index]);
};

/** Index of the selected tab, or -1. Kumo marks it with aria-selected and data-active. */
export const activeTabIndex = (list: Element): number =>
  Array.from(list.querySelectorAll(TAB_SELECTOR)).findIndex(
    (tab) =>
      tab.getAttribute("aria-selected") === "true" ||
      tab.hasAttribute("data-active") ||
      tab.getAttribute("data-state") === "active",
  );

interface Box {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** Box of the selected tab in the coordinates of the list's padding box (where the underlay sits). */
const selectedBox = (list: Element, index: number): Box | null => {
  const tab = list.querySelectorAll(TAB_SELECTOR).item(index);
  if (!(tab instanceof HTMLElement)) return null;
  const tabRect = tab.getBoundingClientRect();
  const listRect = list.getBoundingClientRect();
  const left = tabRect.left - listRect.left - (list instanceof HTMLElement ? list.clientLeft : 0);
  const top = tabRect.top - listRect.top - (list instanceof HTMLElement ? list.clientTop : 0);
  return { height: tabRect.height, left, top, width: tabRect.width };
};

/**
 * The indicator for the selected tab: a solid one-pixel rim with a dithered brand-blue shade rising
 * from the bottom edge. The labels stay the original Kumo elements on top, so they keep their own
 * colour and remain clickable.
 */
const TabIndicator = ({ box, cell }: { box: Box; cell: number }) => (
  <div
    data-dcf-visual="tab-pill"
    className="absolute"
    style={{ height: box.height, left: box.left, top: box.top, width: box.width }}
  >
    <div className="absolute inset-0" style={{ borderRadius: PILL_RADIUS, boxShadow: `inset 0 0 0 1px ${RIM_INK}` }} />
    <div
      className="absolute inset-0"
      style={{ borderRadius: PILL_RADIUS, ...toneFill("gradient", "brand", { cell, edge: "bottom", length: 8, from: 0.9, to: 0 }) }}
    />
  </div>
);

const TabsStandIn = ({ ctx }: { ctx: AdapterContext }) => {
  const index = ctx.useTargetState(activeTabIndex, { attributes: TABS_ATTRIBUTES, subtree: true });
  useSelectedTabMark(ctx.target, index);
  // Measured on each render. A resize re-renders the stand-in through ctx.rect.
  const box = index >= 0 ? selectedBox(ctx.target, index) : null;
  if (!box) return null;
  return <TabIndicator box={box} cell={ctx.settings.cell} />;
};

export const tabsAdapter: Adapter = {
  id: "tabs",
  label: "Tabs",
  group: "controls",
  ditherComponents: [],
  selectors: [
    {
      selector: '[role="tablist"]',
      confidence: "high",
      source: "Kumo 2.18 tabs.tsx (Base UI tab list, role=tablist; triggers role=tab, data-active)",
    },
  ],
  // Off by default: on the real dashboard Kumo draws its own opaque sliding pill that the
  // stand-in cannot sit under cleanly yet.
  defaultEnabled: false,
  maxInstances: 20,
  mode: "underlay-child",
  render: (ctx) => <TabsStandIn ctx={ctx} />,
};
