import type { Adapter } from "../../core";
import { CardStandIn } from "./card";
import { isSurfaceSized } from "./geometry";

/**
 * Banners and inline alerts. Kumo alerts carry role=alert or role=status. Not seen on the real
 * pages during the audit (the account home banner slot was empty), so this stays off by default.
 */
export const bannerAdapter: Adapter = {
  id: "banner",
  label: "Banners and alerts",
  group: "surfaces",
  ditherComponents: ["dither-card"],
  selectors: [{ selector: '[role="alert"]', confidence: "low", source: "ARIA alert (Kumo Banner or Alert), unverified on real pages" }],
  defaultEnabled: false,
  maxInstances: 10,
  match: (el) => el.closest("[data-dcf-host]") === null && isSurfaceSized(el),
  mode: "underlay-child",
  render: (ctx) => <CardStandIn ctx={ctx} />,
};
