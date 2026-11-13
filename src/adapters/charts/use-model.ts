import { useEffect, useState } from "react";

/**
 * Keeps a readable model of one target in React state. The target is re-read on a fixed
 * interval (React re-renders of the page change option objects without touching the DOM).
 * Identical results are dropped, so unchanged data causes no re-render.
 *
 * Failure policy: a poll that returns null keeps the last good model (the page may be between
 * updates). A poll that throws keeps the last good model too, and the error is held so that a
 * stand-in with no model at all can rethrow it to the core, which records it and leaves the
 * original visible.
 */

export const MODEL_POLL_MS = 750;

export interface ModelState<T> {
  readonly model: T | null;
  readonly error: unknown;
}

const sameValue = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

export const readModel = <T>(
  target: Element,
  extract: (el: Element) => T | null,
  previous: ModelState<T>,
): ModelState<T> => {
  try {
    const next = extract(target);
    if (next === null) return previous.model === null ? previous : { model: previous.model, error: null };
    if (previous.model !== null && sameValue(previous.model, next) && previous.error === null) return previous;
    return { model: next, error: null };
  } catch (error: unknown) {
    return { model: previous.model, error };
  }
};

export class ModelUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ModelUnavailableError";
  }
}

export const useTargetModel = <T>(target: Element, extract: (el: Element) => T | null): T => {
  const [state, setState] = useState<ModelState<T>>(() => readModel(target, extract, { model: null, error: null }));

  useEffect(() => {
    const timer = window.setInterval(() => {
      setState((previous) => {
        const next = readModel(target, extract, previous);
        return next === previous || (sameValue(next.model, previous.model) && next.error === previous.error)
          ? previous
          : next;
      });
    }, MODEL_POLL_MS);
    return () => window.clearInterval(timer);
  }, [target, extract]);

  if (state.model !== null) return state.model;
  throw new ModelUnavailableError("no readable data for this target", { cause: state.error ?? undefined });
};
