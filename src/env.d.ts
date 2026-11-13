declare module "*.css" {
  const css: string;
  export default css;
}

/** Injected by scripts/build.mjs (esbuild define). */
declare const __DCF_TAILWIND_CSS__: string;
declare const __DCF_DEMO__: boolean;
