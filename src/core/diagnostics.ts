import type { AdapterInfo, RegistryApi } from "./registry";
import type { Log } from "./log";
import type { ThemeStore } from "./theme";

const TOP_N = 40;
const LOG_TAIL = 20;

/** Counts of structural attributes only. No text content, no URL path (it carries account ids). */
export interface Census {
  readonly generatedAt: string;
  readonly pathShape: string;
  readonly theme: string;
  readonly kumoComponents: Readonly<Record<string, number>>;
  readonly testIdPrefixes: Readonly<Record<string, number>>;
  readonly roles: Readonly<Record<string, number>>;
  readonly echartsInstances: number;
  readonly svgElements: number;
  readonly cspMetaPresent: boolean;
  readonly adapters: readonly AdapterInfo[];
  readonly recentLog: readonly string[];
}

export interface DiagnosticsApi {
  census(): Census;
  copy(): Promise<boolean>;
}

export interface DiagnosticsDeps {
  readonly registry: RegistryApi;
  readonly theme: ThemeStore;
  readonly log: Log;
}

const countBy = (values: Iterable<string | null>): Record<string, number> => {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Object.fromEntries([...counts].sort((a, b) => b[1] - a[1]).slice(0, TOP_N));
};

const attrValues = (selector: string, attribute: string): (string | null)[] =>
  [...document.querySelectorAll(selector)].map((el) => el.getAttribute(attribute));

/** Replaces id-like path segments with {id} so the shape is shareable. */
export const pathShape = (pathname: string): string =>
  pathname
    .split("/")
    .map((segment) => (/\d|[0-9a-f]{16,}/i.test(segment) ? "{id}" : segment))
    .join("/");

export const createDiagnostics = (deps: DiagnosticsDeps): DiagnosticsApi => {
  const census = (): Census => ({
    generatedAt: new Date().toISOString(),
    pathShape: pathShape(location.pathname),
    theme: deps.theme.get(),
    kumoComponents: countBy(attrValues("[data-kumo-component]", "data-kumo-component")),
    testIdPrefixes: countBy(
      attrValues("[data-testid]", "data-testid").map((value) => (value ? value.split(/[-_:.]/)[0] ?? null : null)),
    ),
    roles: countBy(attrValues("[role]", "role")),
    echartsInstances: document.querySelectorAll("[_echarts_instance_]").length,
    svgElements: document.querySelectorAll("svg").length,
    cspMetaPresent: document.querySelector('meta[http-equiv="Content-Security-Policy" i]') !== null,
    adapters: deps.registry.list(),
    recentLog: deps.log.entries().slice(-LOG_TAIL).map((entry) => `${entry.level}: ${entry.message}`),
  });

  return {
    census,
    copy: async () => {
      try {
        await navigator.clipboard.writeText(JSON.stringify(census(), null, 2));
        return true;
      } catch (error) {
        deps.log.warn("census copy failed", error);
        return false;
      }
    },
  };
};
