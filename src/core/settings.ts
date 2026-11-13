import type { Adapter } from "./types";
import type { Log } from "./log";

export interface Settings {
  readonly master: boolean;
  readonly debug: boolean;
  /** Per-adapter overrides. Absent key means adapter.defaultEnabled. */
  readonly adapters: Readonly<Record<string, boolean>>;
  readonly background: string;
  readonly intensity: number;
  readonly cell: number;
  readonly animate: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  master: true,
  debug: false,
  adapters: {},
  background: "dither-glow",
  intensity: 0.6,
  cell: 3,
  animate: true,
};

export const STORAGE_KEY = "cloudflare-dither:settings";

export interface SettingsStore {
  get(): Settings;
  update(patch: Partial<Settings>): void;
  setAdapterEnabled(adapterId: string, enabled: boolean): void;
  reset(): void;
  subscribe(listener: () => void): () => void;
}

/** Minimal persistence contract. GM_* when the manager grants it, localStorage otherwise. */
export interface KeyValueStorage {
  read(key: string): unknown;
  write(key: string, value: unknown): void;
}

export const isAdapterEnabled = (settings: Settings, adapter: Adapter): boolean =>
  settings.master && (settings.adapters[adapter.id] ?? adapter.defaultEnabled);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const pickNumber = (value: unknown, fallback: number, min: number, max: number): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

const pickBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === "boolean" ? value : fallback;

const pickAdapterFlags = (value: unknown): Record<string, boolean> => {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, boolean] => typeof entry[1] === "boolean"));
};

/** Validates untrusted stored data (never trust storage contents). */
export const sanitizeSettings = (raw: unknown): Settings => {
  if (!isRecord(raw)) return DEFAULT_SETTINGS;
  return {
    master: pickBoolean(raw.master, DEFAULT_SETTINGS.master),
    debug: pickBoolean(raw.debug, DEFAULT_SETTINGS.debug),
    adapters: pickAdapterFlags(raw.adapters),
    background: typeof raw.background === "string" ? raw.background : DEFAULT_SETTINGS.background,
    intensity: pickNumber(raw.intensity, DEFAULT_SETTINGS.intensity, 0, 1),
    cell: pickNumber(raw.cell, DEFAULT_SETTINGS.cell, 1, 16),
    animate: pickBoolean(raw.animate, DEFAULT_SETTINGS.animate),
  };
};

export const createSettingsStore = (storage: KeyValueStorage, log: Log): SettingsStore => {
  let current: Settings = sanitizeSettings(storage.read(STORAGE_KEY));
  const listeners = new Set<() => void>();

  const commit = (next: Settings): void => {
    if (next === current) return;
    current = next;
    try {
      storage.write(STORAGE_KEY, next);
    } catch (error) {
      log.warn("settings could not be persisted", error);
    }
    for (const listener of listeners) listener();
  };

  return {
    get: () => current,
    update: (patch) => commit(sanitizeSettings({ ...current, ...patch })),
    setAdapterEnabled: (adapterId, enabled) =>
      commit({ ...current, adapters: { ...current.adapters, [adapterId]: enabled } }),
    reset: () => commit(DEFAULT_SETTINGS),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

/** Picks GM_getValue/GM_setValue when granted, else localStorage. Every access is guarded. */
export const createDefaultStorage = (): KeyValueStorage => {
  const gm = globalThis as unknown as {
    GM_getValue?: (key: string, fallback?: unknown) => unknown;
    GM_setValue?: (key: string, value: unknown) => void;
  };
  if (typeof gm.GM_getValue === "function" && typeof gm.GM_setValue === "function") {
    const getValue = gm.GM_getValue.bind(gm);
    const setValue = gm.GM_setValue.bind(gm);
    return {
      read: (key) => {
        try {
          const raw = getValue(key);
          return typeof raw === "string" ? JSON.parse(raw) : raw;
        } catch {
          return undefined;
        }
      },
      write: (key, value) => setValue(key, JSON.stringify(value)),
    };
  }
  return {
    read: (key) => {
      try {
        const raw = localStorage.getItem(key);
        return raw === null ? undefined : JSON.parse(raw);
      } catch {
        return undefined;
      }
    },
    write: (key, value) => {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // Storage can be blocked (private windows). Settings then last for the session only.
      }
    },
  };
};
