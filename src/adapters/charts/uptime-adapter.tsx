import { UptimeBar, type UptimeDay } from "@/components/dithercn/uptime-bar";
import type { Adapter, AdapterContext } from "../../core/types";
import { extractUptimeModel } from "./extract";
import { useTargetModel } from "./use-model";

const DAY_MS = 86_400_000;

/**
 * Synthetic day labels, oldest first, ending today (UTC). The original status bars carry no
 * dates, so these dates are placeholders. The stand-in is pointer-events: none and inert, so
 * the tooltips that show them can never open.
 */
export const syntheticDays = (count: number, now: number): UptimeDay[] =>
  Array.from({ length: count }, (_, index) => {
    const date = new Date(now - (count - 1 - index) * DAY_MS).toISOString().slice(0, 10);
    return { date, uptime: null };
  });

const UptimeStandIn = ({ ctx }: { ctx: AdapterContext }) => {
  const uptime = useTargetModel(ctx.target, extractUptimeModel);
  const days = syntheticDays(uptime.statuses.length, Date.now()).map((day, index) => ({
    ...day,
    status: uptime.statuses[index],
  }));
  return (
    <div
      data-dcf-visual="uptime"
      className="flex items-center text-foreground"
      style={{ width: ctx.rect.width, height: ctx.rect.height }}
    >
      <UptimeBar label="Uptime" days={days} className="w-full" />
    </div>
  );
};

/** Status strips of small bars (up, degraded, down). Statuses are copied from the bars, not inferred. */
export const uptimeAdapter: Adapter = {
  id: "uptime-strip",
  label: "Uptime strips",
  group: "charts",
  ditherComponents: ["uptime-bar"],
  selectors: [
    {
      selector: "div:has(> span[data-status])",
      confidence: "med",
      source: "fixture /legacy uptime-card (30 span[data-status] bars, up/degraded/down)",
    },
  ],
  defaultEnabled: true,
  maxInstances: 8,
  match: (el) => extractUptimeModel(el) !== null,
  mode: "sibling-replace",
  render: (ctx) => <UptimeStandIn ctx={ctx} />,
};
