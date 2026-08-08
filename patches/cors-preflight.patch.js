#!/usr/bin/env node
"use strict";

// CORS preflight patch for 9Router's custom-server.js.
//
// Problem: browser/Electron clients (ONLYOFFICE AI plugin, VS Code, Cursor,
// any fetch()-based client) issue a CORS preflight OPTIONS request before
// the real POST to /v1/chat/completions. Per the Fetch spec, browsers never
// attach Authorization to a preflight. 9Router's auth middleware rejects
// unauthenticated OPTIONS from non-loopback origins (e.g. Tailscale
// 100.x.x.x) with 401, so the browser aborts before the real request with
// the API key is ever sent — "Failed to fetch".
//
// Fix: wrap the raw HTTP server (same layer that already derives the real
// client IP from the socket) to short-circuit OPTIONS with 204 + CORS
// headers *before* Next.js/the auth middleware ever sees the request, and
// inject CORS headers on every other response so non-2xx auth failures
// (401/403) are still visible to the browser instead of being opaque
// "Failed to fetch" network errors.
//
// This patch targets app/custom-server.js — a small, stable wrapper around
// http.createServer that upstream 9Router has kept byte-identical across at
// least 0.5.35–0.5.40. It is intentionally NOT hash-pinned to a single
// version like quota-tracker.patch.js: instead it verifies the two anchor
// strings it needs are present and unmodified by this patch, then applies
// idempotently. This keeps the patch resilient to unrelated upstream
// updates to the Next.js bundle.

const fs = require("fs");
const os = require("os");
const path = require("path");

const HOME = os.homedir();
const PACKAGE_ROOT = process.env.NINE_ROUTER_PACKAGE_ROOT ||
  path.join(HOME, ".hermes/node/lib/node_modules/9router");
const TARGET = path.join(PACKAGE_ROOT, "app/custom-server.js");
const BACKUP_DIR = path.join(HOME, ".9router/cors-preflight-originals");
const PACKAGE_VERSION = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf8")).version || "unknown";
  } catch {
    return "unknown";
  }
})();
const BACKUP_FILE = path.join(BACKUP_DIR, `custom-server-${PACKAGE_VERSION}.js`);
const LEGACY_BACKUP_FILE = path.join(BACKUP_DIR, "custom-server.js");

const MARKER = "CORS headers injected on every response";
const REVALIDATE_MARKER = "REVALIDATE_STATIC_PATHS";

const ANCHOR_REQUIRE = 'const http = require("http");';
const ANCHOR_WRAPPED_OPEN = "const wrapped = (req, res) => {";

function deriveStaticPaths() {
  const candidates = [
    path.join(__dirname, "quota-tracker.patch.js"),
    path.join(__dirname, "patches", "quota-tracker.patch.js"),
    path.join(HOME, ".9router", "quota-tracker.patch.js"),
  ];
  let patchFile = null;
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      patchFile = c;
      break;
    }
  }
  if (!patchFile) {
    throw new Error(
      "[cors-preflight] quota-tracker.patch.js not found in expected candidate locations: " +
        candidates.join(", ")
    );
  }
  const content = fs.readFileSync(patchFile, "utf8");
  const matches = [...content.matchAll(/["'](?:\.\.\/)?static\/([^"']+)["']/g)].map(
    (m) => "/_next/static/" + m[1]
  );
  const unique = Array.from(new Set(matches)).sort();
  if (unique.length === 0) {
    throw new Error(
      "[cors-preflight] No static paths derived from " +
        patchFile +
        " — quota-tracker.patch.js schema/targets changed!"
    );
  }
  return unique;
}

function buildBlocks() {
  const derivedPaths = deriveStaticPaths();

  const corsBlockTop = `
// CORS headers injected on every response — allows browser/Electron clients
// on any origin (Tailscale, local network, etc.) to call the OpenAI-compatible
// API without being blocked by same-origin policy.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE, PATCH",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, x-api-key, x-goog-api-key, Origin, Accept, Cache-Control",
  "Access-Control-Max-Age": "86400",
};

// Static chunks modified in-place by overlay patchers must revalidate instead of
// being cached immutably by browsers, preserving ETag/Last-Modified for cheap 304s.
const REVALIDATE_STATIC_PATHS = new Set(${JSON.stringify(derivedPaths, null, 2)});
`;

  const corsBlockHandler = `
    // ── CORS preflight ────────────────────────────────────────────────
    // Browsers send OPTIONS *before* the real request, and never include
    // Authorization on preflight. Respond 204 immediately so the actual
    // POST/DELETE/etc. can proceed with the API key.
    if (req.method === "OPTIONS") {
      res.writeHead(204, CORS_HEADERS);
      res.end();
      return;
    }

    // ── Inject CORS & Cache-Control headers on every response ─────────
    // Wrap writeHead so all downstream responses (including 401/403 from
    // the auth middleware) carry CORS headers, and static chunks modified
    // by the overlay force revalidation (must-revalidate) instead of immutable cache.
    const reqPath = req.url ? req.url.split("?")[0] : "";
    const shouldRevalidateStatic = REVALIDATE_STATIC_PATHS.has(reqPath);
    const origWriteHead = res.writeHead.bind(res);
    res.writeHead = (statusCode, ...restArgs) => {
      let headers;
      if (restArgs.length && typeof restArgs[0] === "object" && !Array.isArray(restArgs[0])) {
        headers = restArgs[0];
        Object.assign(headers, CORS_HEADERS);
      } else {
        headers = Object.assign({}, CORS_HEADERS);
        restArgs.unshift(headers);
      }
      if (shouldRevalidateStatic) {
        res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
        for (const key of Object.keys(headers)) {
          if (key.toLowerCase() === "cache-control") {
            delete headers[key];
          }
        }
        headers["Cache-Control"] = "public, max-age=0, must-revalidate";
      }
      return origWriteHead(statusCode, ...restArgs);
    };
`;

  return { corsBlockTop, corsBlockHandler };
}

function readTarget() {
  if (!fs.existsSync(TARGET)) {
    throw new Error(`custom-server.js not found at ${TARGET}`);
  }
  return fs.readFileSync(TARGET, "utf8");
}

function isApplied(content) {
  return content.includes(MARKER) && content.includes(REVALIDATE_MARKER);
}

function isPatchable(content) {
  return content.includes(ANCHOR_REQUIRE) && content.includes(ANCHOR_WRAPPED_OPEN);
}

function apply() {
  let content = readTarget();

  if (isApplied(content)) {
    console.log("[cors-preflight] already applied — no-op");
    return true;
  }

  if (content.includes(MARKER) && !content.includes(REVALIDATE_MARKER)) {
    const backupFile = fs.existsSync(BACKUP_FILE) ? BACKUP_FILE : LEGACY_BACKUP_FILE;
    if (fs.existsSync(backupFile)) {
      console.log("[cors-preflight] upgrading legacy patch to include static cache revalidation...");
      content = fs.readFileSync(backupFile, "utf8");
    }
  }

  if (!isPatchable(content)) {
    console.error(
      "[cors-preflight] anchor strings not found in custom-server.js — " +
      "upstream file shape changed, refusing to patch. Leaving file untouched."
    );
    return false;
  }

  fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
  if (!fs.existsSync(BACKUP_FILE)) {
    fs.writeFileSync(BACKUP_FILE, content, { mode: 0o600 });
  }

  const { corsBlockTop, corsBlockHandler } = buildBlocks();
  let patched = content.replace(ANCHOR_REQUIRE, ANCHOR_REQUIRE + "\n" + corsBlockTop);
  patched = patched.replace(
    ANCHOR_WRAPPED_OPEN,
    ANCHOR_WRAPPED_OPEN + corsBlockHandler
  );

  if (!isApplied(patched)) {
    console.error("[cors-preflight] patch transform failed sanity check — aborting write");
    return false;
  }

  const tmp = `${TARGET}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, patched, { mode: 0o644 });
  fs.renameSync(tmp, TARGET);
  console.log(`[cors-preflight] applied to ${TARGET}`);
  return true;
}

function rollback() {
  const backupFile = fs.existsSync(BACKUP_FILE) ? BACKUP_FILE : LEGACY_BACKUP_FILE;
  if (!fs.existsSync(backupFile)) {
    console.error("[cors-preflight] no backup found — cannot rollback");
    return false;
  }
  const original = fs.readFileSync(backupFile, "utf8");
  const tmp = `${TARGET}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, original, { mode: 0o644 });
  fs.renameSync(tmp, TARGET);
  console.log(`[cors-preflight] rolled back ${TARGET} from backup`);
  return true;
}

function check() {
  const content = readTarget();
  if (isApplied(content)) {
    console.log("[cors-preflight] status: applied");
    return true;
  }
  if (isPatchable(content)) {
    console.log("[cors-preflight] status: not applied, patchable");
    return false;
  }
  console.log("[cors-preflight] status: not applied, anchors missing (incompatible upstream file)");
  return false;
}

const mode = process.argv[2];
if (mode === "--apply") {
  process.exit(apply() ? 0 : 1);
} else if (mode === "--rollback") {
  process.exit(rollback() ? 0 : 1);
} else if (mode === "--check") {
  process.exit(check() ? 0 : 1);
} else {
  console.error("Usage: cors-preflight.patch.js --apply|--rollback|--check");
  process.exit(2);
}
