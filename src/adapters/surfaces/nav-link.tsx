import type { Adapter, AdapterContext } from "../../core";
import { DitherRule } from "../../core/dither-rim";
import { CELL_PX_SMALL } from "../../core/visual";

const MAX_LINKS = 60;

/** Hover or keyboard focus draws a solid brand underline with a dithered falloff, inside its box. */
const UnderlineStandIn = ({ ctx }: { ctx: AdapterContext }) => {
  const { hover, focusVisible } = ctx.useTargetPseudo();
  if (!hover && !focusVisible) return null;
  return (
    <div data-dcf-visual="nav-link" className="absolute inset-x-0 bottom-0 overflow-hidden">
      <DitherRule edge="bottom" cell={CELL_PX_SMALL} tone="brand" thickness={2} depth={1} level={0.9} />
    </div>
  );
};

export const navLinkAdapter: Adapter = {
  id: "nav-link",
  label: "Link dithered underline",
  group: "surfaces",
  ditherComponents: [],
  selectors: [
    { selector: '[data-sentry-component="FooterLink"]', confidence: "high", source: "Cloudflare footer link (FooterLink)" },
    { selector: 'a[data-kumo-component="Link"]', confidence: "med", source: "Kumo Link" },
  ],
  defaultEnabled: true,
  maxInstances: MAX_LINKS,
  match: (el) => el.closest("[data-dcf-host]") === null,
  mode: "underlay-child",
  render: (ctx) => <UnderlineStandIn ctx={ctx} />,
};
