import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/**
 * Builds the production and demo bundles before any spec runs.
 * When DCF_BUNDLE is set (a private bundle, e.g. dist/dev-<key>.user.js), the production
 * bundle is NOT rebuilt, so parallel engineers never overwrite dist/cloudflare-dither.user.js.
 */
export default function globalSetup(): void {
  const build = (args: string[]): void => {
    execFileSync(process.execPath, ["scripts/build.mjs", ...args], { cwd: ROOT, stdio: "inherit" });
  };
  if (!process.env.DCF_BUNDLE) build([]);
  build(["--demo", "--out", "dist/core-demo.user.js"]);
}
