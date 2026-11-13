import { DitherImage } from "@/components/dithercn/dither-image";
import type { Adapter, AdapterContext } from "../../core";
import { FailureGuard } from "./failure-guard";
import { absoluteSrc, isClaimedByVariant, isEligibleImage } from "./image-match";

const IMAGE_CELL_FALLBACK = 3;

/** Dithered content image. Failure to decode throws so the original image shows again. */
const ImageStandIn = ({ ctx }: { ctx: AdapterContext }) => {
  const src = ctx.useTargetState(absoluteSrc, { attributes: ["src", "srcset"] });
  const cell = Math.max(1, ctx.settings.cell || IMAGE_CELL_FALLBACK);
  return (
    <FailureGuard adapterId="images">
      <DitherImage data-dcf-visual="image" src={src} alt="" color="ink" cell={cell} fit="cover" className="size-full" />
    </FailureGuard>
  );
};

export const imagesAdapter: Adapter = {
  id: "images",
  label: "Content images",
  group: "images",
  ditherComponents: ["dither-image"],
  selectors: [
    { selector: "img", confidence: "med", source: "any img; filtered by size, origin, and alt in match()" },
  ],
  defaultEnabled: true,
  maxInstances: 12,
  match: (el) => isEligibleImage(el) && !isClaimedByVariant(el),
  mode: "sibling-replace",
  render: (ctx) => <ImageStandIn ctx={ctx} />,
};
