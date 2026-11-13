import type { Adapter } from "../../core";
import { CANVAS, LINE } from "../../core/visual";

/**
 * The page header is a translucent sticky strip, so whatever sits behind it shows through.
 * The band paints the Kumo canvas colour opaque, then a solid 1px divider in the Kumo line colour
 * on its bottom edge. The earlier full-width dotted rule read as stray debris (critic HIGH/MEDIUM),
 * so the divider is solid, like the original.
 */
const HeaderStandIn = () => (
  <div data-dcf-visual="header-band" className="absolute inset-0 overflow-hidden">
    {/* Opaque: the header is sticky, so scrolled content must not show through it. */}
    <div className="absolute inset-0" style={{ backgroundColor: CANVAS }} />
    <div className="absolute inset-x-0 bottom-0 h-px" style={{ backgroundColor: LINE }} />
  </div>
);

export const headerBandAdapter: Adapter = {
  id: "header-band",
  label: "Page header band",
  group: "surfaces",
  ditherComponents: [],
  selectors: [
    { selector: 'header[data-sentry-component="CollapsedHeaderInner"]', confidence: "high", source: "Cloudflare page header (CollapsedHeaderInner)" },
    { selector: "header.bg-kumo-canvas", confidence: "med", source: "Kumo canvas header (sticky page header)" },
  ],
  defaultEnabled: true,
  maxInstances: 4,
  match: (el) => el.closest("[data-dcf-host]") === null,
  mode: "underlay-child",
  render: () => <HeaderStandIn />,
};
