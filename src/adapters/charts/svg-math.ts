/**
 * Pure helpers for scraping legacy SVG charts: tick-label parsing, linear axis calibration
 * and path vertex parsing. No DOM access here, so every function is unit-tested in node.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface AxisFit {
  readonly slope: number;
  readonly intercept: number;
  /** Coefficient of determination of the fit, 0 to 1. */
  readonly r2: number;
  /** Maps a pixel position to a value. */
  apply(position: number): number;
}

/** Minimum R-squared for an axis to count as calibrated. Below this the tick labels disagree with the grid. */
export const MIN_AXIS_R2 = 0.995;
const MIN_TICKS = 2;
const NUMERIC_LABEL = /^(-?\d+(?:\.\d+)?)\s*([kKmMbB]?)$/;
const TIME_LABEL = /^(\d{1,2}):(\d{2})$/;
const SUFFIX_SCALE: Readonly<Record<string, number>> = { "": 1, k: 1e3, K: 1e3, m: 1e6, M: 1e6, b: 1e9, B: 1e9 };

/** "10k" -> 10000, "0" -> 0, "1.5M" -> 1500000. Anything else (including times) is null. */
export const parseNumericLabel = (text: string): number | null => {
  const match = NUMERIC_LABEL.exec(text.trim());
  if (!match) return null;
  const base = Number(match[1]);
  const scale = SUFFIX_SCALE[match[2] ?? ""];
  return scale === undefined || !Number.isFinite(base) ? null : base * scale;
};

/** "06:00" -> 360 (minutes since midnight). Anything else is null. */
export const parseTimeLabel = (text: string): number | null => {
  const match = TIME_LABEL.exec(text.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours <= 24 && minutes < 60 ? hours * 60 + minutes : null;
};

/** "02:11" style label for a minute count, rounded to the nearest minute. */
export const formatMinutes = (minutes: number): string => {
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60) % 24;
  const rest = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
};

/** Least-squares line through (position, value) pairs. Null with fewer than two distinct positions. */
export const fitAxis = (samples: readonly { position: number; value: number }[]): AxisFit | null => {
  if (samples.length < MIN_TICKS) return null;
  const count = samples.length;
  const meanP = samples.reduce((sum, s) => sum + s.position, 0) / count;
  const meanV = samples.reduce((sum, s) => sum + s.value, 0) / count;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const { position, value } of samples) {
    sxx += (position - meanP) ** 2;
    sxy += (position - meanP) * (value - meanV);
    syy += (value - meanV) ** 2;
  }
  // A flat calibration (all labels equal) cannot scale data, so it is refused like identical positions.
  if (sxx === 0 || syy === 0) return null;
  const slope = sxy / sxx;
  const intercept = meanV - slope * meanP;
  const r2 = (sxy * sxy) / (sxx * syy);
  if (!Number.isFinite(slope) || !Number.isFinite(intercept) || r2 < MIN_AXIS_R2) return null;
  return { slope, intercept, r2, apply: (position: number) => slope * position + intercept };
};

/** Any letter is a token, so unsupported commands (C, S, Q, A ...) are refused, not skipped. */
const PATH_TOKEN = /[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g;

/**
 * Vertices of a path that uses only M, L, H, V and Z commands (absolute or relative).
 * Returns null for curves or arcs, because a vertex list is then not the data points.
 */
export const parsePathVertices = (d: string): Point[] | null => {
  const tokens = d.match(PATH_TOKEN) ?? [];
  const points: Point[] = [];
  let command = "";
  let x = 0;
  let y = 0;
  let index = 0;
  const number = (): number | null => {
    const token = tokens[index];
    index += 1;
    if (token === undefined || /[A-Za-z]/.test(token)) return null;
    const value = Number(token);
    return Number.isFinite(value) ? value : null;
  };
  while (index < tokens.length) {
    const token = tokens[index] ?? "";
    if (/[A-Za-z]/.test(token)) {
      command = token;
      index += 1;
      if (command === "Z" || command === "z") continue;
      if (!"MLHVmlhv".includes(command)) return null;
    } else if (command === "") {
      return null;
    }
    const relative = command === command.toLowerCase();
    const upper = command.toUpperCase();
    if (upper === "H" || upper === "V") {
      const value = number();
      if (value === null) return null;
      if (upper === "H") x = relative ? x + value : value;
      else y = relative ? y + value : value;
    } else {
      const nx = number();
      const ny = number();
      if (nx === null || ny === null) return null;
      x = relative ? x + nx : nx;
      y = relative ? y + ny : ny;
      if (upper === "M") command = relative ? "l" : "L";
    }
    points.push({ x, y });
  }
  return points.length >= MIN_TICKS ? points : null;
};

/** "Requests line chart" -> "Requests"; "Errors bar chart" -> "Errors". */
export const stripChartSuffix = (label: string): string =>
  label.replace(/\s+(line|bar|area|donut|pie)?\s*chart$/i, "").replace(/\s+donut$/i, "").trim();
