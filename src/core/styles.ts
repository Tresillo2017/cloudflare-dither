import type { Log } from "./log";
import type { Restorable } from "./owned";
import { bindSharedSheetLog, getSharedSheet, sharedCssText } from "./shared-sheet";
import { installGlobalSheet } from "./global-sheet";

export interface StylesApi {
  /** Makes a shadow root use the shared stylesheet. Safe to call more than once. */
  adoptInto(root: ShadowRoot): void;
  /** Installs the page-level sheet. Returns the undo handle. */
  installGlobal(): Restorable;
}

export const createStyles = (log: Log): StylesApi => {
  bindSharedSheetLog(log);
  return {
    adoptInto: (root) => {
      const sheet = getSharedSheet();
      if (sheet) {
        if (!root.adoptedStyleSheets.includes(sheet)) {
          root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
        }
        return;
      }
      if (root.querySelector("style[data-dcf-shared]")) return;
      const style = document.createElement("style");
      style.setAttribute("data-dcf-shared", "");
      style.textContent = sharedCssText();
      root.prepend(style);
    },
    installGlobal: () => installGlobalSheet(log),
  };
};
