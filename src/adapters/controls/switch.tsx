import { DitherSwitch, type DitherSwitchSize } from "@/components/dithercn/dither-switch";
import type { Adapter, AdapterContext } from "../../core";
import { toneColor } from "../../core/visual";
import { FillLayer } from "./fill";
import { useHiddenDecor } from "./decor";
import { RIM_INK } from "./rim";

/** The ON track is the Cloudflare brand blue, read live from the Kumo token. */
const SWITCH_ON_COLOR = toneColor("brand");

const SWITCH_ATTRIBUTES = ["aria-checked", "data-checked", "data-state", "disabled", "aria-disabled", "data-disabled"];
const SMALL_MAX_HEIGHT = 22;
const LARGE_MIN_HEIGHT = 28;

export interface SwitchLook {
  readonly checked: boolean;
  readonly disabled: boolean;
}

/** Kumo (Base UI) marks the on state with aria-checked and data-checked. */
export const readSwitchLook = (el: Element): SwitchLook => ({
  checked: el.getAttribute("aria-checked") === "true" || el.hasAttribute("data-checked"),
  disabled:
    el.hasAttribute("disabled") ||
    el.getAttribute("aria-disabled") === "true" ||
    el.hasAttribute("data-disabled"),
});

const sizeFor = (height: number): DitherSwitchSize => {
  if (height <= SMALL_MAX_HEIGHT) return "sm";
  if (height >= LARGE_MIN_HEIGHT) return "lg";
  return "md";
};

/**
 * A dithered track that follows the original's checked and disabled state. ON is the brand-blue
 * dither wave filled across the whole track; OFF is the empty grey track. The knob stays solid.
 */
const SwitchStandIn = ({ ctx }: { ctx: AdapterContext }) => {
  // Subscribes to attribute changes. The value is read fresh in render (see below).
  ctx.useTargetState(readSwitchLook, { attributes: SWITCH_ATTRIBUTES });
  useHiddenDecor(ctx.target);
  const look = readSwitchLook(ctx.target);
  const pseudo = ctx.useTargetPseudo();
  const radius = `${ctx.rect.height / 2}px`;
  return (
    <FillLayer radius={radius} focused={pseudo.focusVisible}>
      {look.checked ? null : (
        <div
          data-dcf-visual="switch-off-rim"
          className="absolute inset-0"
          style={{ borderRadius: radius, boxShadow: `inset 0 0 0 1px ${RIM_INK}` }}
        />
      )}
      <div className="flex size-full items-center justify-center">
        <DitherSwitch
          checked={look.checked}
          disabled={look.disabled}
          color={SWITCH_ON_COLOR}
          size={sizeFor(ctx.rect.height)}
          cell={ctx.settings.cell}
        />
      </div>
    </FillLayer>
  );
};

export const switchAdapter: Adapter = {
  id: "switch",
  label: "Switches",
  group: "controls",
  ditherComponents: ["dither-switch"],
  selectors: [
    {
      selector: '[role="switch"]',
      confidence: "high",
      source: "Kumo 2.18 switch.tsx (track button, role=switch); WAI-ARIA switch role",
    },
  ],
  defaultEnabled: true,
  maxInstances: 120,
  mode: "underlay-child",
  render: (ctx) => <SwitchStandIn ctx={ctx} />,
};
