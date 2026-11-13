import { useEffect, useRef, useState } from "react";
import type { TargetPseudoState, TargetStateOptions } from "./types";
import { watchTarget } from "./target-watch";

/** Re-reads `read(target)` whenever the watched part of the target changes. */
export const useTargetValue = <T>(
  target: Element,
  read: (el: Element) => T,
  opts?: TargetStateOptions,
): T => {
  const readRef = useRef(read);
  readRef.current = read;
  const [value, setValue] = useState<T>(() => read(target));
  const attributesKey = opts?.attributes?.join(",") ?? "*";
  const subtree = opts?.subtree === true;
  const attributes = opts?.attributes;

  useEffect(() => {
    const sync = (): void => {
      try {
        const next = readRef.current(target);
        setValue(() => next);
      } catch (error) {
        // Re-thrown during the next render, so the stand-in's error boundary disposes it
        // and the original element shows again.
        setValue(() => {
          throw error;
        });
      }
    };
    sync();
    return watchTarget(target, { subtree, attributes, notify: sync });
    // attributes is tracked through attributesKey so inline array literals do not resubscribe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, subtree, attributesKey]);

  return value;
};

const INITIAL_PSEUDO: TargetPseudoState = { hover: false, active: false, focusVisible: false };

/** Hover, active and focus-visible state of the original element. Listeners only: events are never blocked. */
export const useTargetPseudo = (target: Element): TargetPseudoState => {
  const [state, setState] = useState<TargetPseudoState>(INITIAL_PSEUDO);

  useEffect(() => {
    const patch = (next: Partial<TargetPseudoState>): void => setState((prev) => ({ ...prev, ...next }));
    const onEnter = () => patch({ hover: true });
    const onLeave = () => patch({ hover: false, active: false });
    const onDown = () => patch({ active: true });
    const onUp = () => patch({ active: false });
    const onFocusIn = () => patch({ focusVisible: target.matches(":focus-visible") });
    const onFocusOut = () => patch({ focusVisible: false });
    const listeners: [string, EventListener][] = [
      ["pointerenter", onEnter],
      ["pointerleave", onLeave],
      ["pointerdown", onDown],
      ["pointerup", onUp],
      ["pointercancel", onUp],
      ["focusin", onFocusIn],
      ["focusout", onFocusOut],
    ];
    for (const [type, listener] of listeners) target.addEventListener(type, listener, { passive: true });
    return () => {
      for (const [type, listener] of listeners) target.removeEventListener(type, listener);
    };
  }, [target]);

  return state;
};
