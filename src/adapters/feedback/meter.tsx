import { Gauge } from "@/components/dithercn/gauge";
import { ProgressBar } from "@/components/dithercn/progress-bar";
import type { Adapter, AdapterContext } from "../../core";
import { progressSizeFor } from "./progress";
import { readAccessibleLabel, readNumberAttribute } from "./read";

const METER_SELECTOR = '[role="meter"]';
/** Minimum root size that reads as a usage dial rather than a bar. */
const GAUGE_MIN_WIDTH = 240;
const GAUGE_MIN_HEIGHT = 120;
const CIRCLE_MIN = 64;
const CIRCLE_TOLERANCE = 8;

/** True when a meter root is large or square enough to deserve a gauge instead of a bar. */
export const isGaugeMeter = (width: number, height: number): boolean => {
  const large = width >= GAUGE_MIN_WIDTH && height >= GAUGE_MIN_HEIGHT;
  const circular = Math.abs(width - height) <= CIRCLE_TOLERANCE && width >= CIRCLE_MIN;
  return large || circular;
};

const rootOf = (el: Element): Element | null => el.closest(METER_SELECTOR);

const isGaugeRoot = (root: Element): boolean => {
  const { width, height } = root.getBoundingClientRect();
  return isGaugeMeter(width, height);
};

/** Mirrors the meter root's value. Reads the root, since the track does not carry aria-valuenow. */
const MeterBarStandIn = ({ ctx }: { ctx: AdapterContext }) => {
  const value = ctx.useTargetState((el) => rootOf(el)?.getAttribute("aria-valuenow") ?? "", { subtree: true });
  const max = ctx.useTargetState((el) => rootOf(el)?.getAttribute("aria-valuemax") ?? "", { subtree: true });
  const current = value === "" ? null : Number(value);
  const limit = max === "" ? 100 : Number(max);
  return (
    <div data-dcf-visual="meter-bar" className="absolute inset-0">
      <ProgressBar
        label="Usage"
        hideLabel
        value={current !== null && Number.isFinite(current) ? current : null}
        max={Number.isFinite(limit) && limit > 0 ? limit : 100}
        size={progressSizeFor(ctx.rect.height)}
        animate={ctx.settings.animate}
      />
    </div>
  );
};

const MeterGaugeStandIn = ({ ctx }: { ctx: AdapterContext }) => {
  const value = ctx.useTargetState((el) => el.getAttribute("aria-valuenow") ?? "");
  const min = ctx.useTargetState((el) => el.getAttribute("aria-valuemin") ?? "");
  const max = ctx.useTargetState((el) => el.getAttribute("aria-valuemax") ?? "");
  const label = ctx.useTargetState((el) => readAccessibleLabel(el, "Usage"), { subtree: true });
  const current = Number(value);
  const low = min === "" ? 0 : Number(min);
  const high = max === "" ? 100 : Number(max);
  const ring = Math.abs(ctx.rect.width - ctx.rect.height) <= CIRCLE_TOLERANCE;
  const diameter = Math.max(64, Math.round(Math.min(ctx.rect.width, ring ? ctx.rect.height : ctx.rect.height * 2)));
  return (
    <div data-dcf-visual="meter-gauge" className="absolute inset-0 flex items-center justify-center overflow-hidden">
      <Gauge
        label={label}
        value={Number.isFinite(current) ? current : 0}
        min={Number.isFinite(low) ? low : 0}
        max={Number.isFinite(high) && high > 0 ? high : 100}
        variant={ring ? "ring" : "half"}
        size={diameter}
        animate={ctx.settings.animate}
      />
    </div>
  );
};

/** Kumo Meter track. The bar overlays the track; the label and value text stay real. */
const meterBar: Adapter = {
  id: "meter-bar",
  label: "Meter (bar)",
  group: "feedback",
  ditherComponents: ["progress-bar"],
  selectors: [{ selector: `${METER_SELECTOR} > div.h-2`, confidence: "med", source: "Kumo meter/meter.tsx Track (h-2 child of the root)" }],
  defaultEnabled: false,
  maxInstances: 50,
  match: (el) => {
    const root = rootOf(el);
    return root !== null && !isGaugeRoot(root) && readNumberAttribute(root, "aria-valuenow") !== null;
  },
  mode: "sibling-replace",
  render: (ctx) => <MeterBarStandIn ctx={ctx} />,
};

/** Large or circular meters become a dithered gauge. Replaces the whole root, so it stays off by default. */
const meterGauge: Adapter = {
  id: "meter-gauge",
  label: "Meter (gauge)",
  group: "feedback",
  ditherComponents: ["gauge"],
  selectors: [{ selector: METER_SELECTOR, confidence: "med", source: "Base UI meter root role=meter (Kumo Meter)" }],
  defaultEnabled: false,
  maxInstances: 10,
  match: (el) => readNumberAttribute(el, "aria-valuenow") !== null && isGaugeRoot(el),
  mode: "sibling-replace",
  render: (ctx) => <MeterGaugeStandIn ctx={ctx} />,
};

export const adapters: Adapter[] = [meterBar, meterGauge];
