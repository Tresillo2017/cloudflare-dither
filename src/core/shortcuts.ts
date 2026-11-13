export const MASTER_HOTKEY = "Alt+Shift+D";

interface MenuGlobals {
  GM_registerMenuCommand?: (label: string, handler: () => void) => unknown;
}

/** Alt+Shift+D toggles the master switch. Ignored while typing in a field. */
export const installHotkey = (toggle: () => void): (() => void) => {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (!event.altKey || !event.shiftKey || event.code !== "KeyD") return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) {
      return;
    }
    toggle();
  };
  document.addEventListener("keydown", onKeyDown);
  return () => document.removeEventListener("keydown", onKeyDown);
};

/**
 * Registers a userscript-manager menu command when GM_registerMenuCommand is granted.
 * Returns whether the command was registered, so the caller can fall back to on-page UI.
 */
export const installMenuCommand = (label: string, handler: () => void): boolean => {
  const gm = globalThis as unknown as MenuGlobals;
  if (typeof gm.GM_registerMenuCommand !== "function") return false;
  try {
    gm.GM_registerMenuCommand(label, handler);
    return true;
  } catch {
    // Some managers reject menu commands from sandboxed frames. The hotkey still works.
    return false;
  }
};
