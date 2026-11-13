/** Deterministic fixture data. No Math.random so census and screenshots stay stable. */

const HOUR_MS = 3_600_000;
const SERIES_START_MS = Date.UTC(2026, 10, 1, 0, 0, 0);
const SERIES_POINTS = 48;
const SERIES_PHASE_STEP = 4;
const SERIES_HARMONIC_STEP = 2;

export const COLORS = {
  orange: "#f38020",
  blue: "#2563eb",
  green: "#16a34a",
  red: "#dc2626",
} as const;

export function buildSeries(seed: number, scale: number): [number, number][] {
  return Array.from({ length: SERIES_POINTS }, (_, index) => {
    const wave = 1 + 0.35 * Math.sin((index + seed) / SERIES_PHASE_STEP);
    const ripple = 0.1 * Math.cos(index / SERIES_HARMONIC_STEP);
    return [SERIES_START_MS + index * HOUR_MS, Math.round(scale * (wave + ripple))];
  });
}

export const REQUEST_SERIES = [
  { name: "Requests", data: buildSeries(0, 12000), color: COLORS.orange },
  { name: "Cached", data: buildSeries(3, 9000), color: COLORS.blue },
];

export const ERROR_SERIES = [
  { name: "5xx errors", data: buildSeries(7, 240), color: COLORS.red },
];

export interface ZoneRow {
  readonly id: string;
  readonly name: string;
  readonly plan: string;
  readonly requests: string;
  readonly status: "Active" | "Pending" | "Paused" | "Error";
}

export const ZONES: readonly ZoneRow[] = [
  { id: "z-01", name: "example.com", plan: "Pro", requests: "482,190", status: "Active" },
  { id: "z-02", name: "shop.example.org", plan: "Business", requests: "301,774", status: "Active" },
  { id: "z-03", name: "docs.example.net", plan: "Free", requests: "12,068", status: "Pending" },
  { id: "z-04", name: "staging.example.dev", plan: "Free", requests: "0", status: "Paused" },
  { id: "z-05", name: "api.example.io", plan: "Enterprise", requests: "689,402", status: "Error" },
];

export const COUNTRY_SHARES: readonly { name: string; value: number }[] = [
  { name: "United States", value: 34 },
  { name: "Germany", value: 18 },
  { name: "Japan", value: 12 },
  { name: "Brazil", value: 9 },
  { name: "Other", value: 27 },
];
