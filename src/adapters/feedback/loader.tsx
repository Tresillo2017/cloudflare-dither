import { Loader, type LoaderSize } from "@/components/dithercn/loader";
import type { Adapter, AdapterContext } from "../../core";
import { fitScale } from "./fit";

/** Natural height in CSS px of each dithercn loader size. */
const NATURAL_PX: Record<LoaderSize, number> = { sm: 24, md: 40, lg: 64 };

/** Chooses the dithercn size closest to the original box, then scales it to the exact box. */
export const loaderSizeFor = (box: number): LoaderSize => {
  if (box <= NATURAL_PX.sm) return "sm";
  if (box <= NATURAL_PX.md) return "md";
  return "lg";
};

const LoaderStandIn = ({ ctx }: { ctx: AdapterContext }) => {
  const box = Math.min(ctx.rect.width, ctx.rect.height);
  const size = loaderSizeFor(box);
  const scale = fitScale({ width: box, height: box }, NATURAL_PX[size]);
  return (
    <div data-dcf-visual="loader" className="absolute inset-0 flex items-center justify-center overflow-hidden">
      <div className="shrink-0" style={{ transform: `scale(${scale})` }}>
        <Loader size={size} label="Loading" />
      </div>
    </div>
  );
};

/** Kumo's spinner: an svg with role=status and aria-label=Loading. The original stays announced; the stand-in is silent. */
const kumoLoader: Adapter = {
  id: "loader-kumo",
  label: "Loader (Kumo spinner)",
  group: "feedback",
  ditherComponents: ["loader"],
  selectors: [
    { selector: 'svg[role="status"][aria-label="Loading"]', confidence: "high", source: "Kumo loader/loader.tsx" },
    { selector: 'svg[role="status"]', confidence: "med", source: "generic svg status indicator" },
  ],
  defaultEnabled: true,
  maxInstances: 20,
  match: (el) => el.closest('button, a, [role="button"], [role="switch"]') === null,
  mode: "sibling-replace",
  render: (ctx) => <LoaderStandIn ctx={ctx} />,
};

export const adapters: Adapter[] = [kumoLoader];
