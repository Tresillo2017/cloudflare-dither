import type { CSSProperties } from "react";
import { DitherButton, type DitherButtonSize } from "@/components/dithercn/dither-button";
import type { Adapter, AdapterContext } from "../../core";
import { INK, toneFill } from "../../core/visual";
import { RIM_INK } from "./rim";
import { BUTTON_ATTRIBUTES, readButtonLook, type ButtonLook } from "./button-look";
import { buttonFillColor } from "./colors";
import { useHiddenDecor } from "./decor";
import { FOCUS_SHADOW, FillLayer } from "./fill";

const DISABLED_OPACITY = 0.45;
const SMALL_MAX_HEIGHT = 30;
const LARGE_MIN_HEIGHT = 42;

/** Maps the original's height onto a dithercn size, so the cell grid matches the button. */
const sizeFor = (height: number): DitherButtonSize => {
  if (height <= SMALL_MAX_HEIGHT) return "sm";
  if (height >= LARGE_MIN_HEIGHT) return "lg";
  return "md";
};

const opacityFor = (look: ButtonLook): number => (look.disabled ? DISABLED_OPACITY : 1);

interface SurfaceProps {
  look: ButtonLook;
  radius: string;
  cell: number;
  height: number;
  hovered: boolean;
  focused: boolean;
}

/** Emphasis buttons: the dithercn filled surface in the brand colour (or danger), under the Kumo label. */
const FilledSurface = ({ look, radius, cell, height, hovered, focused }: SurfaceProps) => (
  <FillLayer radius={radius} opacity={opacityFor(look)} focused={focused} hovered={hovered}>
    <DitherButton
      asChild
      variant="filled"
      fill="gradient"
      color={buttonFillColor(look)}
      size={sizeFor(height)}
      cell={cell}
      data-loading={look.loading ? "" : undefined}
      // border-box and inset 0: the surface fills the whole button, padding included.
      style={{ borderRadius: radius, boxSizing: "border-box", position: "absolute", inset: 0 }}
    >
      <span />
    </DitherButton>
  </FillLayer>
);

const edgeBox = (radius: string): CSSProperties => ({ borderRadius: radius, position: "absolute", inset: 0 });

/** Plain buttons are short, so their shade and sheen are shallow and never reach the label. */
const PLAIN_SHADE_CELLS = 3;
const PLAIN_SHEEN_CELLS = 2;
/**
 * Rest and hover strengths of a plain button's lit surface. Each wash is a dim tint of the page ink
 * (level = dither density, alpha = colour strength): at full ink the edge rows read as bright dashes.
 */
const PLAIN_REST = { shade: { level: 0.5, alpha: 12 }, sheen: { level: 0.3, alpha: 8 } };
const PLAIN_HOVER = { shade: { level: 0.6, alpha: 26 }, sheen: { level: 0.4, alpha: 14 } };
const washColor = (alphaPercent: number): string => `color-mix(in oklab, ${INK} ${alphaPercent}%, transparent)`;

/**
 * Secondary, outline, ghost and icon-only buttons. Every one shows the dither-button lit surface
 * at rest (shade rising from the bottom, sheen from the top) and a stronger one on hover or focus,
 * so the surface is visible without a pointer. One solid hairline rim (no dashed outline). Nothing
 * is dimmed unless the original is really disabled.
 */
const PlainSurface = ({ look, radius, cell, hovered, focused }: SurfaceProps) => {
  const level = hovered ? PLAIN_HOVER : PLAIN_REST;
  return (
    <div
      data-dcf-visual="plain"
      className="absolute inset-0"
      style={{
        borderRadius: radius,
        boxShadow: focused ? FOCUS_SHADOW : `inset 0 0 0 1px ${RIM_INK}`,
        opacity: opacityFor(look),
      }}
    >
      <div
        data-dcf-visual="plain-shade"
        style={{ ...edgeBox(radius), ...toneFill("gradient", washColor(level.shade.alpha), { cell, edge: "bottom", length: PLAIN_SHADE_CELLS, from: level.shade.level, to: 0 }) }}
      />
      <div
        data-dcf-visual="plain-sheen"
        style={{ ...edgeBox(radius), ...toneFill("gradient", washColor(level.sheen.alpha), { cell, edge: "top", length: PLAIN_SHEEN_CELLS, from: level.sheen.level, to: 0 }) }}
      />
    </div>
  );
};

/**
 * The surface under the original Kumo label. The label, icon and focus stay on top; this layer
 * only paints the look. The original keeps its own interactivity and accessibility.
 */
const ButtonStandIn = ({ ctx }: { ctx: AdapterContext }) => {
  const look = ctx.useTargetState(readButtonLook, { attributes: BUTTON_ATTRIBUTES });
  useHiddenDecor(ctx.target);
  const pseudo = ctx.useTargetPseudo();
  const radius = getComputedStyle(ctx.target).borderRadius;
  const surface: SurfaceProps = {
    cell: ctx.settings.cell,
    focused: pseudo.focusVisible,
    height: ctx.rect.height,
    hovered: pseudo.hover && !look.disabled,
    look,
    radius,
  };
  return look.kind === "filled" ? <FilledSurface {...surface} /> : <PlainSurface {...surface} />;
};

export const buttonAdapter: Adapter = {
  id: "button",
  label: "Buttons",
  group: "controls",
  ditherComponents: ["dither-button"],
  selectors: [
    {
      selector: '[data-kumo-component="Button"]',
      confidence: "high",
      source: "Kumo 2.18 button.tsx: <button data-kumo-component=\"Button\">",
    },
    {
      selector: '[data-kumo-component="LinkButton"]',
      confidence: "high",
      source: "Kumo 2.18 button.tsx: <a data-kumo-component=\"LinkButton\">",
    },
    {
      selector: '[data-kumo-component="Toolbar.Button"]',
      confidence: "med",
      source: "Kumo 2.18 toolbar.tsx: Toolbar.Button (seen on the real Workers settings page)",
    },
  ],
  defaultEnabled: true,
  maxInstances: 120,
  mode: "underlay-child",
  render: (ctx) => <ButtonStandIn ctx={ctx} />,
};
