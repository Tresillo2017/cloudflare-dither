/** Small runtime guards for untrusted option objects read from a page's React props. */

export type UnknownRecord = Record<string, unknown>;

export const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Wraps a single object or an array of objects into an array of records. */
export const recordsOf = (value: unknown): UnknownRecord[] => {
  const items = Array.isArray(value) ? value : [value];
  return items.filter(isRecord);
};

export const finiteOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() !== "" ? value : undefined;
