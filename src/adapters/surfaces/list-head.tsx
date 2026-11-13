import type { Adapter, AdapterContext } from "../../core";
import { DitherRule } from "../../core/dither-rim";
import { cellFor } from "../../core/visual";
import { tintStyle } from "./sidebar-band";

const HEAD_TINT = 7;

/** Column header band: a solid tint with a dithered rule along its bottom edge. Nothing sits on the dither. */
const HeadStandIn = ({ ctx }: { ctx: AdapterContext }) => (
  <div data-dcf-visual="list-head" className="absolute inset-0 overflow-hidden">
    <div className="absolute inset-0" style={tintStyle("brand", HEAD_TINT)} />
    <div className="absolute inset-x-0 bottom-0 h-full">
      <DitherRule edge="bottom" cell={cellFor(ctx.rect.height)} tone="ink" depth={0} />
    </div>
  </div>
);

export const listHeadAdapter: Adapter = {
  id: "list-head",
  label: "List column headers",
  group: "surfaces",
  ditherComponents: [],
  selectors: [
    {
      selector: '[data-sentry-component="ShortcutColumnFrame"] > header',
      confidence: "high",
      source: "Account home column header (ShortcutColumnFrame.tsx)",
    },
  ],
  defaultEnabled: true,
  maxInstances: 12,
  match: (el) => el.closest("[data-dcf-host]") === null,
  mode: "underlay-child",
  render: (ctx) => <HeadStandIn ctx={ctx} />,
};
