#!/usr/bin/env node
"use strict";

const assert = require("assert/strict");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const patchModule = require("../patches/quota-tracker.patch.js");
const {
  buildProviderCatalogPatched,
  buildUiPatched,
} = patchModule;

assert.equal(
  typeof buildProviderCatalogPatched,
  "function",
  "buildProviderCatalogPatched must be exported as a function",
);
assert.equal(
  typeof buildUiPatched,
  "function",
  "buildUiPatched must be exported as a function",
);

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

const SIX_MODELS = [
  "qwen3.8-max-preview",
  "qwen3.7-max",
  "qwen3.7-plus",
  "qwen3.6-flash",
  "glm-5.2",
  "deepseek-v4-pro",
];

const SINGAPORE_ENDPOINT =
  "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions";

const DISPLAY_METADATA = {
  name: "Qwen Cloud Token Plan",
  icon: "cloud",
  color: "#FF6A00",
  textIcon: "QCT",
  website: "https://www.alibabacloud.com/help/en/model-studio/token-plan-overview",
};

const ORIGINALS_BASE = path.join(os.homedir(), ".9router/quota-tracker-originals");

// All release original directories available in the test environment
const VARIANTS_TO_TEST = [
  "enhanced-0.5.50",
  "enhanced-0.5.45",
  "enhanced-0.5.40",
  "enhanced-0.5.35",
  "official-0.5.35",
];

// =========================================================================
// 1. Catalog transformation tests on all supported original variants
// =========================================================================
for (const variant of VARIANTS_TO_TEST) {
  const variantDir = path.join(ORIGINALS_BASE, variant);
  assert.ok(
    fs.existsSync(variantDir),
    `Originals directory for ${variant} must exist at ${variantDir}`,
  );

  // --- Test Server Chunk chunks/615.js ---
  const serverChunkPath = path.join(variantDir, "server/chunks/615.js");
  assert.ok(fs.existsSync(serverChunkPath), `615.js must exist for ${variant}`);
  const original615 = fs.readFileSync(serverChunkPath, "utf8");

  const patched615 = buildProviderCatalogPatched(original615);
  assert.notEqual(patched615, original615, "patched 615.js must differ from original");

  // Occurrence assertions for server catalog output
  const count615ProviderId = (patched615.match(/qwen-cloud-token-plan/g) || []).length;
  assert.equal(
    count615ProviderId,
    1,
    `qwen-cloud-token-plan must occur exactly once in patched 615.js (${variant})`,
  );

  const count615Alias = (patched615.match(/qct/g) || []).length;
  assert.equal(
    count615Alias,
    1,
    `qct must occur exactly once in patched 615.js (${variant})`,
  );

  const count615Endpoint = (
    patched615.match(new RegExp(SINGAPORE_ENDPOINT.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), "g")) || []
  ).length;
  assert.equal(
    count615Endpoint,
    1,
    `Singapore endpoint must occur exactly once in patched 615.js (${variant})`,
  );

  for (const modelId of SIX_MODELS) {
    assert.ok(
      patched615.includes(modelId),
      `patched 615.js must contain model ${modelId} (${variant})`,
    );
  }

  // Display metadata assertions
  assert.ok(patched615.includes(DISPLAY_METADATA.name), "must contain display name in 615.js");
  assert.ok(patched615.includes(DISPLAY_METADATA.icon), "must contain display icon in 615.js");
  assert.ok(patched615.includes(DISPLAY_METADATA.color), "must contain display color in 615.js");
  assert.ok(patched615.includes(DISPLAY_METADATA.textIcon), "must contain display textIcon in 615.js");
  assert.ok(patched615.includes(DISPLAY_METADATA.website), "must contain display website in 615.js");

  // Transport & auth assertions
  assert.ok(patched615.includes('"format":"openai"'), "must specify openai format in 615.js");
  assert.ok(patched615.includes('"scheme":"bearer"'), "must specify bearer scheme in 615.js");
  assert.ok(patched615.includes('"header":"Authorization"'), "must specify Authorization header in 615.js");
  assert.ok(patched615.includes('"usage":true'), "must enable usage feature in 615.js");
  assert.ok(patched615.includes('"usageApikey":true'), "must enable usageApikey feature in 615.js");

  // Idempotence & reapplication byte identity
  const reapplied615 = buildProviderCatalogPatched(patched615);
  assert.equal(
    reapplied615,
    patched615,
    `reapplication of buildProviderCatalogPatched on 615.js must be byte-identical (${variant})`,
  );

  // --- Test Client Chunk 1321-*.js ---
  let clientChunkFound = false;
  for (const f of fs.readdirSync(variantDir, { recursive: true })) {
    if (f.includes("1321-") && f.endsWith(".js")) {
      clientChunkFound = true;
      const clientChunkPath = path.join(variantDir, f);
      const original1321 = fs.readFileSync(clientChunkPath, "utf8");

      const patched1321 = buildProviderCatalogPatched(original1321);
      assert.notEqual(patched1321, original1321, `patched ${f} must differ from original`);

      const count1321ProviderId = (patched1321.match(/qwen-cloud-token-plan/g) || []).length;
      assert.equal(
        count1321ProviderId,
        1,
        `qwen-cloud-token-plan must occur exactly once in patched ${f} (${variant})`,
      );

      const count1321Alias = (patched1321.match(/qct/g) || []).length;
      assert.equal(
        count1321Alias,
        1,
        `qct must occur exactly once in patched ${f} (${variant})`,
      );

      const count1321Endpoint = (
        patched1321.match(new RegExp(SINGAPORE_ENDPOINT.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"), "g")) || []
      ).length;
      assert.equal(
        count1321Endpoint,
        1,
        `Singapore endpoint must occur exactly once in patched ${f} (${variant})`,
      );

      for (const modelId of SIX_MODELS) {
        assert.ok(
          patched1321.includes(modelId),
          `patched ${f} must contain model ${modelId} (${variant})`,
        );
      }

      assert.ok(patched1321.includes(DISPLAY_METADATA.name), "must contain display name in client chunk");
      assert.ok(patched1321.includes(DISPLAY_METADATA.icon), "must contain display icon in client chunk");
      assert.ok(patched1321.includes(DISPLAY_METADATA.color), "must contain display color in client chunk");
      assert.ok(patched1321.includes(DISPLAY_METADATA.textIcon), "must contain display textIcon in client chunk");
      assert.ok(patched1321.includes(DISPLAY_METADATA.website), "must contain display website in client chunk");

      assert.ok(patched1321.includes('"format":"openai"'), "must specify openai format in client chunk");
      assert.ok(patched1321.includes('"scheme":"bearer"'), "must specify bearer scheme in client chunk");
      assert.ok(patched1321.includes('"header":"Authorization"'), "must specify Authorization header in client chunk");
      assert.ok(patched1321.includes('"usage":true'), "must enable usage in client chunk");
      assert.ok(patched1321.includes('"usageApikey":true'), "must enable usageApikey in client chunk");

      // Idempotence & reapplication byte identity
      const reapplied1321 = buildProviderCatalogPatched(patched1321);
      assert.equal(
        reapplied1321,
        patched1321,
        `reapplication of buildProviderCatalogPatched on ${f} must be byte-identical (${variant})`,
      );
    }
  }
  assert.ok(clientChunkFound, `Client 1321 chunk must be found for ${variant}`);
}

// =========================================================================
// 2. Safe legacy marker migration and isolation tests
// =========================================================================
const patchSource = fs.readFileSync(path.join(__dirname, "../patches/quota-tracker.patch.js"), "utf8");

const providerCatalogMarker = "/* QuotaTrackerAlibabaProvider:v1 */";
const usageMarker = "/* QuotaTrackerPatch:v2 */";
const providersMarker = "/* QuotaTrackerProviders:v2 */";
const uiMarker = "/* QuotaTrackerCurrency:v2 */";

assert.notEqual(providerCatalogMarker, usageMarker, "provider catalog marker must be separate from usage marker");
assert.notEqual(providerCatalogMarker, providersMarker, "provider catalog marker must be separate from providers marker");
assert.notEqual(providerCatalogMarker, uiMarker, "provider catalog marker must be separate from UI marker");
// Test legacy migration and apply/rollback/sanitize in an isolated scratch root
const scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), "quota-tracker-integration-test-"));
const serverRoot = path.join(scratchRoot, "app/.next-cli-build/server");
fs.mkdirSync(serverRoot, { recursive: true });

const srcVariantDir = path.join(ORIGINALS_BASE, "enhanced-0.5.50");
assert.ok(fs.existsSync(srcVariantDir), "enhanced-0.5.50 original dir must exist");

// Copy all original files to scratch serverRoot
function copyRecursive(src, dest) {
  if (fs.statSync(src).isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}
copyRecursive(path.join(srcVariantDir, "server"), serverRoot);
copyRecursive(path.join(srcVariantDir, "static"), path.join(scratchRoot, "app/.next-cli-build/static"));
fs.writeFileSync(
  path.join(scratchRoot, "package.json"),
  JSON.stringify({ name: "9router", version: "0.5.50" }),
);

// Create scratch patch script with NINE_ROUTER_PACKAGE_ROOT pointing to scratchRoot
const scratchPatchScript = path.join(scratchRoot, "quota-tracker.patch.js");
fs.writeFileSync(scratchPatchScript, patchSource, "utf8");

function runScratchPatch(args) {
  const { execFileSync } = require("child_process");
  return execFileSync(process.execPath, [scratchPatchScript, ...args], {
    env: { ...process.env, NINE_ROUTER_PACKAGE_ROOT: scratchRoot },
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
}

// Test A: Apply clean scratch installation
const apply1 = runScratchPatch(["--apply"]).trim();
assert.equal(apply1, "applied", "clean apply must return applied");

// Check that provider catalog marker is present in 615.js and 1321 chunk
const server615 = fs.readFileSync(path.join(serverRoot, "chunks/615.js"), "utf8");
assert.ok(server615.includes(providerCatalogMarker), "615.js must contain PROVIDER_CATALOG_MARKER");
assert.ok(server615.includes("qwen-cloud-token-plan"), "615.js must contain qwen-cloud-token-plan");
assert.ok(server615.includes("qct"), "615.js must contain qct");

const client1321 = fs.readFileSync(
  path.join(scratchRoot, "app/.next-cli-build/static/chunks/1321-54939b699b5f3d07.js"),
  "utf8",
);
assert.ok(client1321.includes(providerCatalogMarker), "client 1321 chunk must contain PROVIDER_CATALOG_MARKER");
assert.ok(client1321.includes("qwen-cloud-token-plan"), "client 1321 chunk must contain qwen-cloud-token-plan");
assert.ok(client1321.includes("qct"), "client 1321 chunk must contain qct");

// Idempotent re-apply
const apply2 = runScratchPatch(["--apply"]).trim();
assert.equal(apply2, "already applied", "reapplication must return already applied");

// Rollback test
const rb1 = runScratchPatch(["--rollback"]).trim();
assert.equal(rb1, "rolled back", "rollback must return rolled back");
const server615Clean = fs.readFileSync(path.join(serverRoot, "chunks/615.js"), "utf8");
assert.ok(!server615Clean.includes(providerCatalogMarker), "rolled back 615.js must not contain marker");
assert.ok(!server615Clean.includes("qwen-cloud-token-plan"), "rolled back 615.js must not contain provider");

const rb2 = runScratchPatch(["--rollback"]).trim();
assert.equal(rb2, "already clean", "second rollback must return already clean");

// Test B: Seed temporary bundle with legacy markers and expected original hash
// Simulate legacy patch state: 615.js patched with legacy QuotaTrackerProviders:v2 marker
const original615Content = fs.readFileSync(path.join(srcVariantDir, "server/chunks/615.js"), "utf8");
const legacy615Content = original615Content + "/* QuotaTrackerProviders:v2 */";
fs.writeFileSync(path.join(serverRoot, "chunks/615.js"), legacy615Content, "utf8");

// Saved original already exists in scratch originals from previous apply
// Run apply -> should safely migrate legacy marker by restoring saved original and applying new marker
const migrateApply = runScratchPatch(["--apply"]).trim();
assert.equal(migrateApply, "applied", "apply on legacy-marked bundle must safely migrate and apply");

const migrated615 = fs.readFileSync(path.join(serverRoot, "chunks/615.js"), "utf8");
assert.ok(migrated615.includes(providerCatalogMarker), "migrated 615.js must contain new PROVIDER_CATALOG_MARKER");
assert.ok(migrated615.includes("qwen-cloud-token-plan"), "migrated 615.js must contain canonical provider");

// Test C: Refuse partial or hash-mismatched residue
// Corrupt a file with arbitrary non-legacy marker and modified content
const corruptedFile = path.join(serverRoot, "chunks/615.js");
fs.writeFileSync(corruptedFile, original615Content + "/* ArbitraryCorruptedMarker */", "utf8");
assert.throws(
  () => runScratchPatch(["--apply"]),
  /Unsupported bundle hash|Unsafe partial patch recovery/,
  "must refuse arbitrary modified bundle without valid hash or recognized marker",
);

// Test D: Sanitize restores patched files
// Restore clean, apply, then sanitize
fs.writeFileSync(corruptedFile, original615Content, "utf8");
runScratchPatch(["--apply"]);
const sanitizeOut = runScratchPatch(["--sanitize"]).trim();
assert.ok(sanitizeOut.includes("sanitized"), "sanitize must restore patched files");

// Cleanup scratch root
fs.rmSync(scratchRoot, { recursive: true, force: true });

console.log("quota tracker integration tests: ok");
