import type { Adapter, AdapterContext } from "../../core";
import { PAPER, highlightStyle, shadeStyle, toneColor } from "../../core/visual";
import { RIM_INK } from "./rim";
import { FOCUS_SHADOW } from "./fill";

const CHECKBOX_ATTRIBUTES = ["aria-checked", "data-checked", "data-state", "data-unchecked", "disabled", "aria-disabled"];

/** Kumo (Base UI) marks the checked state with aria-checked, data-checked or data-state="checked". */
export const isCheckboxChecked = (el: Element): boolean =>
  el.getAttribute("aria-checked") === "true" ||
  el.hasAttribute("data-checked") ||
  el.getAttribute("data-state") === "checked";

/**
 * A dithered checked fill: solid brand blue with a dithered shade rising from the bottom and a
 * sheen from the top. The check mark is the original Kumo icon, which stays on top, solid.
 * Unchecked: a solid one-pixel rim on the paper colour, so the box never looks empty or dashed.
 */
const CheckboxStandIn = ({ ctx }: { ctx: AdapterContext }) => {
  const checked = ctx.useTargetState(isCheckboxChecked, { attributes: CHECKBOX_ATTRIBUTES });
  const pseudo = ctx.useTargetPseudo();
  const radius = getComputedStyle(ctx.target).borderRadius;
  const cell = ctx.settings.cell;
  const focusShadow = pseudo.focusVisible ? FOCUS_SHADOW : undefined;
  if (!checked) {
    return (
      <div
        data-dcf-visual="checkbox-off"
        className="absolute inset-0"
        style={{ backgroundColor: PAPER, borderRadius: radius, boxShadow: focusShadow ?? `inset 0 0 0 1px ${RIM_INK}` }}
      />
    );
  }
  return (
    <div data-dcf-visual="checkbox-on" className="absolute inset-0" style={{ borderRadius: radius, boxShadow: focusShadow }}>
      <div className="absolute inset-0" style={{ backgroundColor: toneColor("brand"), borderRadius: radius }} />
      <div className="absolute inset-0" style={{ ...shadeStyle("brand", cell), borderRadius: radius }} />
      <div className="absolute inset-0" style={{ ...highlightStyle("brand", cell), borderRadius: radius }} />
    </div>
  );
};

export const checkboxAdapter: Adapter = {
  id: "checkbox",
  label: "Checkboxes",
  group: "controls",
  ditherComponents: [],
  selectors: [
    {
      selector: '[role="checkbox"][data-kumo-component="Checkbox"]',
      confidence: "high",
      source: "Kumo 2.18 checkbox.tsx (real Workers settings and DNS pages: span role=checkbox)",
    },
  ],
  defaultEnabled: true,
  maxInstances: 120,
  mode: "underlay-child",
  render: (ctx) => <CheckboxStandIn ctx={ctx} />,
};

