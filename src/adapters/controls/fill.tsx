import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { DitherRim } from "../../core/dither-rim";
import { CELL_PX, ELEVATED, FALLOFF_LEVEL, toneColor } from "../../core/visual";

/** Width of a dithered rim: one cell, so the rim is one even texture on all four sides. */
export const RIM_PX = CELL_PX;

/** Mask that keeps the padding ring and drops the content box: a rim with an empty middle. */
const RIM_MASK: CSSProperties = {
  maskImage: "linear-gradient(#000 0 0), linear-gradient(#000 0 0)",
  maskClip: "content-box, border-box",
  maskComposite: "exclude",
  padding: `${RIM_PX}px`,
};

/** Solid focus ring in the brand colour, drawn inside the stand-in so no clipping cuts it. */
export const FOCUS_SHADOW = `inset 0 0 0 2px ${toneColor("brand")}`;

interface FillLayerProps {
  children: ReactNode;
  /** Corner radius copied from the original element, so the stand-in matches its shape. */
  radius: string;
  opacity?: number;
  /** Mirrors keyboard focus of the original as a solid brand ring. */
  focused?: boolean;
  /** Mirrors pointer hover of the original (the stand-in itself never receives pointer events). */
  hovered?: boolean;
  /** Keep only a dithered rim of RIM_PX around the box. The child must fill the padding box. */
  rimOnly?: boolean;
}

/**
 * Fills the stand-in host (absolute or relative, both give it a box) and carries the
 * original's radius, opacity and focus or hover state.
 */
export const FillLayer = ({
  children,
  radius,
  opacity = 1,
  focused = false,
  hovered = false,
  rimOnly = false,
}: FillLayerProps) => {
  const style: CSSProperties = {
    borderRadius: radius,
    boxShadow: focused ? FOCUS_SHADOW : undefined,
    filter: hovered ? "brightness(1.06)" : undefined,
    opacity,
    ...(rimOnly ? RIM_MASK : {}),
  };
  return (
    <div data-dcf-visual="fill" className={cn("absolute inset-0")} style={style}>
      {children}
    </div>
  );
};

interface FieldSurfaceProps {
  children: ReactNode;
  radius: string;
  /** Mirrors keyboard focus (or focus within, for wrappers around an input). */
  focused?: boolean;
  /** Mirrors pointer hover of the original. */
  hovered?: boolean;
  /** Dithered rim density, 0 to 1. */
  rimLevel?: number;
  cell: number;
}

/** Interior of a field: the Kumo elevated surface, solid, so text reads on it. */
const FIELD_INTERIOR = ELEVATED;

/**
 * A text field, select or combobox trigger: a solid interior (so the value and placeholder read
 * clearly) and a complete dithered rim of one cell on all four sides. Focus is a solid brand ring.
 */
export const FieldSurface = ({
  children,
  radius,
  focused = false,
  hovered = false,
  rimLevel = FALLOFF_LEVEL,
  cell,
}: FieldSurfaceProps) => (
  <div
    data-dcf-visual="field"
    className="absolute inset-0"
    style={{
      backgroundColor: FIELD_INTERIOR,
      borderRadius: radius,
      boxShadow: focused ? FOCUS_SHADOW : undefined,
      filter: hovered && !focused ? "brightness(1.04)" : undefined,
    }}
  >
    <DitherRim cell={cell} radius={radius} tone="ink" level={rimLevel} />
    {children}
  </div>
);
