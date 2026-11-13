import type { Adapter, AdapterContext } from "../../core";
import { DitherRule } from "../../core/dither-rim";
import { CELL_PX_SMALL, type Tone } from "../../core/visual";
import { tintStyle } from "./sidebar-band";

const MAX_BADGES = 80;
const TINT = 26;
/** Pills are short: a one-cell falloff under a solid hairline keeps the label clear. */
const EDGE_DEPTH = 1;
const SIDEBAR = 'aside[data-sidebar="sidebar"]';
const STATUS_CLASSES: readonly [RegExp, Tone][] = [
  [/kumo-danger/, "danger"],
  [/kumo-success/, "success"],
  [/kumo-warning/, "warning"],
  [/kumo-(brand|info)/, "brand"],
];

/**
 * Tone of a badge, read from the original. Keyboard hints stay neutral. Badges in the sidebar
 * ("New", "Beta") take the brand. Others follow the status colour class Kumo put on them.
 */
export const badgeTone = (el: Element): Tone => {
  if (el.tagName === "KBD") return "neutral";
  if (el.closest(SIDEBAR) !== null) return "brand";
  const className = el.getAttribute("class") ?? "";
  return STATUS_CLASSES.find(([pattern]) => pattern.test(className))?.[1] ?? "neutral";
};

/**
 * Pill: a solid tint of the status colour as the backing, with a dithered strip on the bottom
 * edge only. Pills are too small for a shade to rise behind the label, so nothing sits under it.
 */
const BadgeStandIn = ({ ctx }: { ctx: AdapterContext }) => {
  const tone = ctx.useTargetState(badgeTone, { attributes: ["class"] });
  return (
    <div data-dcf-visual="badge" data-tone={tone} className="absolute inset-0 overflow-hidden rounded-[inherit]">
      <div className="absolute inset-0" style={tintStyle(tone, TINT)} />
      <DitherRule edge="bottom" cell={CELL_PX_SMALL} tone={tone} depth={EDGE_DEPTH} />
    </div>
  );
};

export const badgeAdapter: Adapter = {
  id: "badge",
  label: "Badges, status chips and key hints",
  group: "surfaces",
  ditherComponents: [],
  selectors: [
    { selector: '[data-kumo-component="Badge"]', confidence: "high", source: "Kumo Badge (count pills, New/Beta, status)" },
    { selector: '[data-sentry-component="Kbd"]', confidence: "high", source: "Cloudflare Kbd (key hints)" },
    { selector: "kbd", confidence: "med", source: "native kbd" },
    {
      selector: '[class~="border-dashed"][class~="rounded-full"]',
      confidence: "med",
      source: "Cloudflare sidebar New/Beta pill (inline-flex rounded-full border border-dashed border-kumo-line)",
    },
  ],
  defaultEnabled: true,
  maxInstances: MAX_BADGES,
  match: (el) => el.closest("[data-dcf-host]") === null,
  mode: "underlay-child",
  render: (ctx) => <BadgeStandIn ctx={ctx} />,
};
