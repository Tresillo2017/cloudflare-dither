import type { ReactNode } from "react";
import type { Adapter, AdapterContext } from "../../core";
import { BackgroundLayer, useTranslucentCanvas } from "./background-layer";
import { HERO_BACKGROUND } from "./backgrounds";
import { isHeroPath, usePathname } from "./route";

const HeroLayer = ({ ctx }: { ctx: AdapterContext }) => {
  const onHero = isHeroPath(usePathname());
  useTranslucentCanvas(onHero);
  if (!onHero) return null;
  return (
    <BackgroundLayer
      backgroundId={HERO_BACKGROUND}
      opacity={1}
      cell={ctx.settings.cell}
      animate={ctx.settings.animate}
      visual="page-hero"
    />
  );
};

/** Bolder background for the login and sign-up routes. Renders nothing elsewhere. */
export const heroAdapter: Adapter = {
  id: "page-hero",
  label: "Login hero background",
  group: "page",
  ditherComponents: ["horizon"],
  selectors: [{ selector: "body", confidence: "high", source: "document body, shown on /login and /signup" }],
  defaultEnabled: true,
  maxInstances: 1,
  mode: "overlay-fixed",
  render: (ctx): ReactNode => <HeroLayer ctx={ctx} />,
};
