/**
 * How a Kumo button is drawn, read from the original. Plain data so it can be compared and serialised.
 *
 * Two looks only: `filled` (emphasis: primary or destructive, Kumo sets an inline emphasis colour)
 * and `plain` (everything else: secondary, outline, ghost, icon-only). Plain buttons all share one
 * uniform rim and one hover surface, so ghost and icon-only controls no longer look dashed or disabled.
 */
export type ButtonKind = "filled" | "plain";
export type ButtonTone = "primary" | "destructive" | "neutral";

export interface ButtonLook {
  readonly kind: ButtonKind;
  readonly tone: ButtonTone;
  readonly disabled: boolean;
  readonly loading: boolean;
}

/** Kumo sets this custom property inline on emphasis (primary and destructive) buttons. */
const EMPHASIS_VAR = "--kumo-button-emphasis-bg";

const emphasisTone = (el: Element): ButtonTone | null => {
  if (!(el instanceof HTMLElement)) return null;
  const raw = el.style.getPropertyValue(EMPHASIS_VAR);
  if (raw === "") return null;
  return raw.includes("danger") ? "destructive" : "primary";
};

const isDisabled = (el: Element): boolean =>
  el.hasAttribute("disabled") ||
  el.getAttribute("aria-disabled") === "true" ||
  el.hasAttribute("data-disabled");

const isLoading = (el: Element): boolean =>
  el.getAttribute("aria-busy") === "true" ||
  el.hasAttribute("data-loading") ||
  el.getAttribute("data-state") === "loading";

/** Reads the look of a Kumo Button, LinkButton, Toolbar.Button or popover trigger. Pure. */
export const readButtonLook = (el: Element): ButtonLook => {
  const tone = emphasisTone(el);
  return {
    disabled: isDisabled(el),
    kind: tone ? "filled" : "plain",
    loading: isLoading(el),
    tone: tone ?? "neutral",
  };
};

/** Attributes whose change can change the look or the state of a button. */
export const BUTTON_ATTRIBUTES = [
  "class",
  "style",
  "disabled",
  "aria-disabled",
  "aria-busy",
  "data-loading",
  "data-disabled",
  "data-state",
];
