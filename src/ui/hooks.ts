import { useEffect, useState, useSyncExternalStore } from "react";
import type { AdapterInfo, Core } from "../core";
import type { UiStore, UiView } from "./ui-store";

/** Subscribes to the UI view store. */
export const useUiView = (store: UiStore): UiView =>
  useSyncExternalStore(store.subscribe, store.get, store.get);

/** Subscribes to the persisted settings. */
export const useSettings = (core: Core) =>
  useSyncExternalStore(core.settings.subscribe, core.settings.get, core.settings.get);

/** Subscribes to the page theme. */
export const useThemeName = (core: Core) =>
  useSyncExternalStore(core.theme.subscribe, core.theme.get, core.theme.get);

export const REGISTRY_POLL_MS = 1000;

/** The registry has no subscribe API, so match counts are polled while the caller is mounted. */
export const useAdapterRows = (core: Core): readonly AdapterInfo[] => {
  const [rows, setRows] = useState<readonly AdapterInfo[]>(() => core.registry.list());
  useEffect(() => {
    const refresh = () => setRows(core.registry.list());
    refresh();
    const timer = setInterval(refresh, REGISTRY_POLL_MS);
    return () => clearInterval(timer);
  }, [core]);
  return rows;
};
