/**
 * One shared attribute/subtree MutationObserver for every useTargetState listener.
 * A MutationObserver cannot unobserve a single node, so listeners are gated through
 * a WeakMap and notified only for the records they asked for.
 */
export interface WatchOptions {
  subtree: boolean;
  attributes?: readonly string[];
}

interface Watcher extends WatchOptions {
  readonly notify: () => void;
}

const watchers = new WeakMap<Element, Set<Watcher>>();
const subtreeObserved = new WeakSet<Element>();
const anyObserved = new WeakSet<Element>();
let observer: MutationObserver | null = null;

const ensureObserver = (): MutationObserver => {
  if (!observer) {
    observer = new MutationObserver(dispatch);
  }
  return observer;
};

const ancestorsOrSelf = (node: Node): Element[] => {
  const found: Element[] = [];
  let current: Node | null = node;
  while (current) {
    if (current instanceof Element && watchers.has(current)) found.push(current);
    current = current.parentNode;
  }
  return found;
};

function dispatch(records: MutationRecord[]): void {
  const pending = new Set<Watcher>();
  for (const record of records) {
    for (const el of ancestorsOrSelf(record.target)) {
      const isSelf = el === record.target;
      for (const watcher of watchers.get(el) ?? []) {
        if (!isSelf && !watcher.subtree) continue;
        if (record.type === "attributes" && watcher.attributes && !watcher.attributes.includes(record.attributeName ?? "")) {
          continue;
        }
        pending.add(watcher);
      }
    }
  }
  for (const watcher of pending) {
    try {
      watcher.notify();
    } catch (error) {
      // One failing reader must not skip the other watchers of this batch. Re-throw on a
      // separate task so the error reaches the page console and the owning boundary.
      queueMicrotask(() => {
        throw error;
      });
    }
  }
}

/** Starts watching `el`. Returns the unsubscribe function. */
export const watchTarget = (el: Element, options: WatchOptions & { notify: () => void }): (() => void) => {
  const mo = ensureObserver();
  if (options.subtree && !subtreeObserved.has(el)) {
    subtreeObserved.add(el);
    anyObserved.add(el);
    mo.observe(el, { attributes: true, childList: true, characterData: true, subtree: true });
  } else if (!anyObserved.has(el)) {
    anyObserved.add(el);
    mo.observe(el, { attributes: true });
  }
  const watcher: Watcher = { subtree: options.subtree, attributes: options.attributes, notify: options.notify };
  const set = watchers.get(el) ?? new Set<Watcher>();
  set.add(watcher);
  watchers.set(el, set);
  return () => {
    watchers.get(el)?.delete(watcher);
  };
};
