/** Runs `flush` at most once per frame, however many times `schedule` is called. */
export interface Batcher {
  schedule(): void;
  cancel(): void;
}

/**
 * Frame-aligned by default, but a timer fallback guarantees the flush even when rAF is
 * starved (background tabs, or heavy WebGL under software rendering).
 */
export const FALLBACK_FLUSH_MS = 100;

export const createBatcher = (flush: () => void): Batcher => {
  let frameHandle: number | null = null;
  let timerHandle: ReturnType<typeof setTimeout> | null = null;

  const cancelPending = (): void => {
    if (frameHandle !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(frameHandle);
    }
    if (timerHandle !== null) clearTimeout(timerHandle);
    frameHandle = null;
    timerHandle = null;
  };

  const run = (): void => {
    cancelPending();
    flush();
  };

  return {
    schedule: () => {
      if (frameHandle !== null || timerHandle !== null) return;
      if (typeof requestAnimationFrame === "function") {
        frameHandle = requestAnimationFrame(run);
      }
      timerHandle = setTimeout(run, FALLBACK_FLUSH_MS);
    },
    cancel: cancelPending,
  };
};
