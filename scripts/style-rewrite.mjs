// Rewrites hoisted component <style> blocks in vendored dithercn sources into
// <DcfStyle> elements. React 19 would otherwise insert these as real <style>
// nodes (blocked by strict page CSP and logged as console errors); DcfStyle
// registers the same CSS in the shared constructable stylesheet instead.
const STYLE_OPEN = /<style\s/g;
const CLOSE_TAG = /^\s*<\/style>/;

/** Index just past the brace group that opens at `start` (src[start] === "{"). */
const skipBraces = (src, start) => {
  let depth = 0;
  let index = start;
  while (index < src.length) {
    const ch = src[index];
    if (ch === '"' || ch === "'" || ch === "`") {
      index = skipQuoted(src, index);
      continue;
    }
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
    index += 1;
  }
  return -1;
};

/** Index just past a quoted string starting at `start`. */
const skipQuoted = (src, start) => {
  const quote = src[start];
  let index = start + 1;
  while (index < src.length && src[index] !== quote) {
    index += src[index] === "\\" ? 2 : 1;
  }
  return index + 1;
};

/** Parses the attribute list of a <style ...> tag. Returns null on unknown syntax. */
const readAttributes = (src, start) => {
  const attrs = [];
  let index = start;
  for (;;) {
    while (/\s/.test(src[index] ?? "")) index += 1;
    if (src[index] === ">") return { attrs, end: index + 1 };
    const name = /^[\w-]+/.exec(src.slice(index))?.[0];
    if (!name) return null;
    index += name.length;
    if (src[index] !== "=") return null;
    index += 1;
    if (src[index] === '"') {
      const end = skipQuoted(src, index);
      attrs.push({ name, raw: src.slice(index, end) });
      index = end;
    } else if (src[index] === "{") {
      const end = skipBraces(src, index);
      if (end < 0) return null;
      attrs.push({ name, raw: src.slice(index, end) });
      index = end;
    } else {
      return null;
    }
  }
};

/**
 * Finds `<style href=… precedence=…>{expr}</style>` blocks and replaces each
 * with `<DcfStyle href=… css={expr} />`. Unrecognised shapes are left alone.
 * Returns { code, count }.
 */
export const rewriteStyleBlocks = (src, importPath) => {
  let out = "";
  let cursor = 0;
  let count = 0;
  STYLE_OPEN.lastIndex = 0;
  for (let match = STYLE_OPEN.exec(src); match; match = STYLE_OPEN.exec(src)) {
    const tagStart = match.index;
    const parsed = readAttributes(src, tagStart + match[0].length);
    if (!parsed) continue;
    const href = parsed.attrs.find((attr) => attr.name === "href");
    if (!href) continue;
    const childStart = parsed.end;
    const childBrace = /^\s*\{/.exec(src.slice(childStart));
    if (!childBrace) continue;
    const braceAt = childStart + childBrace[0].length - 1;
    const childEnd = skipBraces(src, braceAt);
    if (childEnd < 0) continue;
    const close = CLOSE_TAG.exec(src.slice(childEnd));
    if (!close) continue;
    const expr = src.slice(braceAt + 1, childEnd - 1).trim();
    const replacement = `<DcfStyle href=${href.raw} css={${expr}} />`;
    out += src.slice(cursor, tagStart) + replacement;
    cursor = childEnd + close[0].length;
    STYLE_OPEN.lastIndex = cursor;
    count += 1;
  }
  if (count === 0) return { code: src, count };
  out += src.slice(cursor);
  return { code: `import { DcfStyle } from ${JSON.stringify(importPath)};\n${out}`, count };
};
