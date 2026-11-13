#!/usr/bin/env node
/**
 * Builds the mock Cloudflare dashboard into fixture/dist (static files).
 *   node fixture/build.mjs
 * Steps: Tailwind v4 (Kumo styles) -> kumo.css, esbuild -> app.js + app.css (legacy styles),
 * copy index.html and public/ assets.
 */
import { execFile } from "node:child_process";
import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { build as esbuild } from "esbuild";

const execFileAsync = promisify(execFile);
const FIXTURE_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(FIXTURE_DIR, "..");
const DIST_DIR = path.join(FIXTURE_DIR, "dist");
const TAILWIND_BIN = path.join(ROOT_DIR, "node_modules", ".bin", "tailwindcss");
const TAILWIND_ENTRY = path.join(FIXTURE_DIR, "src", "styles.css");
const APP_ENTRY = path.join(FIXTURE_DIR, "src", "main.tsx");
const PUBLIC_DIR = path.join(FIXTURE_DIR, "public");
const INDEX_HTML = path.join(FIXTURE_DIR, "index.html");

async function buildKumoStyles() {
  await execFileAsync(TAILWIND_BIN, ["-i", TAILWIND_ENTRY, "-o", path.join(DIST_DIR, "kumo.css")], {
    cwd: ROOT_DIR,
  });
}

async function buildScripts() {
  await esbuild({
    entryPoints: [APP_ENTRY],
    outdir: DIST_DIR,
    entryNames: "app",
    bundle: true,
    format: "iife",
    target: "es2022",
    jsx: "automatic",
    sourcemap: false,
    minify: false,
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "warning",
  });
}

async function copyStatic() {
  await cp(INDEX_HTML, path.join(DIST_DIR, "index.html"));
  await cp(PUBLIC_DIR, DIST_DIR, { recursive: true });
}

/** Builds the fixture into fixture/dist. Throws on any failure. */
export async function buildFixture() {
  await rm(DIST_DIR, { recursive: true, force: true });
  await mkdir(DIST_DIR, { recursive: true });
  await buildKumoStyles();
  await buildScripts();
  await copyStatic();
  return DIST_DIR;
}

const isEntryPoint = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
if (isEntryPoint) {
  buildFixture()
    .then((dir) => {
      process.stdout.write(`Fixture built into ${dir}\n`);
    })
    .catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`Fixture build failed: ${message}\n`);
      process.exitCode = 1;
    });
}
