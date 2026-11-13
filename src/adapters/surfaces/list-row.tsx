import type { Adapter, AdapterContext } from "../../core";
import { DitherRule } from "../../core/dither-rim";
import { cellFor } from "../../core/visual";
import { leadingRamp, tintStyle } from "./sidebar-band";

const MAX_ROWS = 80;
const HOVER_TINT = 9;
const HOVER_RAMP_PX = 48;
const HOVER_RAMP_FROM = 0.5;
/** Row dividers: a solid hairline plus a shallow, faint falloff below it. */
const ROW_FALLOFF_CELLS = 3;
const ROW_FALLOFF_LEVEL = 0.3;

/** Whether a row has a row above it (the first row has none, so it gets no divider). */
const hasRowAbove = (el: Element): boolean => el.previousElementSibling !== null;

/**
 * Row of a column list (Domains, Workers, Recents). Hover shows a brand band with a dithered
 * leading edge, and every row after the first gets a dithered divider along its top edge.
 */
const RowStandIn = ({ ctx }: { ctx: AdapterContext }) => {
  const { hover } = ctx.useTargetPseudo();
  const cell = cellFor(ctx.rect.height);
  const divided = hasRowAbove(ctx.target);
  return (
    <div data-dcf-visual="list-row" data-hover={String(hover)} className="absolute inset-0 overflow-hidden">
      {hover ? (
        <>
          <div className="absolute inset-0" style={tintStyle("brand", HOVER_TINT)} />
          <div className="absolute inset-0" style={leadingRamp("brand", cell, HOVER_RAMP_PX, HOVER_RAMP_FROM)} />
        </>
      ) : null}
      {divided ? <DitherRule edge="top" cell={cell} tone="ink" depth={ROW_FALLOFF_CELLS} level={ROW_FALLOFF_LEVEL} /> : null}
    </div>
  );
};

export const listRowAdapter: Adapter = {
  id: "list-row",
  label: "List rows (hover band and dividers)",
  group: "surfaces",
  ditherComponents: [],
  selectors: [
    {
      selector: '[data-sentry-component="ShortcutColumnFrame"] li',
      confidence: "high",
      source: "Account home column rows (ShortcutColumnFrame.tsx > ul > div > li)",
    },
  ],
  defaultEnabled: true,
  maxInstances: MAX_ROWS,
  match: (el) => el.closest("[data-dcf-host]") === null && el.querySelector("a") !== null,
  mode: "underlay-child",
  render: (ctx) => <RowStandIn ctx={ctx} />,
};
