import { useEffect } from "react";
import { ownStyleProperty, restoreAll, type Restorable } from "../../core/owned";

/**
 * Kumo paints some decoration as empty, absolutely positioned children of the control: a switch
 * knob, or the gradient overlay of an emphasis button. They sit above the underlay stand-in, so
 * they would hide the dithered surface. Only empty, non-text, non-host children are touched.
 */
const isDecorativeOverlay = (child: Element): child is HTMLElement => {
  if (!(child instanceof HTMLElement)) return false;
  if (child.hasAttribute("data-dcf-host") || child.textContent !== "") return false;
  const { position } = getComputedStyle(child);
  return position === "absolute" || position === "fixed";
};

/**
 * Hides the decorative overlays of the target with an owned inline opacity, and restores the
 * exact original style when the stand-in unmounts. The elements stay in the DOM and in the
 * accessibility tree; only their paint is removed.
 */
export const useHiddenDecor = (target: Element): void => {
  useEffect(() => {
    const undo: Restorable[] = Array.from(target.children)
      .filter(isDecorativeOverlay)
      .map((child) => ownStyleProperty(child, "opacity", "0"));
    return () => restoreAll(undo);
  }, [target]);
};
