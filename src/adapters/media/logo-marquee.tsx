import { useState } from "react";
import { LogoMarquee } from "@/components/dithercn/logo-marquee";
import type { Adapter, AdapterContext } from "../../core";
import { FailureGuard } from "./failure-guard";
import { isLoginHero } from "./image-match";
import { pageLogo } from "./svg-data";

const MARQUEE_COPIES = 3;
const MIN_LOGO_HEIGHT = 20;
const MAX_LOGO_HEIGHT = 56;
const LOGO_SHARE_OF_HERO = 0.3;
const MAX_HERO_INSTANCES = 2;

/** Brand marks in a row, in place of the login hero. Needs a logo on the page, else it throws (original shows). */
const logoHeightFor = (heroHeight: number): number =>
  Math.min(MAX_LOGO_HEIGHT, Math.max(MIN_LOGO_HEIGHT, Math.round(heroHeight * LOGO_SHARE_OF_HERO)));

const LogoMarqueeStandIn = ({ ctx }: { ctx: AdapterContext }) => {
  const [logo] = useState(pageLogo);
  if (!logo) throw new Error("logo-marquee: no Cloudflare logo on the page");
  const logos = Array.from({ length: MARQUEE_COPIES }, () => ({ src: logo.src, alt: "Cloudflare", ratio: logo.ratio }));
  return (
    <FailureGuard adapterId="logo-marquee">
      <div data-dcf-visual="logo-marquee" className="flex size-full items-center">
        <LogoMarquee
          logos={logos}
          label=""
          logoHeight={logoHeightFor(ctx.rect.height)}
          color="ink"
          tone="mono"
          effect="none"
          fade="dither"
          className="w-full"
        />
      </div>
    </FailureGuard>
  );
};

export const logoMarqueeAdapter: Adapter = {
  id: "logo-marquee",
  label: "Login hero: logo marquee",
  group: "images",
  ditherComponents: ["logo-marquee"],
  selectors: [{ selector: "img", confidence: "med", source: "login hero image (login route only, see match)" }],
  defaultEnabled: false,
  maxInstances: MAX_HERO_INSTANCES,
  match: (el) => el instanceof HTMLImageElement && isLoginHero(el),
  mode: "sibling-replace",
  render: (ctx) => <LogoMarqueeStandIn ctx={ctx} />,
};
