import { useRef, type ReactNode } from "react";
import type { Core } from "../core";
import { Launcher } from "./launcher";
import { SettingsPanel } from "./panel/panel";
import { Lab } from "./lab/lab";
import { useUiView } from "./hooks";
import type { UiStore } from "./ui-store";

export interface UiAppProps {
  readonly core: Core;
  readonly store: UiStore;
  /** Show the on-page launcher. False when the userscript manager's menu opens the panel instead. */
  readonly showLauncher: boolean;
}

/** The panel and the Lab are one at a time. The launcher, when shown, stays even with master off. */
export const UiApp = ({ core, store, showLauncher }: UiAppProps): ReactNode => {
  const view = useUiView(store);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const close = (): void => {
    store.set("closed");
    queueMicrotask(() => launcherRef.current?.focus());
  };
  return (
    <>
      {showLauncher ? (
        <Launcher ref={launcherRef} open={view !== "closed"} onToggle={() => store.set(view === "closed" ? "panel" : "closed")} />
      ) : null}
      {view === "panel" ? (
        <SettingsPanel core={core} onClose={close} onOpenLab={() => store.set("lab")} />
      ) : null}
      {view === "lab" ? <Lab onClose={() => store.set("panel")} /> : null}
    </>
  );
};
