import { useEffect, useState } from "react";
import type { Adapter, AdapterContext } from "../../core";
import { FieldSurface } from "./fill";

const FIELD_ATTRIBUTES = ["class", "style", "disabled", "aria-disabled", "data-state", "aria-expanded"];

/** True while keyboard focus is anywhere inside the element (the input inside a search wrapper). */
const useFocusWithin = (target: Element): boolean => {
  const [within, setWithin] = useState(false);
  useEffect(() => {
    const onIn = () => setWithin(true);
    const onOut = (event: Event) => {
      const next = (event as FocusEvent).relatedTarget;
      setWithin(next instanceof Node && target.contains(next));
    };
    target.addEventListener("focusin", onIn, { passive: true });
    target.addEventListener("focusout", onOut, { passive: true });
    return () => {
      target.removeEventListener("focusin", onIn);
      target.removeEventListener("focusout", onOut);
    };
  }, [target]);
  return within;
};

/**
 * A select, combobox trigger or search field: a solid interior and a dithered rim on all four sides,
 * a solid brand focus ring. The original keeps its label, value and input on top.
 */
const FieldStandIn = ({ ctx }: { ctx: AdapterContext }) => {
  ctx.useTargetState((el) => el.getAttribute("aria-expanded"), { attributes: FIELD_ATTRIBUTES });
  const pseudo = ctx.useTargetPseudo();
  const within = useFocusWithin(ctx.target);
  const radius = getComputedStyle(ctx.target).borderRadius;
  return (
    <FieldSurface
      radius={radius}
      cell={ctx.settings.cell}
      focused={pseudo.focusVisible || within}
      hovered={pseudo.hover}
    >
      <span />
    </FieldSurface>
  );
};

const fieldAdapter = (
  id: string,
  label: string,
  selectors: Adapter["selectors"],
): Adapter => ({
  id,
  label,
  group: "controls",
  ditherComponents: [],
  selectors,
  defaultEnabled: true,
  maxInstances: 60,
  mode: "underlay-child",
  render: (ctx) => <FieldStandIn ctx={ctx} />,
});

/** Select and combobox triggers are buttons: the field surface sits under their label and chevron. */
export const selectAdapter: Adapter = fieldAdapter("select", "Selects and comboboxes", [
  {
    selector: 'button[data-kumo-component="Select"][data-kumo-part="trigger"]',
    confidence: "high",
    source: "Kumo 2.18 select.tsx trigger (real DNS and analytics pages)",
  },
  {
    selector: 'button[data-kumo-component="Combobox"][data-kumo-part="trigger"]',
    confidence: "med",
    source: "Kumo 2.18 combobox trigger (real Workers list page)",
  },
]);

/** Search fields: the wrapper around the input is the target (an input cannot hold an underlay). */
export const searchFieldAdapter: Adapter = fieldAdapter("search-field", "Search fields", [
  {
    selector: '[data-sentry-component="SearchInput"]',
    confidence: "high",
    source: "Cloudflare SearchInput wrapper (real /home page, input inside)",
  },
]);
