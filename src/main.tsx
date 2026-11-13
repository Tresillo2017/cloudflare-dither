/**
 * Userscript entry. Boots the core once per page (guarded on `document`, which every
 * sandbox realm shares), then mounts the UI.
 */
import { adapters as productionAdapters } from "./adapters";
import { createCore } from "./core/create-core";
import { demoAdapters } from "./core/__demo__";
import { mountUi } from "./ui";

const BOOT_KEY = Symbol.for("cloudflare-dither.boot");

const boot = (): void => {
  const marked = document as unknown as Record<symbol, unknown>;
  if (marked[BOOT_KEY] === true) return;
  marked[BOOT_KEY] = true;
  // Test bundles run only the demo adapters on the mini page, so core tests stay isolated from the production adapters.
  const adapters = __DCF_DEMO__ ? demoAdapters : productionAdapters;
  const { core, dispose } = createCore(adapters);
  const disposeUi = mountUi(core);
  window.addEventListener("pagehide", (event: PageTransitionEvent) => {
    // A page parked in the back/forward cache keeps its heap and its stand-ins. Tearing down
    // here would leave the restored page without the re-skin, since boot runs once per document.
    if (event.persisted) return;
    disposeUi();
    dispose();
    marked[BOOT_KEY] = false;
  }, { once: true });
};

boot();
