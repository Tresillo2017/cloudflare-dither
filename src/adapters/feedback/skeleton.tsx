import { Skeleton } from "@/components/dithercn/skeleton";
import type { Adapter, AdapterContext } from "../../core";
import { DARK_BASE } from "../../core/visual";

const SkeletonStandIn = ({ ctx }: { ctx: AdapterContext }) => (
  <div data-dcf-visual="skeleton" className="absolute inset-0">
    <Skeleton
      className="size-full rounded-[inherit] bg-input"
      style={ctx.theme === "dark" ? { backgroundColor: DARK_BASE } : undefined}
    />
  </div>
);

/** Kumo SkeletonLine (default variant). Empty div, so the stand-in sits inside it and never shifts layout. */
const skeletonLine: Adapter = {
  id: "skeleton-line",
  label: "Skeleton lines",
  group: "feedback",
  ditherComponents: ["skeleton"],
  selectors: [{ selector: ".skeleton-line", confidence: "high", source: "Kumo loader/skeleton-line.tsx default variant" }],
  defaultEnabled: true,
  maxInstances: 200,
  match: (el) => el.getAttribute("data-variant") !== "sketch" && el.childElementCount === 0,
  mode: "underlay-child",
  render: (ctx) => <SkeletonStandIn ctx={ctx} />,
};

export const adapters: Adapter[] = [skeletonLine];
