import { EmptyState } from "@/components/dithercn/empty-state";
import type { Adapter } from "../../core";

const TEXT_OR_CONTROL = "h1,h2,h3,h4,p,button,a,input,select,textarea";

/**
 * Kumo Empty puts its optional icon first, before the heading block. Only that icon is a candidate.
 * With no icon (the common case) nothing matches, so the adapter does nothing.
 */
const isIconSlot = (el: Element): boolean => {
  if (el.querySelector(TEXT_OR_CONTROL) !== null) return false;
  const heading = el.parentElement?.querySelector("h2");
  if (!heading) return false;
  const { width, height } = el.getBoundingClientRect();
  return width >= 16 && height >= 16;
};

const emptyIcon: Adapter = {
  id: "empty-icon",
  label: "Empty state (icon art)",
  group: "feedback",
  ditherComponents: ["empty-state"],
  selectors: [
    { selector: "div.rounded-xl.border-kumo-fill.bg-kumo-control > :first-child", confidence: "med", source: "Kumo empty/empty.tsx emptyVariants + icon slot" },
  ],
  defaultEnabled: false,
  maxInstances: 10,
  match: isIconSlot,
  mode: "sibling-replace",
  render: (ctx) => (
    <div data-dcf-visual="empty" className="absolute inset-0 flex items-center justify-center overflow-hidden">
      <EmptyState
        illustration="box"
        title=""
        className="w-full gap-0 !px-0 !py-0 [&_h3]:hidden"
        animate={ctx.settings.animate}
      />
    </div>
  ),
};

export const adapters: Adapter[] = [emptyIcon];
