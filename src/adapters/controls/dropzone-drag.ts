import { useEffect, useState } from "react";

/**
 * True while a drag is over the original element. Only observes dragenter, dragleave,
 * drop and dragend with passive listeners. It never calls preventDefault and never reads
 * the dragged files, so the page's own file handling is untouched.
 */
export const useDragOver = (target: Element): boolean => {
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    // Counts nested enter/leave pairs, since dragleave also fires when the pointer moves between children.
    let depth = 0;
    const enter = (): void => {
      depth += 1;
      setDragging(true);
    };
    const leave = (): void => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const reset = (): void => {
      depth = 0;
      setDragging(false);
    };
    const listeners: [string, EventListener][] = [
      ["dragenter", enter],
      ["dragleave", leave],
      ["drop", reset],
      ["dragend", reset],
    ];
    for (const [type, listener] of listeners) target.addEventListener(type, listener, { passive: true });
    return () => {
      for (const [type, listener] of listeners) target.removeEventListener(type, listener);
    };
  }, [target]);
  return dragging;
};
