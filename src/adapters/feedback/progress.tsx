import { ProgressBar, type ProgressBarSize } from "@/components/dithercn/progress-bar";
import type { Adapter, AdapterContext } from "../../core";

/** Fraction of the bar that is filled, clamped to 0..1. */
export const progressShare = (value: number, limit: number): number =>
  Math.min(1, Math.max(0, value / limit));

/** Picks a dithercn bar size that matches the original track height. */
export const progressSizeFor = (height: number): ProgressBarSize => {
  if (height <= 10) return "sm";
  if (height <= 18) return "md";
  return "lg";
};

const ProgressStandIn = ({ ctx }: { ctx: AdapterContext }) => {
  const value = ctx.useTargetState((el) => el.getAttribute("value") ?? el.getAttribute("aria-valuenow") ?? "");
  const max = ctx.useTargetState((el) => el.getAttribute("max") ?? el.getAttribute("aria-valuemax") ?? "");
  const current = value === "" ? null : Number(value);
  const limit = max === "" ? 100 : Number(max);
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 100;
  const hasValue = current !== null && Number.isFinite(current);
  const share = hasValue ? progressShare(current, safeLimit) : 0;
  return (
    <div data-dcf-visual="progress" className="absolute inset-0">
      <ProgressBar
        label="Progress"
        hideLabel
        value={hasValue ? current : null}
        max={safeLimit}
        size={progressSizeFor(ctx.rect.height)}
        animate={ctx.settings.animate}
      />
      {hasValue ? (
        <div
          data-dcf-visual="progress-value"
          className="absolute inset-y-0 left-0 bg-primary"
          style={{ width: `${share * 100}%` }}
        />
      ) : null}
    </div>
  );
};

/** Hides the original progress element and overlays a dithered bar with the same value. */
const nativeProgress: Adapter = {
  id: "progress-native",
  label: "Progress (native)",
  group: "feedback",
  ditherComponents: ["progress-bar"],
  selectors: [{ selector: "progress", confidence: "high", source: "HTML <progress> element" }],
  defaultEnabled: true,
  maxInstances: 50,
  mode: "sibling-replace",
  render: (ctx) => <ProgressStandIn ctx={ctx} />,
};

/** ARIA progressbar role on non-native elements, e.g. custom bars. */
const roleProgress: Adapter = {
  id: "progress-role",
  label: "Progress (ARIA role)",
  group: "feedback",
  ditherComponents: ["progress-bar"],
  selectors: [{ selector: '[role="progressbar"]:not(progress)', confidence: "med", source: "WAI-ARIA progressbar role" }],
  defaultEnabled: true,
  maxInstances: 50,
  mode: "sibling-replace",
  render: (ctx) => <ProgressStandIn ctx={ctx} />,
};

export const adapters: Adapter[] = [nativeProgress, roleProgress];
