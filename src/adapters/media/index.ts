import type { Adapter } from "../../core/types";
import { logoAdapter } from "./logo";
import { logoMarqueeAdapter } from "./logo-marquee";
import { imagesAdapter } from "./images";
import { imagesCompareAdapter } from "./images-compare";
import { imagesScrollRevealAdapter } from "./images-scroll";
import { scrambleBreadcrumbAdapter } from "./scramble";
import { titleH1Adapter, titleH2Adapter } from "./title";

/**
 * Media folder: the `text` group (titles, scramble) and the `images` group
 * (Cloudflare logo, content images and their variants, login marquee).
 */
export const adapters: Adapter[] = [
  titleH1Adapter,
  titleH2Adapter,
  scrambleBreadcrumbAdapter,
  logoAdapter,
  imagesAdapter,
  imagesScrollRevealAdapter,
  imagesCompareAdapter,
  logoMarqueeAdapter,
];
