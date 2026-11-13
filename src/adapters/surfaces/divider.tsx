import { Divider } from "@/components/dithercn/divider";
import type { Adapter } from "../../core";
import { cellFor } from "../../core/visual";

/** Rule thickness in px; a rule this short takes the small cell from visual.ts. */
const RULE_THICKNESS = 1;
const RULE_CELL = cellFor(RULE_THICKNESS);

/**
 * The original hr is about 1px tall, so the rule is centred on it and allowed to
 * overflow the measured box (the host is that size). Visual only.
 */
/** A rule is wide and at most a few px tall. A collapsed group label (0px) is not drawn. */
const MAX_RULE_PX = 8;
const isRule = (el: Element): boolean => {
  const box = el.getBoundingClientRect();
  return box.width >= 24 && box.height > 0 && box.height <= MAX_RULE_PX;
};

const DividerStandIn = () => (
  <div className="relative size-full">
    <div className="absolute inset-x-0 top-1/2 -translate-y-1/2">
      <Divider data-dcf-visual="divider" thickness={RULE_THICKNESS} cell={RULE_CELL} strength={0.6} fade={0.4} />
    </div>
  </div>
);

export const dividerAdapter: Adapter = {
  id: "divider",
  label: "Horizontal rules",
  group: "surfaces",
  ditherComponents: ["divider"],
  selectors: [
    { selector: "hr", confidence: "high", source: "native hr (fixture uses Tailwind-styled hr)" },
    { selector: '[role="separator"]', confidence: "high", source: "ARIA separator" },
    { selector: '[data-sidebar="group-label"]', confidence: "med", source: "Cloudflare sidebar group rule (NavSection group-label, border-b when open)" },
  ],
  defaultEnabled: true,
  maxInstances: 200,
  match: (el) => isRule(el),
  mode: "sibling-replace",
  render: () => <DividerStandIn />,
};
