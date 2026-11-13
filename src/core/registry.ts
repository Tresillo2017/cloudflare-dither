import { createBatcher } from "./batcher";
import { createStandIn, type Rect, type StandIn } from "./host";
import { hasInteractiveDescendant } from "./interactive";
import type { Log } from "./log";
import type { SharedObservers } from "./shared-observers";
import type { StageStore, MountView } from "./stage-store";
import { findCandidates, isOwnHost } from "./scanner";
import { isAdapterEnabled, type Settings, type SettingsStore } from "./settings";
import type { StylesApi } from "./styles";
import type { ThemeStore } from "./theme";
import type { Adapter, AdapterGroup, StandInMode } from "./types";

export {
  type Adapter,
  type AdapterContext,
  type AdapterGroup,
  type StandInMode,
  type SelectorSpec,
  type SelectorConfidence,
  type TargetPseudoState,
  type TargetStateOptions,
} from "./types";

export interface AdapterInfo {
  readonly id: string;
  readonly label: string;
  readonly group: AdapterGroup;
  readonly ditherComponents: readonly string[];
  readonly defaultEnabled: boolean;
  readonly enabled: boolean;
  readonly maxInstances: number | null;
  /** Targets currently tracked (visible or not). */
  readonly matched: number;
  /** Stand-ins currently mounted. */
  readonly mounted: number;
  readonly error: string | null;
}

export interface RegistryApi {
  list(): AdapterInfo[];
  matchCounts(): Record<string, number>;
  errors(): Record<string, string>;
  /** Clears recorded failures and scans the whole page again. */
  rescan(): void;
}

export interface RegistryDeps {
  readonly adapters: readonly Adapter[];
  readonly settings: SettingsStore;
  readonly theme: ThemeStore;
  readonly styles: StylesApi;
  readonly observers: SharedObservers;
  readonly stage: StageStore;
  readonly log: Log;
  readonly subscribeRoute: (listener: () => void) => () => void;
}

export interface Registry extends RegistryApi {
  start(): void;
  dispose(): void;
}

/** One tracked (adapter, target) pair. */
interface TargetRecord {
  readonly key: string;
  readonly adapter: Adapter;
  readonly target: Element;
  visible: boolean;
  rect: Rect;
  standIn: StandIn | null;
  failure: string | null;
  heals: number[];
  unobserveVisibility: () => void;
  unobserveSize: (() => void) | null;
}

const HEAL_WINDOW_MS = 10_000;
const MAX_HEALS_PER_WINDOW = 25;
/** Stand-ins mounted at once across every adapter. Each one is a React subtree and some own a WebGL context. */
export const MAX_TOTAL_MOUNTS = 300;
const NO_OP = (): void => undefined;

const measure = (el: Element): Rect => {
  const box = el.getBoundingClientRect();
  return { width: box.width, height: box.height };
};

const isEmptyBox = (rect: Rect): boolean => rect.width <= 0 || rect.height <= 0;

export const createRegistry = (deps: RegistryDeps): Registry => {
  const { adapters, settings, theme, styles, observers, stage, log } = deps;
  const records = new Set<TargetRecord>();
  const failed = new Set<TargetRecord>();
  const byTarget = new WeakMap<Element, Map<string, TargetRecord>>();
  /** Negative matches. Only pure DOM rejections are cached; layout-dependent ones are deferred. */
  let rejected = new WeakMap<Element, Set<string>>();
  const deferred = new WeakMap<Element, Set<string>>();
  const errors = new Map<string, string>();
  const pendingNodes = new Set<Element>();
  let mutationObserver: MutationObserver | null = null;
  let observing = false;
  let pendingFull = false;
  let needsReconcile = false;
  let publishPending = false;
  let nextKey = 0;
  let disposed = false;
  const unsubscribers: (() => void)[] = [];

  const isEnabled = (adapter: Adapter): boolean => isAdapterEnabled(settings.get(), adapter);
  const isRunning = (): boolean => !disposed && settings.get().master && !document.hidden;

  const publish = (): void => {
    const current = settings.get();
    const mounted = [...records].flatMap((record) => (record.standIn ? [{ record, standIn: record.standIn }] : []));
    theme.setActive(mounted.length > 0);
    const currentTheme = theme.get();
    const mounts: MountView[] = mounted.map(({ record, standIn }) => ({
      key: record.key,
      adapter: record.adapter,
      target: record.target,
      rect: record.rect,
      mountEl: standIn.mountEl,
      theme: currentTheme,
      settings: current,
      onFail: (error: unknown) => queueMicrotask(() => failRecord(record, "render failed", error)),
    }));
    stage.publish({ mounts, theme: currentTheme, settings: current });
  };

  const unmount = (record: TargetRecord): void => {
    record.unobserveSize?.();
    record.unobserveSize = null;
    record.standIn?.dispose();
    record.standIn = null;
  };

  const forget = (record: TargetRecord): void => {
    unmount(record);
    record.unobserveVisibility();
    records.delete(record);
    byTarget.get(record.target)?.delete(record.adapter.id);
  };

  const failRecord = (record: TargetRecord, message: string, detail?: unknown): void => {
    if (!records.has(record)) return;
    log.error(`${record.adapter.id}: ${message}`, detail);
    errors.set(record.adapter.id, message);
    record.failure = message;
    forget(record);
    byTarget.get(record.target)?.set(record.adapter.id, record);
    failed.add(record);
    publish();
  };

  const healAllowed = (record: TargetRecord, now: number): boolean => {
    record.heals = record.heals.filter((at) => now - at < HEAL_WINDOW_MS);
    if (record.heals.length >= MAX_HEALS_PER_WINDOW) return false;
    record.heals.push(now);
    return true;
  };

  const mountRecord = (record: TargetRecord): void => {
    const rect = measure(record.target);
    try {
      const standIn = createStandIn({
        target: record.target,
        mode: record.adapter.mode,
        adapterId: record.adapter.id,
        theme: theme.get(),
        styles,
      });
      standIn.setRect(rect);
      record.rect = rect;
      record.standIn = standIn;
      record.unobserveSize = observers.observeSize(record.target, (next) => {
        if (next.width === record.rect.width && next.height === record.rect.height) return;
        record.rect = next;
        record.standIn?.setRect(next);
        // Coalesced: many resize frames share one publish per batch.
        publishPending = true;
        batcher.schedule();
      });
    } catch (error) {
      failRecord(record, "mount failed", error);
    }
  };

  const dropRecord = (record: TargetRecord): void => {
    forget(record);
  };

  const dropAll = (): void => {
    for (const record of [...records]) dropRecord(record);
  };

  /** Forgets failed records whose target left the document, so detached React subtrees can be collected. */
  const pruneFailed = (): void => {
    for (const record of [...failed]) {
      if (record.target.isConnected) continue;
      failed.delete(record);
      byTarget.get(record.target)?.delete(record.adapter.id);
    }
  };

  const countMounted = (): Map<string, number> => {
    const counts = new Map<string, number>();
    for (const record of records) {
      if (record.standIn) counts.set(record.adapter.id, (counts.get(record.adapter.id) ?? 0) + 1);
    }
    return counts;
  };

  const sumOf = (counts: ReadonlyMap<string, number>): number => {
    let total = 0;
    for (const value of counts.values()) total += value;
    return total;
  };

  const reconcile = (): void => {
    if (!isRunning()) return;
    pruneFailed();
    const counts = countMounted();
    const now = Date.now();
    let changed = false;
    for (const record of [...records]) {
      if (!record.target.isConnected || !isEnabled(record.adapter)) {
        if (record.standIn) decrement(counts, record.adapter.id);
        dropRecord(record);
        changed = true;
        continue;
      }
      if (record.standIn) {
        changed = reconcileMounted(record, counts, now) || changed;
        continue;
      }
      if (!record.visible) continue;
      const cap = record.adapter.maxInstances;
      if (cap !== undefined && (counts.get(record.adapter.id) ?? 0) >= cap) continue;
      if (sumOf(counts) >= MAX_TOTAL_MOUNTS) continue;
      mountRecord(record);
      if (record.standIn) {
        counts.set(record.adapter.id, (counts.get(record.adapter.id) ?? 0) + 1);
        changed = true;
      }
    }
    if (changed) publish();
  };

  const decrement = (counts: Map<string, number>, adapterId: string): void => {
    counts.set(adapterId, (counts.get(adapterId) ?? 1) - 1);
  };

  /** Returns true when the record's visible state or attachment changed. */
  const reconcileMounted = (record: TargetRecord, counts: Map<string, number>, now: number): boolean => {
    if (!record.visible) {
      unmount(record);
      decrement(counts, record.adapter.id);
      return true;
    }
    // A control that appeared inside a sibling target must not stay hidden under the overlay.
    if (record.adapter.mode === "sibling-replace" && hasInteractiveDescendant(record.target)) {
      decrement(counts, record.adapter.id);
      dropRecord(record);
      return true;
    }
    if (record.standIn?.isAttached()) {
      record.standIn.place();
      return false;
    }
    if (!healAllowed(record, now)) {
      failRecord(record, "re-heal limit reached");
      return true;
    }
    record.standIn?.reattach();
    log.debug(`re-healed ${record.adapter.id}`);
    return false;
  };

  /** A rejection that depends on layout is retried once the element has a box. */
  const deferUntilSized = (adapter: Adapter, el: Element): void => {
    const set = deferred.get(el) ?? new Set<string>();
    if (set.has(adapter.id)) return;
    set.add(adapter.id);
    deferred.set(el, set);
    const unobserve = observers.observeSize(el, (rect) => {
      if (isEmptyBox(rect)) return;
      unobserve();
      set.delete(adapter.id);
      pendingNodes.add(el);
      batcher.schedule();
    });
  };

  const rejectMatch = (adapter: Adapter, el: Element): void => {
    if (isEmptyBox(measure(el))) {
      deferUntilSized(adapter, el);
      return;
    }
    const set = rejected.get(el) ?? new Set<string>();
    set.add(adapter.id);
    rejected.set(el, set);
  };

  const consider = (adapter: Adapter, el: Element): void => {
    if (byTarget.get(el)?.has(adapter.id) || rejected.get(el)?.has(adapter.id)) return;
    if (adapter.mode === "sibling-replace" && hasInteractiveDescendant(el)) {
      rejectMatch(adapter, el);
      return;
    }
    if (adapter.match) {
      let accepted = false;
      try {
        accepted = adapter.match(el);
      } catch (error) {
        errors.set(adapter.id, "match threw");
        log.error(`${adapter.id}: match threw`, error);
        return;
      }
      if (!accepted) {
        rejectMatch(adapter, el);
        return;
      }
    }
    const overlay = adapter.mode === "overlay-fixed";
    const record: TargetRecord = {
      key: `${adapter.id}#${nextKey++}`,
      adapter,
      target: el,
      visible: overlay,
      rect: measure(el),
      standIn: null,
      failure: null,
      heals: [],
      unobserveVisibility: NO_OP,
      unobserveSize: null,
    };
    if (!overlay) {
      record.unobserveVisibility = observers.observeVisibility(el, (visible) => {
        record.visible = visible;
        scheduleReconcile();
      });
    }
    records.add(record);
    const map = byTarget.get(el) ?? new Map<string, TargetRecord>();
    map.set(adapter.id, record);
    byTarget.set(el, map);
    needsReconcile = true;
  };

  const scanRoots = (roots: readonly Element[]): void => {
    for (const adapter of adapters) {
      if (!isEnabled(adapter)) continue;
      for (const el of findCandidates(adapter, roots, log)) {
        if (!isOwnHost(el)) consider(adapter, el);
      }
    }
  };

  const flush = (): void => {
    const nodes = [...pendingNodes].filter((node) => node.isConnected);
    pendingNodes.clear();
    if (!isRunning()) return;
    if (pendingFull) {
      pendingFull = false;
      scanRoots([document.documentElement]);
    } else if (nodes.length > 0) {
      scanRoots(nodes);
    }
    const reconcileNow = needsReconcile;
    needsReconcile = false;
    if (reconcileNow || nodes.length > 0) reconcile();
    if (publishPending) {
      publishPending = false;
      publish();
    }
  };

  const batcher = createBatcher(flush);

  function scheduleReconcile(): void {
    needsReconcile = true;
    batcher.schedule();
  }

  const onMutations = (mutations: MutationRecord[]): void => {
    let relevant = false;
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof Element && !isOwnHost(node)) {
          pendingNodes.add(node);
          relevant = true;
        }
      }
      if (mutation.removedNodes.length > 0) relevant = true;
    }
    if (relevant) {
      needsReconcile = true;
      batcher.schedule();
    }
  };

  const pauseObservation = (): void => {
    mutationObserver?.disconnect();
    observing = false;
    observers.pause();
  };

  const resumeObservation = (): void => {
    if (!mutationObserver) mutationObserver = new MutationObserver(onMutations);
    if (!observing) {
      mutationObserver.observe(document, { childList: true, subtree: true });
      observing = true;
    }
    observers.resume();
  };

  const applyRunState = (): void => {
    if (disposed) return;
    if (!settings.get().master) {
      pauseObservation();
      dropAll();
      publish();
      return;
    }
    if (document.hidden) {
      pauseObservation();
      return;
    }
    resumeObservation();
    pendingFull = true;
    needsReconcile = true;
    batcher.schedule();
    publish();
  };

  const onThemeChange = (): void => {
    const next = theme.get();
    for (const record of records) record.standIn?.setTheme(next);
    publish();
  };

  const listAdapters = (): AdapterInfo[] =>
    adapters.map((adapter) => {
      const tracked = [...records].filter((record) => record.adapter === adapter);
      return {
        id: adapter.id,
        label: adapter.label,
        group: adapter.group,
        ditherComponents: adapter.ditherComponents,
        defaultEnabled: adapter.defaultEnabled,
        enabled: isEnabled(adapter),
        maxInstances: adapter.maxInstances ?? null,
        matched: tracked.length,
        mounted: tracked.filter((record) => record.standIn !== null).length,
        error: errors.get(adapter.id) ?? null,
      };
    });

  return {
    start: () => {
      if (disposed) return;
      unsubscribers.push(settings.subscribe(applyRunState));
      unsubscribers.push(theme.subscribe(onThemeChange));
      unsubscribers.push(deps.subscribeRoute(() => {
        pendingFull = true;
        batcher.schedule();
      }));
      const onVisibility = (): void => applyRunState();
      document.addEventListener("visibilitychange", onVisibility);
      unsubscribers.push(() => document.removeEventListener("visibilitychange", onVisibility));
      applyRunState();
    },
    dispose: () => {
      disposed = true;
      batcher.cancel();
      pauseObservation();
      dropAll();
      for (const unsubscribe of unsubscribers.splice(0)) unsubscribe();
      publish();
    },
    list: listAdapters,
    matchCounts: () =>
      Object.fromEntries(listAdapters().map((info) => [info.id, info.matched])),
    errors: () => Object.fromEntries(errors),
    rescan: () => {
      for (const record of [...failed]) {
        byTarget.get(record.target)?.delete(record.adapter.id);
      }
      failed.clear();
      errors.clear();
      rejected = new WeakMap<Element, Set<string>>();
      pendingFull = true;
      batcher.schedule();
    },
  };
};
