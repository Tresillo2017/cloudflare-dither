/** What a dithered slider mirrors from the original: label, thumb values and range. */
export interface SliderLook {
  readonly label: string;
  readonly values: readonly number[];
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly disabled: boolean;
}

const DEFAULT_MIN = 0;
const DEFAULT_MAX = 100;
const DEFAULT_STEP = 1;
const DEFAULT_LABEL = "Slider";

const finiteOr = (raw: string | number | null | undefined, fallback: number): number => {
  const value = typeof raw === "number" ? raw : Number(raw ?? Number.NaN);
  return Number.isFinite(value) ? value : fallback;
};

const textOfId = (id: string): string | null => {
  const el = document.getElementById(id);
  const text = el?.textContent?.trim();
  return text ? text : null;
};

/** Accessible name of a native input: aria-label, else its <label>. */
const nativeLabel = (input: HTMLInputElement): string =>
  input.getAttribute("aria-label") ?? input.labels?.[0]?.textContent?.trim() ?? DEFAULT_LABEL;

const readNative = (input: HTMLInputElement): SliderLook => ({
  disabled: input.disabled,
  label: nativeLabel(input) || DEFAULT_LABEL,
  max: finiteOr(input.max, DEFAULT_MAX),
  min: finiteOr(input.min, DEFAULT_MIN),
  step: finiteOr(input.step, DEFAULT_STEP),
  values: [finiteOr(input.value, DEFAULT_MIN)],
});

/** Accessible name of a Base UI thumb: aria-labelledby text, else aria-label. */
const thumbLabel = (thumb: Element, root: Element): string => {
  const labelledBy = thumb.getAttribute("aria-labelledby");
  const fromIds = labelledBy ? textOfId(labelledBy.split(" ")[0] ?? "") : null;
  return fromIds ?? thumb.getAttribute("aria-label") ?? root.getAttribute("aria-label") ?? DEFAULT_LABEL;
};

/** Thumbs are the explicit role=slider element or the native range input Base UI renders inside each thumb (its implicit role is slider). */
const SLIDER_THUMB = '[role="slider"], input[type="range"]';

const thumbValue = (thumb: Element): number => {
  const attr = thumb.getAttribute("aria-valuenow");
  return finiteOr(attr ?? (thumb instanceof HTMLInputElement ? thumb.value : null), DEFAULT_MIN);
};

const readBaseUi = (root: Element): SliderLook => {
  const thumbs = Array.from(root.querySelectorAll(SLIDER_THUMB));
  const first = thumbs[0];
  return {
    disabled:
      root.hasAttribute("data-disabled") || first?.getAttribute("aria-disabled") === "true",
    label: first ? thumbLabel(first, root) : DEFAULT_LABEL,
    max: finiteOr(first?.getAttribute("aria-valuemax") ?? (first instanceof HTMLInputElement ? first.max : null), DEFAULT_MAX),
    min: finiteOr(first?.getAttribute("aria-valuemin") ?? (first instanceof HTMLInputElement ? first.min : null), DEFAULT_MIN),
    step: DEFAULT_STEP,
    values: thumbs.map(thumbValue),
  };
};

/**
 * Reads a native range input or a Base UI slider root (the element that holds the
 * `role="slider"` thumbs). Values come from the live DOM, since a native range's
 * `value` property changes without an attribute mutation.
 */
export const readSliderLook = (el: Element): SliderLook =>
  el instanceof HTMLInputElement ? readNative(el) : readBaseUi(el);

/** Slider attributes that change the mirrored state. Subtree covers the thumbs. */
export const SLIDER_ATTRIBUTES = [
  "value",
  "min",
  "max",
  "step",
  "disabled",
  "aria-disabled",
  "aria-valuenow",
  "aria-valuemin",
  "aria-valuemax",
  "data-disabled",
  "aria-label",
  "aria-labelledby",
];

/**
 * The Base UI root is the outermost [data-orientation] element that contains a thumb.
 * Its thumbs also carry data-orientation, so an inner match is rejected.
 */
export const isBaseUiSliderRoot = (el: Element): boolean => {
  if (!el.hasAttribute("data-orientation") || el.querySelector(SLIDER_THUMB) === null) return false;
  const outer = el.parentElement?.closest("[data-orientation]");
  return !(outer && outer.querySelector(SLIDER_THUMB) !== null);
};

/** A native range is a slider only when it is not part of a Base UI slider (no data-orientation ancestor). */
export const isNativeSlider = (el: Element): boolean =>
  el instanceof HTMLInputElement && el.closest("[data-orientation]") === null;
