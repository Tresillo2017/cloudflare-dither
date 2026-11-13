import type { Adapter, AdapterContext } from "../../core";
import { DitherRule } from "../../core/dither-rim";
import { CELL_PX, ditherFill } from "../../core/visual";
import { opaqueBackdrop } from "./backdrop";

const MAX_HEAD_CELLS = 120;
const MAX_ROWS = 300;
const HEAD_RULE_PX = 2;
const HEAD_SHADE_LEVEL = 0.5;
/** Shallow shade, so the dither stays under the header text baseline. */
const HEAD_SHADE_CELLS = 2;
const ROW_WASH_LEVEL = 0.2;

/** Header cells, Kumo <thead>, and the ARIA grid markup used by the DNS records table. */
const HEAD_SELECTOR = 'thead th, [role="columnheader"]';
/** Body rows: Kumo <tbody>, and ARIA rows that are not inside the header rowgroup. */
const ROW_SELECTOR = '[role="table"] [role="row"][aria-rowindex]:not([data-table-header="true"] *), tbody tr';
/** The stand-in lives inside the target; anything already inside a host is never treated as a table cell. */
const NOT_IN_HOST = "[data-dcf-host]";

/**
 * Opaque base under the cells: the original's own colour where it has one, else the nearest
 * opaque ancestor (a legacy row on a white card stays white), else the theme background token.
 * The underlay makes the target transparent before render, so the walk starts at the target.
 */
const baseStyle = (ctx: AdapterContext): { backgroundColor?: string; className?: string } => {
  const color = opaqueBackdrop(ctx.target);
  return color === null ? { className: "bg-background" } : { backgroundColor: color };
};

/**
 * Header cells. The underlay removes the native header background, so an opaque base is
 * painted first: page dithering must never show through the header text. A 2px brand rule
 * closes the band, with a dithered shade rising from it.
 */
const HeadStandIn = ({ ctx }: { ctx: AdapterContext }) => {
  const base = baseStyle(ctx);
  return (
    <div
      data-dcf-visual="table-head"
      className={`absolute inset-0 overflow-hidden ${base.className ?? ""}`}
      style={{ backgroundColor: base.backgroundColor }}
    >
      <DitherRule edge="bottom" cell={CELL_PX} tone="brand" thickness={HEAD_RULE_PX} depth={HEAD_SHADE_CELLS} level={HEAD_SHADE_LEVEL} />
    </div>
  );
};

/**
 * Row: an opaque base (so page dithering never sits behind cell text). The native cell
 * separators stay solid; the dithered wash appears only while the row is hovered.
 */
const RowStandIn = ({ ctx }: { ctx: AdapterContext }) => {
  const { hover } = ctx.useTargetPseudo();
  const base = baseStyle(ctx);
  return (
    <div
      data-dcf-visual="table-row"
      data-hover={String(hover)}
      className={`absolute inset-0 overflow-hidden ${base.className ?? ""}`}
      style={{ backgroundColor: base.backgroundColor }}
    >
      {hover ? <div className="absolute inset-0" style={ditherFill("brand", ROW_WASH_LEVEL, CELL_PX)} /> : null}
    </div>
  );
};

export const tableHeadAdapter: Adapter = {
  id: "table-head",
  label: "Table header band",
  group: "surfaces",
  ditherComponents: [],
  selectors: [
    { selector: "thead th", confidence: "high", source: "Kumo Table.Head (table > thead)" },
    { selector: '[role="columnheader"]', confidence: "high", source: "ARIA grid header cell (real DNS records table)" },
  ],
  defaultEnabled: true,
  maxInstances: MAX_HEAD_CELLS,
  match: (el) => el.closest(NOT_IN_HOST) === null && el.closest('[role="table"], table') !== null,
  mode: "underlay-child",
  render: (ctx) => <HeadStandIn ctx={ctx} />,
};

export const tableRowAdapter: Adapter = {
  id: "table-row",
  label: "Table row hover",
  group: "surfaces",
  ditherComponents: [],
  selectors: [
    { selector: "tbody tr", confidence: "high", source: "Kumo Table.Body rows" },
    { selector: '[role="table"] [role="row"][aria-rowindex]', confidence: "high", source: "ARIA grid body rows (real DNS records table)" },
  ],
  defaultEnabled: true,
  maxInstances: MAX_ROWS,
  match: (el) => el.closest(NOT_IN_HOST) === null && el.matches(ROW_SELECTOR),
  mode: "underlay-child",
  render: (ctx) => <RowStandIn ctx={ctx} />,
};
