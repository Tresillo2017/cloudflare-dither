import type { ReactNode } from "react";
import { DotMap } from "@/components/dithercn/dot-map";
import { DitherGlobe } from "@/components/dithercn/dither-globe";
import type { Adapter, AdapterContext } from "../../core";

/** Map and globe widgets are small in height; anything smaller is a control or an icon. */
const MIN_WIDGET_PX = 80;

const matchesWidgetSize = (el: Element): boolean => {
  const rect = el.getBoundingClientRect();
  return rect.width >= MIN_WIDGET_PX && rect.height >= MIN_WIDGET_PX;
};

/** Covers the widget with a dot map. The original stays focusable and clickable underneath. */
const MapStandIn = ({ ctx }: { ctx: AdapterContext }) => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-md" data-dcf-visual="map-placeholder">
    <DotMap columns={96} color="grey" accent="ink" animate={ctx.settings.animate} className="h-full w-full" />
  </div>
);

/** Covers the widget with a dithered globe. Same rules as the map. */
const GlobeStandIn = ({ ctx }: { ctx: AdapterContext }) => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-md" data-dcf-visual="globe-placeholder">
    <DitherGlobe speed={4} atmosphere animate={ctx.settings.animate} cell={ctx.settings.cell} className="h-full w-full" />
  </div>
);

/** Low confidence: map widgets are found by label only. Default off. */
export const pageMapAdapter: Adapter = {
  id: "page-map",
  label: "Map widgets",
  group: "page",
  ditherComponents: ["dot-map"],
  selectors: [
    { selector: '[role="img"][aria-label*="map" i]', confidence: "low", source: "guess: labelled map image role" },
    { selector: '[data-testid*="map" i]', confidence: "low", source: "guess: test id containing map" },
  ],
  defaultEnabled: false,
  maxInstances: 2,
  match: matchesWidgetSize,
  mode: "sibling-replace",
  render: (ctx): ReactNode => <MapStandIn ctx={ctx} />,
};

/** Low confidence: globe widgets are found by label only. Default off. */
export const pageGlobeAdapter: Adapter = {
  id: "page-globe",
  label: "Globe widgets",
  group: "page",
  ditherComponents: ["dither-globe"],
  selectors: [
    { selector: '[role="img"][aria-label*="globe" i]', confidence: "low", source: "guess: labelled globe image role" },
    { selector: '[data-testid*="globe" i]', confidence: "low", source: "guess: test id containing globe" },
  ],
  defaultEnabled: false,
  maxInstances: 1,
  match: matchesWidgetSize,
  mode: "sibling-replace",
  render: (ctx): ReactNode => <GlobeStandIn ctx={ctx} />,
};
