import { Component, createElement, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import type { Log } from "./log";
import type { MountView, StageStore } from "./stage-store";
import { useTargetPseudo, useTargetValue } from "./target-hooks";
import type { AdapterContext } from "./types";

interface BoundaryProps {
  readonly onFail: (error: unknown) => void;
  readonly children: ReactNode;
}

interface BoundaryState {
  readonly failed: boolean;
}

/**
 * Wraps one stand-in. A render error disposes that stand-in only (the original element
 * shows again). The dispose is deferred by the registry, never run during commit.
 */
class StandInBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    this.props.onFail(error);
  }

  render(): ReactNode {
    return this.state.failed ? null : this.props.children;
  }
}

const AdapterRender = ({ view }: { view: MountView }) => {
  const { target, rect, theme, settings, adapter } = view;
  const ctx = useMemo<AdapterContext>(
    () => ({
      target,
      rect,
      theme,
      settings,
      useTargetState: (read, opts) => useTargetValue(target, read, opts),
      useTargetPseudo: () => useTargetPseudo(target),
    }),
    [target, rect, theme, settings],
  );
  return <>{adapter.render(ctx)}</>;
};

const Stage = ({ store }: { store: StageStore }) => {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
  return (
    <>
      {snapshot.mounts.map((view) =>
        createPortal(
          <StandInBoundary key={view.key} onFail={view.onFail}>
            <AdapterRender view={view} />
          </StandInBoundary>,
          view.mountEl,
          view.key,
        ),
      )}
    </>
  );
};

export interface PortalRoot {
  unmount(): void;
}

/**
 * The single React root. Its container is detached from the page; every stand-in is a
 * portal into its own shadow mount. React's own error reports go to the log, not the console.
 */
export const createPortalRoot = (store: StageStore, log: Log): PortalRoot => {
  const container = document.createElement("div");
  const root = createRoot(container, {
    onCaughtError: (error) => log.debug("stand-in error caught", error),
    onUncaughtError: (error) => log.error("stand-in error uncaught", error),
    onRecoverableError: (error) => log.debug("stand-in recoverable error", error),
  });
  root.render(createElement(Stage, { store }));
  return { unmount: () => root.unmount() };
};
