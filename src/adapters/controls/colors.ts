import { toneColor } from "../../core/visual";
import type { ButtonLook } from "./button-look";

/**
 * The fill colour of an emphasis button, read live from the Kumo tokens so it follows the
 * brand: primary is Cloudflare blue (never purple), destructive is the Kumo danger red.
 */
export const buttonFillColor = (look: ButtonLook): string =>
  look.tone === "destructive" ? toneColor("danger") : toneColor("brand");
