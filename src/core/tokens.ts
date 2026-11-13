/**
 * Token bridge. Every value is `var(--color-kumo-*, <concrete fallback>)`, so the
 * Kumo palette drives colours when the page provides it (and flips with data-mode),
 * and the fallbacks keep the stand-ins readable when it does not.
 *
 * Shadow stand-ins get the full shadcn + dither set on :host. The page gets ONLY
 * the --dither-* set on :root (namespaced, so nothing on the host page can clash).
 */

interface ColorToken {
  readonly name: string;
  readonly kumo: string;
  readonly light: string;
  readonly dark: string;
}

const SHADCN_TOKENS: readonly ColorToken[] = [
  { name: "background", kumo: "--color-kumo-base", light: "oklch(1 0 0)", dark: "oklch(0.145 0 0)" },
  { name: "foreground", kumo: "--text-color-kumo-default", light: "oklch(0.145 0 0)", dark: "oklch(0.985 0 0)" },
  { name: "card", kumo: "--color-kumo-elevated", light: "oklch(1 0 0)", dark: "oklch(0.205 0 0)" },
  { name: "card-foreground", kumo: "--text-color-kumo-default", light: "oklch(0.145 0 0)", dark: "oklch(0.985 0 0)" },
  { name: "popover", kumo: "--color-kumo-elevated", light: "oklch(1 0 0)", dark: "oklch(0.269 0 0)" },
  { name: "popover-foreground", kumo: "--text-color-kumo-default", light: "oklch(0.145 0 0)", dark: "oklch(0.985 0 0)" },
  { name: "primary", kumo: "--color-kumo-brand", light: "oklch(57.72% 0.2324 260)", dark: "oklch(51.948% 0.2324 260)" },
  { name: "primary-foreground", kumo: "--color-kumo-base", light: "oklch(1 0 0)", dark: "oklch(1 0 0)" },
  { name: "secondary", kumo: "--color-kumo-tint", light: "oklch(0.97 0 0)", dark: "oklch(0.269 0 0)" },
  { name: "secondary-foreground", kumo: "--text-color-kumo-default", light: "oklch(0.205 0 0)", dark: "oklch(0.985 0 0)" },
  { name: "muted", kumo: "--color-kumo-recessed", light: "oklch(0.97 0 0)", dark: "oklch(0.269 0 0)" },
  { name: "muted-foreground", kumo: "--text-color-kumo-subtle", light: "oklch(0.556 0 0)", dark: "oklch(0.708 0 0)" },
  { name: "accent", kumo: "--color-kumo-tint", light: "oklch(0.97 0 0)", dark: "oklch(0.269 0 0)" },
  { name: "accent-foreground", kumo: "--text-color-kumo-default", light: "oklch(0.205 0 0)", dark: "oklch(0.985 0 0)" },
  { name: "destructive", kumo: "--color-kumo-danger", light: "oklch(0.577 0.245 27.325)", dark: "oklch(0.704 0.191 22.216)" },
  { name: "border", kumo: "--color-kumo-line", light: "oklch(0.922 0 0)", dark: "oklch(1 0 0 / 10%)" },
  { name: "input", kumo: "--color-kumo-fill", light: "oklch(0.922 0 0)", dark: "oklch(1 0 0 / 15%)" },
  { name: "ring", kumo: "--color-kumo-focus", light: "oklch(0.708 0 0)", dark: "oklch(0.556 0 0)" },
  { name: "chart-1", kumo: "--color-kumo-brand", light: "oklch(0.646 0.222 41.116)", dark: "oklch(0.646 0.222 41.116)" },
  { name: "chart-2", kumo: "--color-kumo-success", light: "oklch(0.6 0.118 184.704)", dark: "oklch(0.6 0.118 184.704)" },
  { name: "chart-3", kumo: "--color-kumo-info", light: "oklch(0.398 0.07 227.392)", dark: "oklch(0.398 0.07 227.392)" },
  { name: "chart-4", kumo: "--color-kumo-warning", light: "oklch(0.828 0.189 84.429)", dark: "oklch(0.828 0.189 84.429)" },
  { name: "chart-5", kumo: "--color-kumo-danger", light: "oklch(0.769 0.188 70.08)", dark: "oklch(0.769 0.188 70.08)" },
];

const DITHER_TOKENS: readonly ColorToken[] = [
  { name: "dither-ink", kumo: "--text-color-kumo-default", light: "oklch(0.205 0 0)", dark: "oklch(0.985 0 0)" },
  { name: "dither-paper", kumo: "--color-kumo-base", light: "oklch(1 0 0)", dark: "oklch(0.145 0 0)" },
  { name: "dither-color-blue", kumo: "--color-kumo-info", light: "oklch(0.56 0.18 248)", dark: "oklch(0.72 0.14 240)" },
  { name: "dither-color-purple", kumo: "--color-kumo-brand", light: "oklch(0.53 0.22 302)", dark: "oklch(0.7 0.18 304)" },
  { name: "dither-color-green", kumo: "--color-kumo-success", light: "oklch(0.58 0.15 152)", dark: "oklch(0.78 0.17 152)" },
  { name: "dither-color-pink", kumo: "--color-kumo-brand", light: "oklch(0.58 0.21 355)", dark: "oklch(0.74 0.17 354)" },
  { name: "dither-color-orange", kumo: "--color-kumo-warning", light: "oklch(0.64 0.17 52)", dark: "oklch(0.79 0.15 62)" },
  { name: "dither-color-red", kumo: "--color-kumo-danger", light: "oklch(0.55 0.21 27)", dark: "oklch(0.68 0.2 25)" },
  { name: "dither-color-grey", kumo: "--color-kumo-fill", light: "oklch(0.55 0 0)", dark: "oklch(0.66 0 0)" },
];

const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";

const declarations = (tokens: readonly ColorToken[], theme: "light" | "dark"): string =>
  tokens
    .map((token) => `  --${token.name}: var(${token.kumo}, ${theme === "light" ? token.light : token.dark});`)
    .join("\n");

const buildBlock = (selector: string, body: string): string => `${selector} {\n${body}\n}`;

const hostShared = (theme: "light" | "dark"): string =>
  [SHADCN_TOKENS, DITHER_TOKENS]
    .map((set) => declarations(set, theme))
    .concat([
      theme === "light" ? "  --radius: 0.625rem;" : "",
      theme === "light" ? `  --ease-out: ${EASE_OUT};` : "",
      theme === "light" ? "  --dither-cell: 3px;" : "",
      theme === "light" ? "  --dither-bloom: 0.6;" : "  --dither-bloom: 1;",
    ])
    .filter((line) => line !== "")
    .join("\n");

const pageShared = (theme: "light" | "dark"): string =>
  [declarations(DITHER_TOKENS, theme), theme === "light" ? "  --dither-cell: 3px;" : ""]
    .filter((line) => line !== "")
    .join("\n");

/** CSS for every stand-in shadow root (adopted with the shared sheet). */
export const buildHostTokenCss = (): string =>
  [
    buildBlock(":host", hostShared("light")),
    buildBlock(':host([data-dcf-theme="dark"])', hostShared("dark")),
  ].join("\n");

/** CSS for the page: --dither-* only, on :root and on the dark-marked root. */
export const buildPageTokenCss = (): string =>
  [
    buildBlock(":root", pageShared("light")),
    buildBlock(':root[data-dcf-theme="dark"]', pageShared("dark")),
  ].join("\n");
