import { ImageCompare } from "@/components/dithercn/image-compare";
import type { Adapter, AdapterContext } from "../../core";
import { useImageLoadGuard } from "./failure-guard";
import { absoluteSrc, isClaimedByVariant, isEligibleImage } from "./image-match";

const DITHERED_SIDE = 100;
const ORIGINAL_SIDE = 0;

/**
 * Hover or press shows the dithered side; leaving shows the original. The stand-in is
 * inert, so the divider cannot be dragged: its position is driven by the original's hover state.
 */
const CompareStandIn = ({ ctx }: { ctx: AdapterContext }) => {
  const src = ctx.useTargetState(absoluteSrc, { attributes: ["src", "srcset"] });
  const { hover, active } = ctx.useTargetPseudo();
  useImageLoadGuard(src, "images-compare");
  const showDithered = hover || active;
  return (
    <ImageCompare
      data-dcf-visual="compare"
      src={src}
      alt=""
      value={showDithered ? DITHERED_SIDE : ORIGINAL_SIDE}
      hint={false}
      labels={false}
      before={{ kind: "dither", color: "ink" }}
      after={{ kind: "original" }}
      fit="cover"
      className="size-full"
    />
  );
};

export const imagesCompareAdapter: Adapter = {
  id: "images-compare",
  label: "Images: hover to compare (instead of Content images)",
  group: "images",
  ditherComponents: ["image-compare"],
  selectors: [{ selector: "img", confidence: "med", source: "any img; same filters as Content images" }],
  defaultEnabled: false,
  maxInstances: 8,
  match: (el) => isEligibleImage(el) && !isClaimedByVariant(el, "images-compare"),
  mode: "sibling-replace",
  render: (ctx) => <CompareStandIn ctx={ctx} />,
};
