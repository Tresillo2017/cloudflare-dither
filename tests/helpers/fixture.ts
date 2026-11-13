import { spawn, type ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const LISTEN_PATTERN = /LISTENING (\d+)/;
const START_TIMEOUT_MS = 15_000;

export interface FixtureServer {
  readonly baseUrl: string;
  stop(): Promise<void>;
}

/**
 * Starts scripts/serve-fixture.mjs on an ephemeral port. The server prints
 * `LISTENING <port>` on stdout once ready. Routes: /, /legacy, /missing, ?csp=strict|default.
 */
export const startFixture = (): Promise<FixtureServer> =>
  new Promise((resolve, reject) => {
    const child: ChildProcessByStdio<null, Readable, Readable> = spawn(
      process.execPath,
      ["scripts/serve-fixture.mjs", "--port", "0"],
      { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] },
    );
    let buffer = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("serve-fixture did not print LISTENING in time"));
    }, START_TIMEOUT_MS);
    child.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const match = LISTEN_PATTERN.exec(buffer);
      if (!match) return;
      clearTimeout(timer);
      resolve({
        baseUrl: `http://127.0.0.1:${match[1]}`,
        stop: () =>
          new Promise<void>((done) => {
            child.once("exit", () => done());
            child.kill();
          }),
      });
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`serve-fixture exited early with code ${code ?? "null"}`));
    });
  });
