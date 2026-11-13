import type { ReactNode } from "react";
import { DitherFade } from "@/components/dithercn/dither-fade";
import type { Adapter, AdapterContext } from "../../core";

/** Height of the fade under the top edge, in CSS pixels. Sits behind content, under translucent headers. */
const FADE_PX = 96;

const TopFade = ({ ctx }: { ctx: AdapterContext }) => (
  <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: FADE_PX }} data-dcf-visual="page-fade">
    <DitherFade side="bottom" size="100%" cell={ctx.settings.cell} animate={false} className="absolute inset-0 h-full w-full" />
  </div>
);

/**
 * Dithered fade under the sticky header. It is a fixed layer behind the content, so it only
 * shows through translucent surfaces (the header and sidebar tint from the page background).
 * Off by default: it does nothing on opaque headers.
 */
export const pageFadeAdapter: Adapter = {
  id: "page-fade",
  label: "Header fade",
  group: "page",
  ditherComponents: ["dither-fade"],
  selectors: [{ selector: "body", confidence: "med", source: "document body, fade drawn under the top edge" }],
  defaultEnabled: false,
  maxInstances: 1,
  mode: "overlay-fixed",
  render: (ctx): ReactNode => <TopFade ctx={ctx} />,
};
