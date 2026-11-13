import { createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Core } from "../core";
import { installMenuCommand } from "../core/shortcuts";
import { UiApp } from "./app";
import { createUiHost } from "./host";
import { createUiStore } from "./ui-store";

/**
 * Mounts the settings panel and Dither Lab (and the fallback launcher) in their own shadow root. Returns the
 * undo handle. The UI lives outside the stand-in registry, so the master switch never removes it.
 */
export const mountUi = (core: Core): (() => void) => {
  const store = createUiStore();
  const host = createUiHost(core.styles, core.theme.get());
  const root = createRoot(host.mount);
  // The settings live in the userscript manager's menu. The on-page launcher is only a fallback
  // for when the manager offers no menu (for example the script pasted with @grant none).
  const hasMenu = installMenuCommand("Dither settings", () => store.set("panel"));
  root.render(createElement(UiApp, { core, store, showLauncher: !hasMenu }));
  const unsubscribeTheme = core.theme.subscribe(() => host.setTheme(core.theme.get()));
  installMenuCommand("Dither Lab", () => store.set("lab"));
  installMenuCommand("Dither: copy selector census", () => {
    void core.diagnostics.copy();
  });
  return () => {
    unsubscribeTheme();
    root.unmount();
    host.remove();
  };
};
