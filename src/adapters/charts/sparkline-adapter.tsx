import { Sparkline } from "@/components/dithercn/sparkline";
import type { Adapter, AdapterContext } from "../../core/types";
import { extractSparkModel } from "./extract";
import { useTargetModel } from "./use-model";

const SparkStandIn = ({ ctx }: { ctx: AdapterContext }) => {
  const spark = useTargetModel(ctx.target, extractSparkModel);
  return (
    <div
      data-dcf-visual="sparkline"
      className="text-foreground"
      style={{ width: ctx.rect.width, height: ctx.rect.height }}
    >
      <Sparkline
        data={[...spark.values]}
        label="Trend"
        height={Math.max(12, ctx.rect.height)}
        {...(spark.color !== undefined ? { color: spark.color } : {})}
        className="w-full"
      />
    </div>
  );
};

/**
 * Inline polyline sparklines in table cells. Off by default: the target is inline, so the
 * overlay is only approximate, and the shape comes from the source points alone.
 */
export const sparklineAdapter: Adapter = {
  id: "sparkline-svg",
  label: "Inline sparklines",
  group: "charts",
  ditherComponents: ["sparkline"],
  selectors: [
    {
      selector: "svg:has(> polyline)",
      confidence: "low",
      source: "fixture /legacy zones table sparkline (svg > polyline); no live Cloudflare markup inspected",
    },
  ],
  defaultEnabled: false,
  maxInstances: 24,
  match: (el) => extractSparkModel(el) !== null,
  mode: "sibling-replace",
  render: (ctx) => <SparkStandIn ctx={ctx} />,
};
