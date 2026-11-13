#!/usr/bin/env node
/**
 * Serves fixture/dist with SPA fallback and a Cloudflare-like CSP.
 *   node scripts/serve-fixture.mjs --port 0
 * Prints exactly `LISTENING <port>` on stdout once ready. Everything else goes to stderr.
 * CSP: script-src uses a per-response nonce (injected into index.html). Default style-src
 * allows 'unsafe-inline'. `?csp=strict` on an HTML route drops 'unsafe-inline' from style-src.
 */
import crypto from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildFixture } from "../fixture/build.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(SCRIPT_DIR, "..", "fixture", "dist");
const INDEX_FILE = path.join(DIST_DIR, "index.html");
const NONCE_PLACEHOLDER = "__CSP_NONCE__";
const NONCE_BYTES = 16;
const LISTEN_HOST = "127.0.0.1";
const DEFAULT_PORT = 0;
const STRICT_QUERY_VALUE = "strict";
const SPA_EXTENSIONS = new Set(["", ".html"]);

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
};

export function parsePort(argv) {
  const flagIndex = argv.indexOf("--port");
  if (flagIndex === -1) {
    return DEFAULT_PORT;
  }
  const value = Number(argv[flagIndex + 1]);
  if (!Number.isInteger(value) || value < 0 || value > 65535) {
    throw new Error(`Invalid --port value: ${argv[flagIndex + 1] ?? "(missing)"}`);
  }
  return value;
}

export function buildCsp(nonce, isStrict) {
  const styleSrc = isStrict ? "style-src 'self'" : "style-src 'self' 'unsafe-inline'";
  return [
    `script-src 'nonce-${nonce}' 'unsafe-eval'`,
    styleSrc,
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "worker-src blob:",
    "object-src 'none'",
    "base-uri 'self'",
  ].join("; ");
}

function isStrictRequest(url) {
  return url.searchParams.get("csp") === STRICT_QUERY_VALUE;
}

async function sendHtml(res, url, template, status) {
  const nonce = crypto.randomBytes(NONCE_BYTES).toString("base64");
  const body = template.replaceAll(NONCE_PLACEHOLDER, nonce);
  res.writeHead(status, {
    "Content-Type": CONTENT_TYPES[".html"],
    "Content-Security-Policy": buildCsp(nonce, isStrictRequest(url)),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

async function sendStatic(res, filePath) {
  const body = await readFile(filePath);
  const contentType = CONTENT_TYPES[path.extname(filePath)] ?? "application/octet-stream";
  res.writeHead(200, { "Content-Type": contentType, "Cache-Control": "no-store" });
  res.end(body);
}

/** Returns the absolute file path for a request path, or null if it escapes DIST_DIR. */
export function resolveStaticPath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const resolved = path.join(DIST_DIR, decoded);
  return resolved.startsWith(DIST_DIR + path.sep) ? resolved : null;
}

async function isRegularFile(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

async function handleRequest(req, res, indexTemplate) {
  const url = new URL(req.url ?? "/", `http://${LISTEN_HOST}`);
  const extension = path.extname(url.pathname);

  if (!SPA_EXTENSIONS.has(extension)) {
    const filePath = resolveStaticPath(url.pathname);
    if (filePath !== null && (await isRegularFile(filePath))) {
      await sendStatic(res, filePath);
      return;
    }
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  await sendHtml(res, url, indexTemplate, 200);
}

async function ensureBuilt() {
  if (existsSync(INDEX_FILE)) {
    return;
  }
  process.stderr.write("fixture/dist is missing, building it first\n");
  await buildFixture();
}

async function main() {
  const port = parsePort(process.argv.slice(2));
  await ensureBuilt();
  const indexTemplate = await readFile(INDEX_FILE, "utf8");
  const server = http.createServer((req, res) => {
    handleRequest(req, res, indexTemplate).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`request failed: ${message}\n`);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      }
      res.end("Internal error");
    });
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  server.listen(port, LISTEN_HOST, () => {
    const address = server.address();
    const listeningPort = typeof address === "object" && address !== null ? address.port : port;
    process.stdout.write(`LISTENING ${listeningPort}\n`);
  });
}

const isEntryPoint = import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
if (isEntryPoint) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`serve-fixture failed: ${message}\n`);
    process.exitCode = 1;
  });
}
