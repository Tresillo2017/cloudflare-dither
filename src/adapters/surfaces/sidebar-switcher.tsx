import type { Adapter, AdapterContext } from "../../core";
import { DitherRim } from "../../core/dither-rim";
import { CELL_PX_SMALL } from "../../core/visual";

/** The switcher is a short control: a shallow rim keeps the dither off its label. */
const SWITCHER_RIM_CELLS = 2;
import { cornerRadius } from "./geometry";

/**
 * Account switcher rim: one complete dithered rim on all four sides (DitherRim), following the
 * control's own corner radius. The control keeps its fill and label on top. The earlier dotted
 * strips and the solid ring were both flagged on the real page (critic HIGH), so this uses the
 * shared rim recipe.
 */
const SwitcherStandIn = ({ ctx }: { ctx: AdapterContext }) => {
  const radius = ctx.useTargetState((el) => cornerRadius(el), { attributes: ["class", "style"] });
  return <DitherRim cell={CELL_PX_SMALL} radius={`${radius}px`} tone="ink" depth={SWITCHER_RIM_CELLS} />;
};

export const sidebarSwitcherAdapter: Adapter = {
  id: "sidebar-switcher",
  label: "Account switcher rim",
  group: "surfaces",
  ditherComponents: ["dither-card"],
  selectors: [
    {
      selector: '[data-sentry-component="SwitchersBetaInner"]',
      confidence: "high",
      source: "Cloudflare account switcher (SwitchersBeta.tsx), read on /home",
    },
  ],
  defaultEnabled: true,
  maxInstances: 2,
  match: (el) => el.closest("[data-dcf-host]") === null,
  mode: "underlay-child",
  render: (ctx) => <SwitcherStandIn ctx={ctx} />,
};
