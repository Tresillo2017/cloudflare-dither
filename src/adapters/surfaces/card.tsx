import { DitherCard } from "@/components/dithercn/dither-card";
import type { Adapter, AdapterContext } from "../../core";
import { DitherRim } from "../../core/dither-rim";
import { CELL_PX, ELEVATED, PAPER, toneColor } from "../../core/visual";
import { planGlow, readContentBoxes } from "./card-glow";
import { cornerRadius, glowReach, isSurfaceSized } from "./geometry";

/**
 * Card treatment: an opaque surface (the original's own background is hidden by the underlay),
 * a dithered brand glow in the corner with the most free space, and one complete rim on all four
 * sides (DitherRim: a solid hairline plus a faint falloff on every edge). The falloff is kept deep
 * and low so it reads as texture; a shallow mid-level dither reads as dashes on the real pages.
 * The glow never reaches text, controls, icons or charts (card-glow.ts).
 */
const GLOW_STRENGTH = 0.5;
const CARD_CLASSES = "absolute inset-0 size-full gap-0 border-transparent bg-transparent py-0 shadow-none";
const SURFACE_CLASS = "bg-kumo-elevated";
/** Layout signature of the target's content, so text edits re-run the glow placement. */
const contentSignature = (el: Element): number => el.textContent?.length ?? 0;

const TABLE_SELECTOR = 'table, [role="table"]';

/** Opaque surface of the original, read from its Kumo class (its computed background is already hidden). */
const surfaceColor = (el: Element): string => (el.classList.contains(SURFACE_CLASS) ? ELEVATED : PAPER);

export const CardStandIn = ({ ctx }: { ctx: AdapterContext }) => {
  const radius = ctx.useTargetState((el) => cornerRadius(el), { attributes: ["class", "style"] });
  const surface = ctx.useTargetState((el) => surfaceColor(el), { attributes: ["class"] });
  ctx.useTargetState(contentSignature, { subtree: true });
  const box = ctx.target.getBoundingClientRect();
  // A table fills its card edge to edge with opaque cells, so a corner glow would be cut into a blob.
  const holdsTable = ctx.target.querySelector(TABLE_SELECTOR) !== null;
  const plan = holdsTable ? null : planGlow(box, readContentBoxes(ctx.target), glowReach(ctx.rect));
  return (
    <div data-dcf-visual="card" className="absolute inset-0 size-full">
      <div className="absolute inset-0" style={{ backgroundColor: surface, borderRadius: radius }} />
      {plan === null ? null : (
        <DitherCard
          className={CARD_CLASSES}
          glow={plan.glow}
          reach={plan.reach}
          strength={GLOW_STRENGTH}
          color={toneColor("brand")}
          radius={radius}
          cell={CELL_PX}
          rim={false}
        />
      )}
      <DitherRim cell={CELL_PX} radius={`${radius}px`} tone="ink" />
    </div>
  );
};

/** Cards whose own ancestor is already a card target: the outer surface gets the treatment. */
export const CARD_SELECTOR = [
  '[class~="ring-kumo-line"][class~="rounded-lg"]',
  '[class~="ring-kumo-fill"][class~="rounded-lg"]',
  '[data-sentry-component="ChartCardStandard"]',
  '[data-sentry-component="ChartCardLayered"]',
  '[data-sentry-component="TileFrame"]',
  '[data-sentry-component="DnsRecordsHeaderInner"]',
  '[data-sentry-component="RecommendationsPanel"]',
  '[data-sentry-component="SettingsCard"]',
  '[data-sentry-component="AsideCard"]',
  '[data-sentry-component="OverviewCard"]',
  '[data-sentry-component="ProductUsagePanel"]',
  '[data-sentry-component="DeploymentActivityCard"]',
].join(",");

const isNestedInStandIn = (el: Element): boolean => el.closest("[data-dcf-host]") !== null;
const hasCardAncestor = (el: Element): boolean => el.parentElement?.closest(CARD_SELECTOR) != null;

export const cardAdapter: Adapter = {
  id: "card",
  label: "Cards, panels and dialogs",
  group: "surfaces",
  ditherComponents: ["dither-card"],
  selectors: [
    { selector: '[class~="ring-kumo-line"][class~="rounded-lg"]', confidence: "med", source: "Kumo LayerCard single surface (layer-card.tsx)" },
    { selector: '[class~="ring-kumo-fill"][class~="rounded-lg"]', confidence: "med", source: "Kumo LayerCard.Primary (layer-card.tsx)" },
    { selector: '[data-sentry-component="ChartCardStandard"]', confidence: "high", source: "Cloudflare ChartCardStandard (real analytics, home)" },
    { selector: '[data-sentry-component="TileFrame"]', confidence: "high", source: "Cloudflare TileFrame (real home stat tiles)" },
    { selector: '[data-sentry-component="DnsRecordsHeaderInner"]', confidence: "high", source: "Cloudflare DNS header LayerCard (real DNS page)" },
    { selector: '[data-sentry-component="RecommendationsPanel"]', confidence: "high", source: "Cloudflare RecommendationsPanel (real DNS page)" },
    { selector: '[data-sentry-component="SettingsCard"]', confidence: "high", source: "Cloudflare SettingsCard (real Worker settings)" },
    { selector: '[data-sentry-component="OverviewCard"]', confidence: "med", source: "Cloudflare OverviewCard (real Worker overview)" },
    { selector: '[role="dialog"]', confidence: "med", source: "Base UI Dialog and Popover popup (role=dialog)" },
  ],
  defaultEnabled: true,
  maxInstances: 80,
  match: (el) => !isNestedInStandIn(el) && !hasCardAncestor(el) && isSurfaceSized(el),
  mode: "underlay-child",
  render: (ctx) => <CardStandIn ctx={ctx} />,
};
