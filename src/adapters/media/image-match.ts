import { isAdapterOn } from "./variants";

/** Smallest box (CSS px) worth a dithered stand-in. Smaller images are icons or thumbnails. */
export const MIN_IMAGE_WIDTH = 160;
export const MIN_IMAGE_HEIGHT = 96;

const DATA_OR_BLOB = /^(data|blob):/i;
const AVATAR_ALT = /avatar/i;
const LOGO_ALT = /logo/i;

/** Image treatments that replace the default "Content images" stand-in when switched on. */
export type ImageVariantId = "images-scroll-reveal" | "images-compare" | "logo-marquee";
const VARIANT_IDS: readonly ImageVariantId[] = ["images-scroll-reveal", "images-compare", "logo-marquee"];

/**
 * True when the image source is same-origin (or inline), so drawing it never taints
 * a canvas. Cross-origin images are skipped instead of failing late.
 */
export const isCanvasSafeSource = (img: HTMLImageElement): boolean => {
  const src = img.currentSrc || img.src;
  if (!src) return false;
  if (DATA_OR_BLOB.test(src)) return true;
  try {
    return new URL(src, location.href).origin === location.origin;
  } catch {
    return false;
  }
};

export const isLargeEnough = (el: Element): boolean => {
  const box = el.getBoundingClientRect();
  return box.width >= MIN_IMAGE_WIDTH && box.height >= MIN_IMAGE_HEIGHT;
};

/** Avatars are small, roughly square portraits. The alt text alone is not enough: wide "Team avatar" previews are content. */
const AVATAR_MAX_ASPECT = 1.25;
const AVATAR_MIN_ASPECT = 1 / AVATAR_MAX_ASPECT;
const isAvatarShaped = (img: HTMLImageElement): boolean => {
  if (!AVATAR_ALT.test(img.alt)) return false;
  const box = img.getBoundingClientRect();
  const aspect = box.width / Math.max(box.height, 1);
  return aspect >= AVATAR_MIN_ASPECT && aspect <= AVATAR_MAX_ASPECT && box.width < MIN_IMAGE_WIDTH * 2;
};

/** Content images only: not avatars, not logos, not our own stand-ins. */
const isContentImage = (img: HTMLImageElement): boolean =>
  !isAvatarShaped(img) && !LOGO_ALT.test(img.alt) && img.closest("[data-dcf-host]") === null;

/** The login hero, the target of logo-marquee. */
export const isLoginHero = (img: HTMLImageElement): boolean =>
  location.pathname.startsWith("/login") && isLargeEnough(img);

/** Common gate for every image treatment: type, content, origin and size. */
export const isEligibleImage = (el: Element): el is HTMLImageElement =>
  el instanceof HTMLImageElement && isContentImage(el) && isCanvasSafeSource(el) && isLargeEnough(el);

/**
 * True when another image treatment (other than `self`) is switched on and claims
 * this image. Keeps two stand-ins from mounting on one element.
 */
export const isClaimedByVariant = (img: HTMLImageElement, self?: ImageVariantId): boolean =>
  VARIANT_IDS.some(
    (id) => id !== self && isAdapterOn(id) && (id !== "logo-marquee" || isLoginHero(img)),
  );

/** Absolute URL of the displayed source, empty when unknown. */
export const absoluteSrc = (el: Element): string =>
  el instanceof HTMLImageElement ? el.currentSrc || el.src : "";
