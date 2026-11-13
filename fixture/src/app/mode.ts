import { useSyncExternalStore } from "react";

/** Kumo reads dark mode from the `data-mode` attribute on an ancestor (normally <html>). */
export type ColorMode = "light" | "dark";

const MODE_ATTRIBUTE = "data-mode";
const DEFAULT_MODE: ColorMode = "light";

let currentMode: ColorMode = DEFAULT_MODE;
const listeners = new Set<Listener>();

type Listener = () => void;

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ColorMode {
  return currentMode;
}

function writeModeAttribute(mode: ColorMode): void {
  document.documentElement.setAttribute(MODE_ATTRIBUTE, mode);
}

export function initColorMode(): void {
  writeModeAttribute(currentMode);
}

export function toggleColorMode(): void {
  currentMode = currentMode === "light" ? "dark" : "light";
  writeModeAttribute(currentMode);
  listeners.forEach((listener) => listener());
}

export function useColorMode(): ColorMode {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
