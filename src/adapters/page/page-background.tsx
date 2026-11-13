import type { ReactNode } from "react";
import { isAdapterEnabled, type Adapter, type AdapterContext } from "../../core";
import { BackgroundLayer, useTranslucentCanvas } from "./background-layer";
import { BACKGROUND_IDS, resolveBackground } from "./backgrounds";
import { isHeroPath, usePathname } from "./route";
import { heroAdapter } from "./page-hero";

/** Strength of the app background over the canvas, from the intensity setting. */
const intensityOpacity = (intensity: number): number => 0.2 + 0.8 * intensity;

/**
 * The field runs under the whole page, text included, so it is drawn as a low-contrast texture:
 * dots only a few steps away from the paper. These are the layer strengths at full intensity.
 */
export const DARK_THEME_DENSITY = 0.2;
/** Light theme dots are dark on white, so the same setting reads louder. */
export const LIGHT_THEME_DENSITY = 0.12;

export const backgroundOpacity = (intensity: number, theme: "light" | "dark"): number =>
  intensityOpacity(intensity) * (theme === "light" ? LIGHT_THEME_DENSITY : DARK_THEME_DENSITY);

const PageBackgroundLayer = ({ ctx }: { ctx: AdapterContext }) => {
  const pathname = usePathname();
  const heroShown = isAdapterEnabled(ctx.settings, heroAdapter) && isHeroPath(pathname);
  useTranslucentCanvas(!heroShown);
  if (heroShown) return null;
  return (
    <BackgroundLayer
      backgroundId={resolveBackground(ctx.settings.background)}
      opacity={backgroundOpacity(ctx.settings.intensity, ctx.theme)}
      cell={ctx.settings.cell}
      animate={ctx.settings.animate}
      visual="page-background"
    />
  );
};

/** App-wide dithered background behind the dashboard. Only one background shader is mounted. */
export const pageBackgroundAdapter: Adapter = {
  id: "page-background",
  label: "Page background",
  group: "page",
  ditherComponents: BACKGROUND_IDS,
  selectors: [{ selector: "body", confidence: "high", source: "document body, page-level layer" }],
  // Off by default: the dashboard keeps Cloudflare's own page background. Opt in from the settings panel.
  defaultEnabled: false,
  maxInstances: 1,
  mode: "overlay-fixed",
  render: (ctx): ReactNode => <PageBackgroundLayer ctx={ctx} />,
};
