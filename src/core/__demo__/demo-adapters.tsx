import { DitherButton } from "@/components/dithercn/dither-button";
import type { Adapter, AdapterContext } from "../types";

/** Mirrors the aria-checked state of the original switch into a visual stand-in. */
const DemoUnderlayView = ({ ctx }: { ctx: AdapterContext }) => {
  const state = ctx.useTargetState((el) => el.getAttribute("aria-checked") ?? "none");
  return (
    <div
      data-demo-visual="underlay"
      data-state={state}
      data-theme={ctx.theme}
      className="absolute inset-0 rounded-md bg-primary/20"
    />
  );
};

const DemoSiblingView = ({ ctx }: { ctx: AdapterContext }) => {
  const label = ctx.useTargetState((el) => el.textContent ?? "", { subtree: true });
  return (
    <div data-demo-visual="sibling" className="size-full">
      <DitherButton variant="filled">{label}</DitherButton>
    </div>
  );
};

const DemoBoomView = (): never => {
  throw new Error("demo boom: intentional render failure");
};

const DemoPlainView = ({ name }: { name: string }) => (
  <div data-demo-visual={name} className="absolute inset-0 bg-primary/10" />
);

const underlay: Adapter = {
  id: "demo-underlay",
  label: "Demo underlay",
  group: "controls",
  ditherComponents: [],
  selectors: [{ selector: '[data-demo="underlay"]', confidence: "high", source: "core demo" }],
  defaultEnabled: true,
  mode: "underlay-child",
  render: (ctx) => <DemoUnderlayView ctx={ctx} />,
};

const sibling: Adapter = {
  id: "demo-sibling",
  label: "Demo sibling",
  group: "controls",
  ditherComponents: ["dither-button"],
  selectors: [{ selector: '[data-demo="sibling"]', confidence: "high", source: "core demo" }],
  defaultEnabled: true,
  mode: "sibling-replace",
  render: (ctx) => <DemoSiblingView ctx={ctx} />,
};

const boom: Adapter = {
  id: "demo-boom",
  label: "Demo boom",
  group: "feedback",
  ditherComponents: [],
  selectors: [{ selector: '[data-demo="boom"]', confidence: "high", source: "core demo" }],
  defaultEnabled: true,
  mode: "underlay-child",
  render: () => <DemoBoomView />,
};

const capped: Adapter = {
  id: "demo-capped",
  label: "Demo capped",
  group: "feedback",
  ditherComponents: [],
  selectors: [{ selector: '[data-demo="capped"]', confidence: "high", source: "core demo" }],
  defaultEnabled: true,
  maxInstances: 2,
  mode: "underlay-child",
  render: () => <DemoPlainView name="capped" />,
};

const far: Adapter = {
  id: "demo-far",
  label: "Demo far",
  group: "surfaces",
  ditherComponents: [],
  selectors: [{ selector: '[data-demo="far"]', confidence: "high", source: "core demo" }],
  defaultEnabled: true,
  mode: "underlay-child",
  render: () => <DemoPlainView name="far" />,
};

export const demoAdapters: Adapter[] = [underlay, sibling, boom, capped, far];
