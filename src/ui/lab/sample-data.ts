/** Deterministic sample data for the Lab. Nothing here comes from the page. */

export interface TimePoint {
  readonly day: string;
  readonly requests: number;
  readonly errors: number;
  readonly low: number;
  readonly high: number;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"] as const;

export const TIME_SERIES: readonly TimePoint[] = DAYS.map((day, index) => {
  const wave = Math.sin(index / 1.6);
  const requests = Math.round(120 + 60 * wave + index * 6);
  const errors = Math.round(12 + 6 * Math.cos(index / 2));
  return { day, requests, errors, low: requests - 18, high: requests + 18 };
});

export const SAMPLE_SLICES = [
  { label: "Cache", value: 46 },
  { label: "Origin", value: 28 },
  { label: "Edge", value: 16 },
  { label: "Other", value: 10 },
] as const;

export const SAMPLE_HEATMAP_DAYS = Array.from({ length: 140 }, (_, index) => ({
  date: new Date(Date.UTC(2026, 0, 1 + index)).toISOString().slice(0, 10),
  value: (index * 37) % 11,
}));

export const SAMPLE_MATRIX = [
  [3, 7, 2, 9],
  [5, 1, 8, 4],
  [6, 9, 3, 2],
] as const;

export const SAMPLE_UPTIME = Array.from({ length: 30 }, (_, index) => ({
  date: new Date(Date.UTC(2026, 9, 1 + index)).toISOString().slice(0, 10),
  uptime: index === 12 ? 0.92 : index === 21 ? null : 0.998 + (index % 3) * 0.0005,
}));

const sampleSvg = (): string => `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6821f"/><stop offset="0.55" stop-color="#2563eb"/><stop offset="1" stop-color="#14141c"/></linearGradient></defs>
<rect width="320" height="200" fill="url(#g)"/>
<circle cx="236" cy="62" r="34" fill="#fff" fill-opacity="0.85"/>
<path d="M0 150 C 60 110, 120 190, 180 140 S 290 110, 320 150 L320 200 L0 200 Z" fill="#0b0b10" fill-opacity="0.75"/>
</svg>`;

/** A bundled sample image as a data URI (no network). */
export const SAMPLE_IMAGE: string = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(sampleSvg())}`;
