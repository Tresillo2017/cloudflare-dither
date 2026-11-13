import type { Adapter, AdapterContext } from "../../core";
import { cellFor } from "../../core/visual";
import { tintStyle, trailingRamp } from "./sidebar-band";

/** Account home lists ~170 sidebar entries (groups and sub-items); the cap covers one page of them. */
const MAX_NAV_ITEMS = 200;
const ACTIVE_TINT = 22;
const HOVER_TINT = 10;
const RAMP_PX = 72;

/**
 * Every navigation button gets the same underlay, and its state is mirrored. The active item
 * shows a solid brand tint, a dithered trailing edge and a solid bar. A hovered item shows a
 * lighter version of the same band. Text stays on the solid tint and never sits on dither.
 */
const NavStandIn = ({ ctx }: { ctx: AdapterContext }) => {
  const active = ctx.useTargetState((el) => el.hasAttribute("data-active"), { attributes: ["data-active"] });
  const { hover } = ctx.useTargetPseudo();
  if (!active && !hover) return null;
  const cell = cellFor(ctx.rect.height);
  return (
    <div data-dcf-visual="sidebar-item" data-active={String(active)} className="absolute inset-0 overflow-hidden rounded-[inherit]">
      <div className="absolute inset-0" style={tintStyle("brand", active ? ACTIVE_TINT : HOVER_TINT)} />
      <div className="absolute inset-0" style={trailingRamp("brand", cell, RAMP_PX, active ? 0.75 : 0.4)} />
      {active ? <div className="absolute inset-y-0 left-0 w-[3px] bg-primary" /> : null}
    </div>
  );
};

export const sidebarActiveAdapter: Adapter = {
  id: "sidebar-active",
  label: "Sidebar navigation",
  group: "surfaces",
  ditherComponents: [],
  selectors: [
    {
      selector: '[data-sidebar="menu-button"]',
      confidence: "high",
      source: "Kumo sidebar.tsx: menu button (data-active marks the current item)",
    },
    {
      selector: '[data-sidebar="menu-sub-button"]',
      confidence: "high",
      source: "Kumo sidebar.tsx: sub-item button (real pages: ~140 per page, the non-active items)",
    },
  ],
  defaultEnabled: true,
  maxInstances: MAX_NAV_ITEMS,
  mode: "underlay-child",
  render: (ctx) => <NavStandIn ctx={ctx} />,
};
