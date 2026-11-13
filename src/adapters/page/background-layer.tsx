import { useEffect, type CSSProperties } from "react";
import { acquireTranslucentCanvas } from "./canvas-sheet";
import { BACKGROUNDS, type BackgroundId } from "./backgrounds";

export interface BackgroundLayerProps {
  readonly backgroundId: BackgroundId;
  /** 0..1 strength of the layer over the page. */
  readonly opacity: number;
  readonly cell: number;
  /** Requested motion. Heavy shaders are always still, regardless. Engine handles reduced motion. */
  readonly animate: boolean;
  readonly visual: string;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/** One fixed, full-viewport dithercn background. Rendered only by page-level adapters. */
export const BackgroundLayer = ({ backgroundId, opacity, cell, animate, visual }: BackgroundLayerProps) => {
  const entry = BACKGROUNDS[backgroundId];
  const Component = entry.component;
  const style: CSSProperties = { opacity: clamp01(opacity) };
  const motion = animate && entry.cost !== "heavy";
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={style} data-dcf-visual={visual} data-dcf-bg-id={backgroundId}>
      <Component {...entry.props} cell={cell} animate={motion} className="absolute inset-0 h-full w-full" />
    </div>
  );
};

/** Keeps the Kumo canvas translucent while `active`. Releases on change and on unmount. */
export const useTranslucentCanvas = (active: boolean): void => {
  useEffect(() => {
    if (!active) return undefined;
    return acquireTranslucentCanvas();
  }, [active]);
};
