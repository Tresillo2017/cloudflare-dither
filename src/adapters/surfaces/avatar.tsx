import { Avatar } from "@/components/dithercn/avatar";
import type { Adapter, AdapterContext } from "../../core";
import { clamp } from "./geometry";

const MIN_AVATAR_SIDE = 24;
const MAX_AVATAR_SIDE = 72;
const MAX_INITIALS_LENGTH = 3;
const INITIALS_PATTERN = /^[A-Za-z]{1,3}$/;

/** The text that seeds the generative face: alt text for images, initials otherwise. */
const seedOf = (el: Element): string => {
  const alt = el.getAttribute("alt")?.trim();
  if (alt) return alt;
  return el.textContent?.trim() ?? "";
};

const shortSide = (el: Element): number => {
  const box = el.getBoundingClientRect();
  return Math.min(box.width, box.height);
};

/** Generative face sized to the original, seeded by its alt or initials. */
const AvatarStandIn = ({ ctx }: { ctx: AdapterContext }) => {
  const seed = ctx.useTargetState((el) => seedOf(el), { subtree: true, attributes: ["alt"] });
  const side = clamp(Math.round(shortSide(ctx.target)), MIN_AVATAR_SIDE, MAX_AVATAR_SIDE);
  return (
    <div className="flex size-full items-center justify-center" aria-hidden="true">
      <Avatar name={seed || "avatar"} size={side} shape="circle" data-dcf-visual="avatar" aria-hidden="true" />
    </div>
  );
};

/** Initials circles: small, square, round, one to three letters, no child elements. */
const isInitialsCircle = (el: Element): boolean => {
  const box = el.getBoundingClientRect();
  const square = Math.abs(box.width - box.height) <= 2;
  const side = shortSide(el);
  const text = el.textContent?.trim() ?? "";
  return (
    square &&
    side >= MIN_AVATAR_SIDE &&
    side <= MAX_AVATAR_SIDE &&
    INITIALS_PATTERN.test(text) &&
    text.length <= MAX_INITIALS_LENGTH &&
    el.children.length === 0
  );
};

/** Images named as avatars, and round square elements holding initials. */
const isAvatar = (el: Element): boolean => {
  if (el.closest("[data-dcf-host]")) return false;
  if (el instanceof HTMLImageElement) return /avatar/i.test(el.alt);
  return isInitialsCircle(el);
};

export const avatarAdapter: Adapter = {
  id: "avatar",
  label: "Avatars and initials",
  group: "surfaces",
  ditherComponents: ["avatar"],
  selectors: [
    { selector: 'img[alt*="avatar" i]', confidence: "med", source: "account avatar images (alt contains avatar)" },
    { selector: "span.rounded-full, div.rounded-full", confidence: "low", source: "heuristic: round initials circles (filtered in match)" },
  ],
  // Replaces real photos with generated faces, so it stays opt-in.
  defaultEnabled: false,
  maxInstances: 30,
  match: isAvatar,
  mode: "sibling-replace",
  render: (ctx) => <AvatarStandIn ctx={ctx} />,
};
