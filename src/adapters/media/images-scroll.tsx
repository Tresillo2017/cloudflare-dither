import { ScrollRevealImage } from "@/components/dithercn/scroll-reveal-image";
import type { Adapter, AdapterContext } from "../../core";
import { FailureGuard } from "./failure-guard";
import { absoluteSrc, isClaimedByVariant, isEligibleImage } from "./image-match";

/** Photo that dithers in as it scrolls into the reveal range, and resolves to the photo. */
const ScrollRevealStandIn = ({ ctx }: { ctx: AdapterContext }) => {
  const src = ctx.useTargetState(absoluteSrc, { attributes: ["src", "srcset"] });
  return (
    <FailureGuard adapterId="images-scroll-reveal">
      <ScrollRevealImage data-dcf-visual="scroll-reveal" src={src} alt="" end="photo" fit="cover" className="size-full" />
    </FailureGuard>
  );
};

export const imagesScrollRevealAdapter: Adapter = {
  id: "images-scroll-reveal",
  label: "Images: scroll reveal (instead of Content images)",
  group: "images",
  ditherComponents: ["scroll-reveal-image"],
  selectors: [{ selector: "img", confidence: "med", source: "any img; same filters as Content images" }],
  // Variant of Content images. Enabling it turns the default off for these images.
  defaultEnabled: false,
  maxInstances: 12,
  match: (el) => isEligibleImage(el) && !isClaimedByVariant(el, "images-scroll-reveal"),
  mode: "sibling-replace",
  render: (ctx) => <ScrollRevealStandIn ctx={ctx} />,
};
