import type { Adapter } from "./types";
import type { Core } from "./index";
import { createDiagnostics } from "./diagnostics";
import { createLog } from "./log";
import { createPortalRoot } from "./portal";
import { createRegistry } from "./registry";
import { createRouter } from "./router";
import { createSettingsStore, createDefaultStorage, type SettingsStore } from "./settings";
import { createSharedObservers } from "./shared-observers";
import { createStageStore } from "./stage-store";
import { createStyles } from "./styles";
import { createThemeStore } from "./theme";
import { installHotkey, installMenuCommand, MASTER_HOTKEY } from "./shortcuts";
import type { Restorable } from "./owned";

/** Key of the debug handle on `document` (Symbol.for, so any realm can reach it). */
export const CORE_HANDLE = Symbol.for("cloudflare-dither.core");

export interface CoreHandle {
  readonly core: Core;
  dispose(): void;
}

const exposeHandle = (core: Core): void => {
  Object.defineProperty(document, CORE_HANDLE, { value: core, configurable: true, enumerable: false });
};

const removeHandle = (): void => {
  Reflect.deleteProperty(document, CORE_HANDLE);
};

/**
 * Wires every core module together. Master off disposes the stand-ins, the theme marker
 * and the page sheet, so the page returns to its original state.
 */
export const createCore = (adapters: readonly Adapter[]): CoreHandle => {
  let settingsRef: SettingsStore | null = null;
  const log = createLog(() => settingsRef?.get().debug === true);
  const settings = createSettingsStore(createDefaultStorage(), log);
  settingsRef = settings;

  const theme = createThemeStore(log);
  const styles = createStyles(log);
  const observers = createSharedObservers();
  const router = createRouter();
  const stage = createStageStore({ mounts: [], theme: theme.get(), settings: settings.get() });
  const registry = createRegistry({
    adapters,
    settings,
    theme,
    styles,
    observers,
    stage,
    log,
    subscribeRoute: router.subscribe,
  });
  const diagnostics = createDiagnostics({ registry, theme, log });
  const core: Core = { settings, registry, theme, diagnostics, styles, log };

  let pageSheet: Restorable | null = null;
  const syncMaster = (): void => {
    if (settings.get().master) {
      pageSheet ??= styles.installGlobal();
    } else {
      theme.dispose();
      pageSheet?.restore();
      pageSheet = null;
    }
  };

  const portal = createPortalRoot(stage, log);
  exposeHandle(core);
  syncMaster();
  const unsubscribeMaster = settings.subscribe(syncMaster);
  router.start();
  registry.start();
  const removeHotkey = installHotkey(() => settings.update({ master: !settings.get().master }));
  installMenuCommand(`Toggle Cloudflare Dither (${MASTER_HOTKEY})`, () =>
    settings.update({ master: !settings.get().master }),
  );

  return {
    core,
    dispose: () => {
      removeHotkey();
      unsubscribeMaster();
      registry.dispose();
      theme.dispose();
      pageSheet?.restore();
      pageSheet = null;
      router.dispose();
      portal.unmount();
      removeHandle();
    },
  };
};
