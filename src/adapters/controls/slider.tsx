import { useEffect, useReducer } from "react";
import { DitherSlider } from "@/components/dithercn/dither-slider";
import type { Adapter, AdapterContext } from "../../core";
import { readSliderLook, SLIDER_ATTRIBUTES, isBaseUiSliderRoot, isNativeSlider } from "./slider-look";
import { FillLayer } from "./fill";

/** Native `input` events carry value changes that produce no attribute mutation. */
const INPUT_EVENTS = ["input", "change"] as const;

const useInputTick = (target: Element): void => {
  const [, bump] = useReducer((tick: number) => tick + 1, 0);
  useEffect(() => {
    for (const type of INPUT_EVENTS) target.addEventListener(type, bump, { passive: true });
    return () => {
      for (const type of INPUT_EVENTS) target.removeEventListener(type, bump);
    };
  }, [target]);
};

/** A dithered slider overlay (sibling-replace) that mirrors the original's values. */
const SliderStandIn = ({ ctx }: { ctx: AdapterContext }) => {
  ctx.useTargetState(readSliderLook, { attributes: SLIDER_ATTRIBUTES, subtree: true });
  useInputTick(ctx.target);
  const look = readSliderLook(ctx.target);
  return (
    <FillLayer radius="0px">
      <div className="size-full p-1">
        <DitherSlider
          label={look.label}
          value={[...look.values]}
          min={look.min}
          max={look.max}
          step={look.step}
          disabled={look.disabled}
          cell={ctx.settings.cell}
          className="w-full"
        />
      </div>
    </FillLayer>
  );
};

export const sliderAdapter: Adapter = {
  id: "slider",
  label: "Sliders",
  group: "controls",
  ditherComponents: ["dither-slider"],
  selectors: [
    {
      selector: 'input[type="range"]',
      confidence: "high",
      source: "native range input (HTML)",
    },
    {
      selector: '[data-orientation]:has(input[type="range"])',
      confidence: "med",
      source: "Base UI 1.9 slider root (data-orientation) whose thumbs are range inputs; Kumo Slider",
    },
    {
      selector: '[data-orientation]:has([role="slider"])',
      confidence: "med",
      source: "slider root (data-orientation) with explicit role=slider thumbs",
    },
  ],
  defaultEnabled: true,
  maxInstances: 40,
  match: (el) => isNativeSlider(el) || isBaseUiSliderRoot(el),
  mode: "sibling-replace",
  render: (ctx) => <SliderStandIn ctx={ctx} />,
};
