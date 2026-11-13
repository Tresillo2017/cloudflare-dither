// Builds the userscript.
//   node scripts/build.mjs [--out dist/x.user.js] [--dev] [--demo]
// --dev   readable output (no minify)
// --demo  also registers the core demo adapters (test bundles only, never production)
// Each run uses its own temp directory inside dist/, so concurrent builds with
// different --out values do not collide. The output is written tmp-then-rename.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { dithercnStylePlugin } from "./dithercn-style-plugin.mjs";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const TAILWIND_BIN = join(ROOT, "node_modules/.bin/tailwindcss");
const DEFAULT_OUT = "dist/cloudflare-dither.user.js";

export const parseArgs = (argv) => {
  const flags = { out: DEFAULT_OUT, dev: false, demo: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dev") flags.dev = true;
    else if (arg === "--demo") flags.demo = true;
    else if (arg === "--out") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) throw new Error("--out needs a path");
      flags.out = value;
      i += 1;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return flags;
};

export const userscriptHeader = ({ version, demo }) => `// ==UserScript==
// @name         Cloudflare Dither${demo ? " (test demo)" : ""}
// @namespace    https://github.com/Tresillo2017/cloudflare-dither
// @version      ${version}
// @description  Re-skins dash.cloudflare.com with dithercn components
// @author       Tomás Palma
// @license      MIT
// @homepageURL  https://github.com/Tresillo2017/cloudflare-dither
// @supportURL   https://github.com/Tresillo2017/cloudflare-dither/issues
// @downloadURL  https://raw.githubusercontent.com/Tresillo2017/cloudflare-dither/main/dist/cloudflare-dither.user.js
// @updateURL    https://raw.githubusercontent.com/Tresillo2017/cloudflare-dither/main/dist/cloudflare-dither.user.js
// @match        https://dash.cloudflare.com/*
// @run-at       document-idle
// @noframes
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// ==/UserScript==
`;

const runTailwind = (workDir) => {
  const out = join(workDir, "tailwind.css");
  execFileSync(TAILWIND_BIN, ["-i", join(ROOT, "styles/index.css"), "-o", out, "--minify"], {
    cwd: ROOT,
    stdio: ["ignore", "ignore", "inherit"],
  });
  return readFileSync(out, "utf8");
};

const bundle = async ({ flags, tailwindCss, workDir }) => {
  const rewritten = [];
  const result = await build({
    entryPoints: [join(ROOT, "src/main.tsx")],
    bundle: true,
    format: "iife",
    jsx: "automatic",
    target: "es2022",
    minify: !flags.dev,
    legalComments: "none",
    logLevel: "warning",
    write: false,
    outdir: workDir,
    loader: { ".css": "text" },
    define: {
      "process.env.NODE_ENV": flags.dev ? '"development"' : '"production"',
      __DCF_TAILWIND_CSS__: JSON.stringify(tailwindCss),
      __DCF_DEMO__: flags.demo ? "true" : "false",
    },
    plugins: [
      dithercnStylePlugin(join(ROOT, "src/core/dcf-style.tsx"), (file, count) =>
        rewritten.push(`${relative(ROOT, file)}: ${count}`),
      ),
    ],
  });
  return { code: result.outputFiles[0].text, rewritten };
};

const main = async () => {
  const flags = parseArgs(process.argv.slice(2));
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const target = resolve(ROOT, flags.out);
  mkdirSync(dirname(target), { recursive: true });
  const workDir = mkdtempSync(join(ROOT, "dist", ".build-"));
  try {
    const tailwindCss = runTailwind(workDir);
    const { code, rewritten } = await bundle({ flags, tailwindCss, workDir });
    const tmpOut = join(workDir, "out.user.js");
    writeFileSync(tmpOut, `${userscriptHeader({ version: pkg.version, demo: flags.demo })}${code}`);
    renameSync(tmpOut, target);
    console.log(`built ${relative(ROOT, target)} (${readFileSync(target).length} bytes)`);
    for (const line of rewritten) console.log(`  style blocks rewritten: ${line}`);
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
