import { DitheredLogo } from "@/components/dithercn/dithered-logo";
import type { Adapter, AdapterContext } from "../../core";
import { CELL_PX_SMALL, CLOUDFLARE_ORANGE } from "../../core/visual";
import { FailureGuard } from "./failure-guard";
import { svgDataUrl } from "./svg-data";

const MIN_LOGO_SIDE = 16;

/** Reads the live SVG at its current box, so the data URL matches the on-page size. */
const readLogoSource = (el: Element): string => {
  if (!(el instanceof SVGSVGElement)) return "";
  const box = el.getBoundingClientRect();
  return svgDataUrl(el, box.width, box.height);
};

const LogoStandIn = ({ ctx }: { ctx: AdapterContext }) => {
  const src = ctx.useTargetState(readLogoSource, { subtree: true });
  const ratio = ctx.rect.height > 0 ? ctx.rect.width / ctx.rect.height : undefined;
  if (!src) throw new Error("logo: SVG could not be serialised");
  return (
    <FailureGuard adapterId="logo">
      <DitheredLogo
        data-dcf-visual="logo"
        src={src}
        alt=""
        ratio={ratio}
        color={CLOUDFLARE_ORANGE}
        tone="mono"
        source="alpha"
        fill="gradient"
        cell={CELL_PX_SMALL}
        effect="none"
        lazy={false}
        className="size-full"
      />
    </FailureGuard>
  );
};

export const logoAdapter: Adapter = {
  id: "logo",
  label: "Cloudflare logo",
  group: "images",
  ditherComponents: ["dithered-logo"],
  selectors: [
    { selector: '[data-sentry-component="CloudflareLogo"] svg', confidence: "high", source: "Cloudflare sidebar logo (CloudflareLogo.tsx), read on /home" },
    { selector: 'svg[aria-label="Cloudflare logo"]', confidence: "high", source: "Kumo CloudflareLogo (fixture census)" },
  ],
  defaultEnabled: true,
  maxInstances: 4,
  match: (el) => el.getBoundingClientRect().width >= MIN_LOGO_SIDE && el.closest("[data-dcf-host]") === null,
  mode: "sibling-replace",
  render: (ctx) => <LogoStandIn ctx={ctx} />,
};
