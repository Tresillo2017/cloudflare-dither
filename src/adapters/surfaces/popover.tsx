import type { Adapter } from "../../core";
import { CardStandIn } from "./card";
import { isSurfaceSized } from "./geometry";

/**
 * Popover panels and dropdown menus (Base UI popups). Same card treatment as dialogs: opaque
 * surface, uniform rim, glow only where it misses content. Only observed closed on the real
 * pages (the zone switcher and Switch Account popovers were not opened, read-only rule).
 */
export const popoverAdapter: Adapter = {
  id: "popover",
  label: "Popovers and menus",
  group: "surfaces",
  ditherComponents: ["dither-card"],
  selectors: [
    { selector: '[role="menu"]', confidence: "med", source: "Base UI Menu popup (dropdown menus)" },
    { selector: '[role="listbox"]', confidence: "med", source: "Base UI Select and Combobox popup" },
  ],
  defaultEnabled: true,
  maxInstances: 20,
  match: (el) => el.closest("[data-dcf-host]") === null && isSurfaceSized(el),
  mode: "underlay-child",
  render: (ctx) => <CardStandIn ctx={ctx} />,
};
