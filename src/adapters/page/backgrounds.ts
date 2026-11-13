import type { ComponentType } from "react";
import { Aurora } from "@/components/dithercn/aurora";
import { Beams } from "@/components/dithercn/beams";
import { BlackHole } from "@/components/dithercn/black-hole";
import { Contours } from "@/components/dithercn/contours";
import { DitherFade } from "@/components/dithercn/dither-fade";
import { DitherGlobe } from "@/components/dithercn/dither-globe";
import { DitherGlow } from "@/components/dithercn/dither-glow";
import { DitherGradient } from "@/components/dithercn/dither-gradient";
import { DitherOrb } from "@/components/dithercn/dither-orb";
import { DotMap } from "@/components/dithercn/dot-map";
import { Eclipse } from "@/components/dithercn/eclipse";
import { Fire } from "@/components/dithercn/fire";
import { FlowField } from "@/components/dithercn/flow-field";
import { Galaxy } from "@/components/dithercn/galaxy";
import { Halftone } from "@/components/dithercn/halftone";
import { Horizon } from "@/components/dithercn/horizon";
import { MeshGradient } from "@/components/dithercn/mesh-gradient";
import { Metaballs } from "@/components/dithercn/metaballs";
import { Moire } from "@/components/dithercn/moire";
import { NoiseField } from "@/components/dithercn/noise-field";
import { Plasma } from "@/components/dithercn/plasma";
import { Rain } from "@/components/dithercn/rain";
import { Ridgelines } from "@/components/dithercn/ridgelines";
import { RetroGrid } from "@/components/dithercn/retro-grid";
import { Ripples } from "@/components/dithercn/ripples";
import { Silk } from "@/components/dithercn/silk";
import { Smoke } from "@/components/dithercn/smoke";
import { Starfield } from "@/components/dithercn/starfield";
import { Tunnel } from "@/components/dithercn/tunnel";
import { Voronoi } from "@/components/dithercn/voronoi";
import { Waves } from "@/components/dithercn/waves";

/** Props shared by every background: the engine props (cell, animate, fps, ...) plus className. */
export type BackgroundProps = Record<string, unknown> & { className?: string };

export type BackgroundUse = "dashboard" | "hero" | "card";
export type BackgroundCost = "cheap" | "medium" | "heavy";

export interface BackgroundEntry {
  readonly label: string;
  readonly component: ComponentType<BackgroundProps>;
  readonly cost: BackgroundCost;
  readonly uses: readonly BackgroundUse[];
  /** Subtle-by-default props for a dashboard background. */
  readonly props: Readonly<Record<string, unknown>>;
}

/** Cast once here: the components' prop types are narrower than the generic settings bag. */
const asBackground = (component: unknown): ComponentType<BackgroundProps> =>
  component as ComponentType<BackgroundProps>;

const entry = (
  label: string,
  component: unknown,
  cost: BackgroundCost,
  uses: readonly BackgroundUse[],
  props: Readonly<Record<string, unknown>>,
): BackgroundEntry => ({ label, component: asBackground(component), cost, uses, props });

export const BACKGROUNDS = {
  "dither-gradient": entry("Dither gradient", DitherGradient, "cheap", ["dashboard", "hero"], { mode: "linear", angle: 160, from: 0, to: 0.3, noise: 0.1, speed: 0.3, fps: 15 }),
  "dither-glow": entry("Dither glow", DitherGlow, "cheap", ["dashboard", "card", "hero"], { position: "top-right", radius: 0.85, intensity: 0.8, speed: 0.4, fps: 15 }),
  "mesh-gradient": entry("Mesh gradient", MeshGradient, "cheap", ["dashboard", "hero"], { blobs: 3, size: 0.5, matrix: "blue-noise", speed: 0.3, fps: 15 }),
  aurora: entry("Aurora", Aurora, "medium", ["hero"], { curtains: 2, intensity: 0.45, glow: 0.5, shimmer: 0.1, speed: 0.4, fps: 15 }),
  "noise-field": entry("Noise field", NoiseField, "medium", ["dashboard"], { variant: "smoke", intensity: 0.35, coverage: -0.3, scale: 1.6, detail: 3, flow: 0.4, speed: 0.4, fps: 15 }),
  waves: entry("Waves", Waves, "medium", ["hero"], { variant: "ocean", layers: 5, amplitude: 0.8, speed: 0.5, fps: 20 }),
  plasma: entry("Plasma", Plasma, "cheap", ["dashboard", "hero"], { intensity: 0.4, warp: 0.4, bands: 1.2, speed: 0.4, fps: 15 }),
  beams: entry("Beams", Beams, "cheap", ["hero"], { rays: 6, spread: 60, sweep: 3, speed: 0.5, fps: 15 }),
  silk: entry("Silk", Silk, "cheap", ["dashboard", "hero"], { folds: 4, sheen: 0.3, intensity: 0.35, speed: 0.4, fps: 15 }),
  smoke: entry("Smoke", Smoke, "medium", ["hero"], { density: 0.5, height: 0.6, speed: 0.5, fps: 15 }),
  fire: entry("Fire", Fire, "medium", ["hero"], { height: 0.4, embers: 0.5, edge: "bottom", speed: 0.7, fps: 24 }),
  "flow-field": entry("Flow field", FlowField, "medium", ["hero"], { variant: "streaks", density: 0.7, intensity: 0.5, speed: 0.5, fps: 15 }),
  contours: entry("Contours", Contours, "medium", ["dashboard", "hero"], { lines: 18, relief: 0.2, index: 5, speed: 0.4, fps: 15 }),
  ripples: entry("Ripples", Ripples, "cheap", ["dashboard", "card", "hero"], { rings: 10, intensity: 0.3, decay: 1.2, speed: 0.4, fps: 15 }),
  rain: entry("Rain", Rain, "heavy", ["hero"], { drops: 0.6, glow: 0.8, fade: 0.5, speed: 0.6, fps: 20 }),
  ridgelines: entry("Ridgelines", Ridgelines, "medium", ["hero"], { lines: 24, amplitude: 0.8, shade: 0.2, speed: 0.4, fps: 15 }),
  metaballs: entry("Metaballs", Metaballs, "medium", ["hero"], { variant: "rings", count: 4, size: 1, speed: 0.5, fps: 15 }),
  voronoi: entry("Voronoi", Voronoi, "heavy", ["hero"], { variant: "glaze", scale: 0.8, drift: 0.5, speed: 0.5, fps: 15 }),
  tunnel: entry("Tunnel", Tunnel, "cheap", ["hero"], { shape: "circle", spokes: 8, fog: 1.5, speed: 0.5, fps: 15 }),
  "retro-grid": entry("Retro grid", RetroGrid, "cheap", ["hero"], { horizon: 0.42, sun: 0.4, columns: 12, speed: 0.5, fps: 24 }),
  eclipse: entry("Eclipse", Eclipse, "cheap", ["hero"], { size: 0.24, corona: 0.5, pulse: 0.5, speed: 0.5, fps: 15 }),
  "black-hole": entry("Black hole", BlackHole, "heavy", ["hero"], { tilt: 70, size: 0.45, stars: 0.5, matrix: "bayer4", speed: 0.5, fps: 20 }),
  horizon: entry("Horizon", Horizon, "medium", ["hero"], { horizon: 0.28, curve: 0.6, glow: 0.8, aurora: 0.8, stars: 1, speed: 0.4, fps: 15 }),
  starfield: entry("Starfield", Starfield, "cheap", ["dashboard", "hero"], { density: 0.6, twinkle: 0.3, drift: 0.4, nebula: 0.3, speed: 0.5, fps: 15 }),
  galaxy: entry("Galaxy", Galaxy, "medium", ["hero"], { arms: 2, stars: 0.6, speed: 0.5, fps: 15 }),
  halftone: entry("Halftone", Halftone, "medium", ["card", "hero"], { source: "noise", color: "ink", size: 8, intensity: 0.6, drift: 0.4, speed: 0.4, fps: 15 }),
  moire: entry("Moire", Moire, "medium", ["hero"], { variant: "lines", pitch: 6, bands: 2, drift: 0.5, speed: 0.5, fps: 15 }),
  "dither-globe": entry("Dither globe", DitherGlobe, "medium", ["hero", "card"], { speed: 4, atmosphere: true, draggable: false, animate: true }),
  "dot-map": entry("Dot map", DotMap, "cheap", ["hero", "card"], { columns: 120, color: "grey", accent: "ink", animate: true }),
  "dither-orb": entry("Dither orb", DitherOrb, "cheap", ["card", "hero"], { size: 0.2, glow: 0.3, lean: 0.5, morph: 0.6 }),
  "dither-fade": entry("Dither fade", DitherFade, "cheap", ["dashboard", "card"], { side: "bottom", size: 96, animate: false }),
} as const satisfies Record<string, BackgroundEntry>;

export type BackgroundId = keyof typeof BACKGROUNDS;

export const BACKGROUND_IDS = Object.keys(BACKGROUNDS) as BackgroundId[];

/** Chosen from a side-by-side review: restrained, reads as deliberate in light and dark (noise-field read as dust). */
export const DEFAULT_BACKGROUND: BackgroundId = "dither-glow";
/** Login and hero routes use this bolder background. Not user-selectable in v1. */
export const HERO_BACKGROUND: BackgroundId = "horizon";

export const isBackgroundId = (value: string): value is BackgroundId =>
  Object.prototype.hasOwnProperty.call(BACKGROUNDS, value);

/** Unknown ids (stale or hand-edited storage) fall back to the default. */
export const resolveBackground = (value: string): BackgroundId =>
  isBackgroundId(value) ? value : DEFAULT_BACKGROUND;
