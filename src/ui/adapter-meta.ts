import { adapters } from "../adapters";
import type { AdapterGroup, SelectorConfidence } from "../core";

const RANK: Record<SelectorConfidence, number> = { low: 0, med: 1, high: 2 };

/** Highest confidence among an adapter's selectors. The core does not expose selectors, so the UI reads them here. */
export const confidenceOf = (adapterId: string): SelectorConfidence => {
  const adapter = adapters.find((item) => item.id === adapterId);
  if (!adapter || adapter.selectors.length === 0) return "low";
  return adapter.selectors.reduce<SelectorConfidence>(
    (best, spec) => (RANK[spec.confidence] > RANK[best] ? spec.confidence : best),
    "low",
  );
};

export const GROUP_ORDER: readonly AdapterGroup[] = ["page", "controls", "feedback", "charts", "surfaces", "text", "images"];

export const GROUP_LABEL: Readonly<Record<AdapterGroup, string>> = {
  page: "Page",
  controls: "Controls",
  feedback: "Feedback",
  charts: "Charts",
  surfaces: "Surfaces",
  text: "Text",
  images: "Images",
};
