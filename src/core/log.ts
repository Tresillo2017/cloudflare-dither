export type LogLevel = "debug" | "warn" | "error";

export interface LogEntry {
  readonly level: LogLevel;
  readonly message: string;
  readonly at: number;
}

export interface Log {
  debug(message: string, detail?: unknown): void;
  warn(message: string, detail?: unknown): void;
  error(message: string, detail?: unknown): void;
  entries(): readonly LogEntry[];
}

const MAX_ENTRIES = 200;

const describe = (detail: unknown): string => {
  if (detail === undefined) return "";
  if (detail instanceof Error) return `: ${detail.message}`;
  if (typeof detail === "string") return `: ${detail}`;
  return "";
};

/**
 * Keeps a bounded in-memory history for diagnostics. Nothing reaches the console
 * unless settings.debug is on, so a page never sees console noise from the script.
 */
export const createLog = (isDebug: () => boolean): Log => {
  let history: readonly LogEntry[] = [];

  const push = (level: LogLevel, message: string, detail?: unknown): void => {
    const text = `${message}${describe(detail)}`;
    const entry: LogEntry = { level, message: text, at: Date.now() };
    history = [...history, entry].slice(-MAX_ENTRIES);
    if (!isDebug()) return;
    if (level === "error") console.error("[dcf]", text, detail);
    else if (level === "warn") console.warn("[dcf]", text, detail);
    else console.debug("[dcf]", text, detail);
  };

  return {
    debug: (message, detail) => push("debug", message, detail),
    warn: (message, detail) => push("warn", message, detail),
    error: (message, detail) => push("error", message, detail),
    entries: () => history,
  };
};
