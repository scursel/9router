#!/usr/bin/env node
"use strict";

// Functional test for the CORS preflight patch: patches a scratch copy of
// custom-server.js, boots it against a trivial handler, and drives real
// HTTP requests through it to verify OPTIONS short-circuits with CORS
// headers and normal methods still reach the wrapped handler with the
// x-9r-real-ip logic intact.

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const http = require("http");
const { execFileSync } = require("child_process");

const scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cors-preflight-test-"));
const appDir = path.join(scratchRoot, "app");
fs.mkdirSync(appDir, { recursive: true });

const ORIGINAL_CUSTOM_SERVER = `const http = require("http");

const origCreate = http.createServer.bind(http);

http.createServer = (...args) => {
  const handler = args.find((a) => typeof a === "function");
  const rest = args.filter((a) => typeof a !== "function");
  if (!handler) return origCreate(...args);
  const wrapped = (req, res) => {
    const socketIp = req.socket && req.socket.remoteAddress ? req.socket.remoteAddress : "";
    const xff = req.headers["x-forwarded-for"];
    const xRealIp = req.headers["x-real-ip"];
    const viaProxy = !!(xff || xRealIp);
    const isLoopbackProxy = socketIp === "127.0.0.1" || socketIp === "::1" || socketIp === "::ffff:127.0.0.1";
    const proxyIp = xRealIp || (xff ? String(xff).split(",")[0].trim() : "");
    const ip = isLoopbackProxy && proxyIp ? proxyIp : socketIp;
    delete req.headers["x-9r-real-ip"];
    delete req.headers["x-forwarded-for"];
    delete req.headers["x-9r-via-proxy"];
    req.headers["x-9r-real-ip"] = ip;
    if (viaProxy) req.headers["x-9r-via-proxy"] = "1";
    return handler(req, res);
  };
  return origCreate(...rest, wrapped);
};

module.exports = { install: () => {} };
`;

fs.writeFileSync(path.join(appDir, "custom-server.js"), ORIGINAL_CUSTOM_SERVER);
fs.writeFileSync(path.join(appDir, "server.js"), "module.exports = {};\n");
fs.writeFileSync(
  path.join(scratchRoot, "package.json"),
  JSON.stringify({ name: "9router-test-fixture", version: "0.0.0" })
);

const patchScript = path.join(__dirname, "..", "patches", "cors-preflight.patch.js");
const testHome = fs.mkdtempSync(path.join(os.tmpdir(), "cors-preflight-home-"));

function runPatch(mode) {
  return execFileSync(process.execPath, [patchScript, mode], {
    env: { ...process.env, NINE_ROUTER_PACKAGE_ROOT: scratchRoot, HOME: testHome },
    encoding: "utf8",
  });
}

console.log("[test] check before apply (expect patchable)");
try {
  runPatch("--check");
  throw new Error("expected --check to exit non-zero before apply");
} catch (err) {
  assert.ok(/not applied, patchable/.test(err.stdout || ""), "expected patchable status");
}

console.log("[test] apply");
const applyOut = runPatch("--apply");
assert.ok(/applied to/.test(applyOut), "expected apply confirmation");

console.log("[test] syntax check of patched file");
execFileSync(process.execPath, ["--check", path.join(appDir, "custom-server.js")]);

console.log("[test] idempotent re-apply is a no-op");
const reapplyOut = runPatch("--apply");
assert.ok(/already applied/.test(reapplyOut), "expected no-op message on second apply");

// Load the patched module fresh and boot a real server through it.
delete require.cache[require.resolve(path.join(appDir, "custom-server.js"))];
require(path.join(appDir, "custom-server.js"));

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/_next/static/")) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("ETag", '"test-etag-123"');
    res.writeHead(200, { "Content-Type": "application/javascript" });
    res.end("// static asset");
    return;
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true, ip: req.headers["x-9r-real-ip"] }));
});

function request(options) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  console.log("[test] OPTIONS preflight returns 204 with CORS headers, no auth required");
  const preflight = await request({ host: "127.0.0.1", port, method: "OPTIONS", path: "/v1/chat/completions" });
  assert.strictEqual(preflight.statusCode, 204, "OPTIONS should short-circuit with 204");
  assert.strictEqual(preflight.headers["access-control-allow-origin"], "*");
  assert.ok(preflight.headers["access-control-allow-methods"].includes("OPTIONS"));
  assert.ok(preflight.headers["access-control-allow-headers"].includes("Authorization"));
  assert.strictEqual(preflight.body, "", "OPTIONS response body should be empty");

  console.log("[test] GET reaches the real handler and carries CORS headers on 200");
  const getResp = await request({ host: "127.0.0.1", port, method: "GET", path: "/v1/models" });
  assert.strictEqual(getResp.statusCode, 200);
  assert.strictEqual(getResp.headers["access-control-allow-origin"], "*");
  const parsed = JSON.parse(getResp.body);
  assert.strictEqual(parsed.ok, true);
  assert.strictEqual(parsed.ip, "127.0.0.1", "x-9r-real-ip logic must survive the patch");

  console.log("[test] GET static chunk modified by overlay forces revalidation (must-revalidate)");
  const modifiedStatic = await request({
    host: "127.0.0.1",
    port,
    method: "GET",
    path: "/_next/static/chunks/1321-54939b699b5f3d07.js",
  });
  assert.strictEqual(modifiedStatic.statusCode, 200);
  assert.strictEqual(
    modifiedStatic.headers["cache-control"],
    "public, max-age=0, must-revalidate",
    "Overlay-modified static chunk must be served with must-revalidate"
  );
  assert.strictEqual(
    modifiedStatic.headers["etag"],
    '"test-etag-123"',
    "ETag header must be preserved for cheap revalidation"
  );

  console.log("[test] GET static chunk NOT modified by overlay keeps immutable cache");
  const unmodifiedStatic = await request({
    host: "127.0.0.1",
    port,
    method: "GET",
    path: "/_next/static/chunks/app/layout-12345.js",
  });
  assert.strictEqual(unmodifiedStatic.statusCode, 200);
  assert.strictEqual(
    unmodifiedStatic.headers["cache-control"],
    "public, max-age=31536000, immutable",
    "Unmodified static chunk must retain max-age=31536000, immutable"
  );
  server.close();

  console.log("[test] rollback restores byte-identical original");
  runPatch("--rollback");
  const restored = fs.readFileSync(path.join(appDir, "custom-server.js"), "utf8");
  assert.strictEqual(restored, ORIGINAL_CUSTOM_SERVER, "rollback must restore the exact original");

  console.log("[test] check after rollback (expect patchable again)");
  try {
    runPatch("--check");
    throw new Error("expected --check to exit non-zero after rollback");
  } catch (err) {
    assert.ok(/not applied, patchable/.test(err.stdout || ""), "expected patchable status after rollback");
  }

  fs.rmSync(scratchRoot, { recursive: true, force: true });
  fs.rmSync(testHome, { recursive: true, force: true });

  console.log("\nAll cors-preflight tests passed.");
})().catch((err) => {
  console.error(err);
  fs.rmSync(scratchRoot, { recursive: true, force: true });
  fs.rmSync(testHome, { recursive: true, force: true });
  process.exit(1);
});
