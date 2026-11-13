/**
 * Public surface of the core. Adapters and the UI import types from here only.
 * Runtime helpers are re-exported for adapter authors: see docs/adapter-authoring.md.
 */
import type { DiagnosticsApi } from "./diagnostics";
import type { Log } from "./log";
import type { RegistryApi } from "./registry";
import type { SettingsStore } from "./settings";
import type { StylesApi } from "./styles";
import type { ThemeStore } from "./theme";

export type {
  Adapter,
  AdapterContext,
  AdapterGroup,
  SelectorConfidence,
  SelectorSpec,
  StandInMode,
  TargetPseudoState,
  TargetStateOptions,
} from "./types";
export type { Settings, SettingsStore } from "./settings";
export { DEFAULT_SETTINGS, isAdapterEnabled } from "./settings";
export type { Log, LogEntry, LogLevel } from "./log";
export type { AdapterInfo, RegistryApi } from "./registry";
export type { Census, DiagnosticsApi } from "./diagnostics";
export type { StylesApi } from "./styles";
export type { ThemeName, ThemeStore } from "./theme";
export type { Rect } from "./host";
export { DcfStyle } from "./dcf-style";

/** The object the UI and tests use. Created once per page by createCore(). */
export interface Core {
  readonly settings: SettingsStore;
  readonly registry: RegistryApi;
  readonly theme: ThemeStore;
  readonly diagnostics: DiagnosticsApi;
  readonly styles: StylesApi;
  readonly log: Log;
}
