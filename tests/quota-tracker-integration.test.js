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
  buildProvidersPatched,
  buildUiPatched,
  buildLegacyPatched,
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
  assert.ok(patched615.includes("validateUrl"), "must specify validateUrl in 615.js");
  assert.ok(patched615.includes("apiKeyUrl"), "must specify apiKeyUrl in notice in 615.js");
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
      assert.ok(patched1321.includes("validateUrl"), "must specify validateUrl in client chunk");
      assert.ok(patched1321.includes("apiKeyUrl"), "must specify apiKeyUrl in notice in client chunk");
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

  // --- Test Dashboard Quota Page app/(dashboard)/dashboard/quota/page.js ---
  const quotaPagePath = path.join(variantDir, "server/app/(dashboard)/dashboard/quota/page.js");
  assert.ok(fs.existsSync(quotaPagePath), `quota page.js must exist for ${variant}`);
  const originalQuotaPage = fs.readFileSync(quotaPagePath, "utf8");

  const patchedQuotaPage = buildUiPatched(originalQuotaPage);
  assert.notEqual(patchedQuotaPage, originalQuotaPage, `patched quota page.js must differ from original (${variant})`);

  // Assert that generated card contains UI_STATUS_MARKER and raw metadata fields
  assert.ok(
    patchedQuotaPage.includes("QuotaTrackerAlibabaStatus:v1"),
    `patched quota page must contain QuotaTrackerAlibabaStatus:v1 marker (${variant})`,
  );
  assert.equal(
    (patchedQuotaPage.match(/QuotaTrackerAlibabaStatus:v1/g) || []).length,
    1,
    `QuotaTrackerAlibabaStatus:v1 must occur exactly once in quota page (${variant})`,
  );
  assert.ok(
    patchedQuotaPage.includes("i.raw?.source") || patchedQuotaPage.includes("i?.raw?.source"),
    `patched quota page must contain i.raw?.source (${variant})`,
  );
  assert.ok(
    patchedQuotaPage.includes("i.raw?.status") || patchedQuotaPage.includes("i?.raw?.status") || patchedQuotaPage.includes("i.raw.status"),
    `patched quota page must contain i.raw.status (${variant})`,
  );
  assert.ok(
    patchedQuotaPage.includes("i.raw?.fetchedAt") || patchedQuotaPage.includes("i?.raw?.fetchedAt") || patchedQuotaPage.includes("i.raw.fetchedAt"),
    `patched quota page must contain i.raw.fetchedAt (${variant})`,
  );

  // Assert that the original i?.message ? message : quota-list branch is replaced exactly once
  const originalMessageBranch =
    'i?.message?(0,d.jsx)("div",{className:"text-center py-5",children:(0,d.jsx)("p",{className:"text-xs text-text-muted",children:i.message})}):(0,d.jsx)(r,{quotas:D,compact:!0,sortMode:"default",showSortLabel:"codex"===c.provider&&"default"!==at,onHideQuota:a=>aZ(c.provider,a)})';
  assert.ok(
    !patchedQuotaPage.includes(originalMessageBranch),
    `patched quota page must no longer contain original message-only branch (${variant})`,
  );

  // Assert that the quota-list renderer remains in the non-message branch
  assert.ok(
    patchedQuotaPage.includes('(0,d.jsx)(r,{quotas:D,compact:!0,sortMode:"default",showSortLabel:"codex"===c.provider&&"default"!==at,onHideQuota:a=>aZ(c.provider,a)})'),
    `patched quota page must retain QuotaList renderer in the non-message branch (${variant})`,
  );

  // Assert that unpatched / corrupted source shape fails closed
  const corruptedQuotaPage = originalQuotaPage.replace(/i\?\.message/g, "corrupted_ssr_branch");
  assert.throws(
    () => buildUiPatched(corruptedQuotaPage),
    /Quota status card branch not found/,
    `buildUiPatched must fail on corrupted server quota page shape (${variant})`,
  );

  // Assert that multiple matching card branches fail closed
  const duplicateQuotaPage = originalQuotaPage + "\n" + originalQuotaPage;
  assert.throws(
    () => buildUiPatched(duplicateQuotaPage),
    /Quota status card branch not found/,
    `buildUiPatched must fail on duplicate server quota page branches (${variant})`,
  );
  // Assert that UI currency marker is also present
  assert.ok(
    patchedQuotaPage.includes("/* QuotaTrackerCurrency:v2 */"),
    `patched quota page must contain UI_MARKER (${variant})`,
  );

  // Assert that no sensitive secrets are injected into the UI page
  for (const forbidden of ["cookie", "sec_token", "secToken", "Authorization", "sk-sp-"]) {
    assert.ok(
      !patchedQuotaPage.includes(forbidden) || originalQuotaPage.includes(forbidden),
      `patched quota page must not introduce forbidden secret-like token ${forbidden} (${variant})`,
    );
  }

  // Idempotence & reapplication byte identity
  const reappliedQuotaPage = buildUiPatched(patchedQuotaPage);
  assert.equal(
    reappliedQuotaPage,
    patchedQuotaPage,
    `reapplication of buildUiPatched on quota page.js must be byte-identical (${variant})`,
  );

  // --- Test Client Chunk Quota Page static/chunks/app/(dashboard)/dashboard/quota/page-*.js ---
  let clientQuotaPageFound = false;
  for (const f of fs.readdirSync(variantDir, { recursive: true })) {
    if (f.includes("quota/page-") && f.endsWith(".js")) {
      clientQuotaPageFound = true;
      const clientQuotaChunkPath = path.join(variantDir, f);
      const originalClientQuotaChunk = fs.readFileSync(clientQuotaChunkPath, "utf8");
      const patchedClientQuotaChunk = buildUiPatched(originalClientQuotaChunk);
      assert.notEqual(
        patchedClientQuotaChunk,
        originalClientQuotaChunk,
        `patched client quota chunk ${f} must differ from original (${variant})`,
      );
      assert.ok(
        patchedClientQuotaChunk.includes("QuotaTrackerAlibabaStatus:v1"),
        `patched client quota chunk ${f} must contain UI_STATUS_MARKER (${variant})`,
      );
      assert.equal(
        (patchedClientQuotaChunk.match(/QuotaTrackerAlibabaStatus:v1/g) || []).length,
        1,
        `QuotaTrackerAlibabaStatus:v1 must occur exactly once in ${f} (${variant})`,
      );
      assert.ok(
        patchedClientQuotaChunk.includes("o?.raw?.source") || patchedClientQuotaChunk.includes("o.raw?.source") || patchedClientQuotaChunk.includes("o.raw.source"),
        `patched client quota chunk ${f} must contain o.raw.source (${variant})`,
      );
      assert.ok(
        patchedClientQuotaChunk.includes("o?.raw?.status") || patchedClientQuotaChunk.includes("o.raw?.status") || patchedClientQuotaChunk.includes("o.raw.status"),
        `patched client quota chunk ${f} must contain o.raw.status (${variant})`,
      );
      assert.ok(
        patchedClientQuotaChunk.includes("o?.raw?.fetchedAt") || patchedClientQuotaChunk.includes("o.raw?.fetchedAt") || patchedClientQuotaChunk.includes("o.raw.fetchedAt"),
        `patched client quota chunk ${f} must contain o.raw.fetchedAt (${variant})`,
      );

      // Assert that the original client message-only branch is replaced exactly once
      const originalClientBranchW =
        'o?.message?(0,a.jsx)("div",{className:"text-center py-5",children:(0,a.jsx)("p",{className:"text-xs text-text-muted",children:o.message})}):(0,a.jsx)(w,{quotas:f,compact:!0,sortMode:"default",showSortLabel:"codex"===r.provider&&"default"!==eN,onHideQuota:e=>e3(r.provider,e)})';
      const originalClientBranchK =
        'o?.message?(0,a.jsx)("div",{className:"text-center py-5",children:(0,a.jsx)("p",{className:"text-xs text-text-muted",children:o.message})}):(0,a.jsx)(k,{quotas:f,compact:!0,sortMode:"default",showSortLabel:"codex"===r.provider&&"default"!==eN,onHideQuota:e=>e3(r.provider,e)})';
      assert.ok(
        !patchedClientQuotaChunk.includes(originalClientBranchW),
        `patched client quota chunk ${f} must not contain original w message branch (${variant})`,
      );
      assert.ok(
        !patchedClientQuotaChunk.includes(originalClientBranchK),
        `patched client quota chunk ${f} must not contain original k message branch (${variant})`,
      );

      // Assert that the quota-list renderer remains in the non-message branch
      assert.ok(
        patchedClientQuotaChunk.includes('(0,a.jsx)(w,{quotas:f,compact:!0,sortMode:"default",showSortLabel:"codex"===r.provider&&"default"!==eN,onHideQuota:e=>e3(r.provider,e)})') ||
        patchedClientQuotaChunk.includes('(0,a.jsx)(k,{quotas:f,compact:!0,sortMode:"default",showSortLabel:"codex"===r.provider&&"default"!==eN,onHideQuota:e=>e3(r.provider,e)})'),
        `patched client quota chunk ${f} must retain QuotaList renderer (${variant})`,
      );

      // Assert that unpatched / corrupted source shape fails closed
      const corruptedClientQuotaChunk = originalClientQuotaChunk.replace(/o\?\.message/g, "corrupted_client_branch");
      assert.throws(
        () => buildUiPatched(corruptedClientQuotaChunk),
        /Quota status card branch not found/,
        `buildUiPatched must fail on corrupted client quota chunk shape (${variant})`,
      );

      // Assert that multiple matching card branches fail closed
      const duplicateClientQuotaChunk = originalClientQuotaChunk + "\n" + originalClientQuotaChunk;
      assert.throws(
        () => buildUiPatched(duplicateClientQuotaChunk),
        /Quota status card branch not found/,
        `buildUiPatched must fail on duplicate client quota chunk branches (${variant})`,
      );

      const mixedClientAndServer = originalClientQuotaChunk + "\n" + originalQuotaPage;
      assert.throws(
        () => buildUiPatched(mixedClientAndServer),
        /Quota status card branch not found/,
        `buildUiPatched must fail on mixed client and server quota branches (${variant})`,
      );
      assert.ok(
        patchedClientQuotaChunk.includes("/* QuotaTrackerCurrency:v2 */"),
        `patched client quota chunk ${f} must contain UI_MARKER (${variant})`,
      );

      for (const forbidden of ["cookie", "sec_token", "secToken", "Authorization", "sk-sp-"]) {
        assert.ok(
          !patchedClientQuotaChunk.includes(forbidden) || originalClientQuotaChunk.includes(forbidden),
          `patched client quota chunk ${f} must not introduce forbidden secret-like token ${forbidden} (${variant})`,
        );
      }

      const reappliedClientQuotaChunk = buildUiPatched(patchedClientQuotaChunk);
      assert.equal(
        reappliedClientQuotaChunk,
        patchedClientQuotaChunk,
        `reapplication of buildUiPatched on ${f} must be byte-identical (${variant})`,
      );
    }
  }
  assert.ok(clientQuotaPageFound, `Client quota page chunk must be found for ${variant}`);
}

// =========================================================================
// 1b. Fail-closed rejection of ambiguous / multiple supported card branches
// =========================================================================
const currencyMarkerHeader = "/* QuotaTrackerCurrency:v2 */";
const ssrCardBranchSnippet =
  'i?.message?(0,d.jsx)("div",{className:"text-center py-5",children:(0,d.jsx)("p",{className:"text-xs text-text-muted",children:i.message})}):(0,d.jsx)(r,{quotas:D,compact:!0,sortMode:"default",showSortLabel:"codex"===c.provider&&"default"!==at,onHideQuota:a=>aZ(c.provider,a)})';
const clientWCardBranchSnippet =
  'o?.message?(0,a.jsx)("div",{className:"text-center py-5",children:(0,a.jsx)("p",{className:"text-xs text-text-muted",children:o.message})}):(0,a.jsx)(w,{quotas:f,compact:!0,sortMode:"default",showSortLabel:"codex"===r.provider&&"default"!==eN,onHideQuota:e=>e3(r.provider,e)})';
const clientKCardBranchSnippet =
  'o?.message?(0,a.jsx)("div",{className:"text-center py-5",children:(0,a.jsx)("p",{className:"text-xs text-text-muted",children:o.message})}):(0,a.jsx)(k,{quotas:f,compact:!0,sortMode:"default",showSortLabel:"codex"===r.provider&&"default"!==eN,onHideQuota:e=>e3(r.provider,e)})';

assert.throws(
  () => buildUiPatched(currencyMarkerHeader + "\n" + ssrCardBranchSnippet + "\n" + clientWCardBranchSnippet),
  /Quota status card branch not found/,
  "buildUiPatched must throw when input contains both SSR and client W card branches",
);
assert.throws(
  () => buildUiPatched(currencyMarkerHeader + "\n" + clientWCardBranchSnippet + "\n" + clientKCardBranchSnippet),
  /Quota status card branch not found/,
  "buildUiPatched must throw when input contains both client W and client K card branches",
);
assert.throws(
  () => buildUiPatched(currencyMarkerHeader + "\n" + ssrCardBranchSnippet + "\n" + clientKCardBranchSnippet),
  /Quota status card branch not found/,
  "buildUiPatched must throw when input contains both SSR and client K card branches",
);
assert.throws(
  () => buildUiPatched(currencyMarkerHeader + "\n" + ssrCardBranchSnippet + "\n" + clientWCardBranchSnippet + "\n" + clientKCardBranchSnippet),
  /Quota status card branch not found/,
  "buildUiPatched must throw when input contains all three supported card branches",
);
assert.throws(
  () => buildUiPatched(currencyMarkerHeader + "\n" + ssrCardBranchSnippet + "\n" + ssrCardBranchSnippet),
  /Quota status card branch not found/,
  "buildUiPatched must throw when input contains duplicate SSR card branches",
);
assert.throws(
  () => buildUiPatched(currencyMarkerHeader + "\n" + clientWCardBranchSnippet + "\n" + clientWCardBranchSnippet),
  /Quota status card branch not found/,
  "buildUiPatched must throw when input contains duplicate client W card branches",
);
assert.throws(
  () => buildUiPatched(currencyMarkerHeader + "\n" + clientKCardBranchSnippet + "\n" + clientKCardBranchSnippet),
  /Quota status card branch not found/,
  "buildUiPatched must throw when input contains duplicate client K card branches",
);

// =========================================================================
// 2. Safe legacy marker migration and isolation tests
// =========================================================================
const patchSource = fs.readFileSync(path.join(__dirname, "../patches/quota-tracker.patch.js"), "utf8");

const providerCatalogMarker = "/* QuotaTrackerAlibabaProvider:v1 */";
const usageMarker = "/* QuotaTrackerPatch:v2 */";
const providersMarker = "/* QuotaTrackerProviders:v2 */";
const uiMarker = "/* QuotaTrackerCurrency:v2 */";
const uiStatusMarker = "/* QuotaTrackerAlibabaStatus:v1 */";

assert.notEqual(providerCatalogMarker, usageMarker, "provider catalog marker must be separate from usage marker");
assert.notEqual(providerCatalogMarker, providersMarker, "provider catalog marker must be separate from providers marker");
assert.notEqual(providerCatalogMarker, uiMarker, "provider catalog marker must be separate from UI marker");
assert.notEqual(uiStatusMarker, uiMarker, "UI status marker must be separate from UI currency marker");
assert.notEqual(uiStatusMarker, providerCatalogMarker, "UI status marker must be separate from provider catalog marker");
assert.notEqual(uiStatusMarker, usageMarker, "UI status marker must be separate from usage marker");
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

const server869 = fs.readFileSync(path.join(serverRoot, "chunks/869.js"), "utf8");
assert.ok(server869.includes(providerCatalogMarker), "869.js must contain PROVIDER_CATALOG_MARKER");
assert.ok(server869.includes("qwen-cloud-token-plan"), "869.js must contain qwen-cloud-token-plan");
assert.ok(server869.includes("qct"), "869.js must contain qct");

const scratchProviderClientRoute = fs.readFileSync(
  path.join(serverRoot, "app/api/providers/client/route.js"),
  "utf8",
);
assert.ok(
  scratchProviderClientRoute.includes(providerCatalogMarker),
  "provider client route must contain PROVIDER_CATALOG_MARKER",
);
assert.ok(
  scratchProviderClientRoute.includes("qwen-cloud-token-plan"),
  "provider client route must contain qwen-cloud-token-plan",
);
const scratchQuotaPage = fs.readFileSync(
  path.join(serverRoot, "app/(dashboard)/dashboard/quota/page.js"),
  "utf8",
);
assert.ok(
  scratchQuotaPage.includes(uiStatusMarker),
  "scratch quota page must contain UI_STATUS_MARKER",
);
assert.ok(
  scratchQuotaPage.includes("i.raw?.source") || scratchQuotaPage.includes("i?.raw?.source"),
  "scratch quota page must contain i.raw?.source",
);

const scratchClientChunk = fs.readFileSync(
  path.join(scratchRoot, "app/.next-cli-build/static/chunks/app/(dashboard)/dashboard/quota/page-d9d1141b54f2eedd.js"),
  "utf8",
);
assert.ok(
  scratchClientChunk.includes(uiStatusMarker),
  "scratch client chunk must contain UI_STATUS_MARKER",
);
assert.ok(
  scratchClientChunk.includes(uiMarker),
  "scratch client chunk must contain UI_MARKER",
);
assert.ok(
  scratchClientChunk.includes("o?.raw?.source") || scratchClientChunk.includes("o.raw?.source") || scratchClientChunk.includes("o.raw.source"),
  "scratch client chunk must contain o.raw.source",
);
// Idempotent re-apply
const apply2 = runScratchPatch(["--apply"]).trim();
assert.equal(apply2, "already applied", "reapplication must return already applied");

// Rollback test
const rb1 = runScratchPatch(["--rollback"]).trim();
assert.equal(rb1, "rolled back", "rollback must return rolled back");
const server615Clean = fs.readFileSync(path.join(serverRoot, "chunks/615.js"), "utf8");
assert.ok(!server615Clean.includes(providerCatalogMarker), "rolled back 615.js must not contain marker");
assert.ok(!server615Clean.includes("qwen-cloud-token-plan"), "rolled back 615.js must not contain provider");
const quotaPageClean = fs.readFileSync(
  path.join(serverRoot, "app/(dashboard)/dashboard/quota/page.js"),
  "utf8",
);
assert.ok(!quotaPageClean.includes(uiStatusMarker), "rolled back quota page must not contain UI_STATUS_MARKER");
assert.ok(!quotaPageClean.includes(uiMarker), "rolled back quota page must not contain UI_MARKER");

const clientChunkClean = fs.readFileSync(
  path.join(scratchRoot, "app/.next-cli-build/static/chunks/app/(dashboard)/dashboard/quota/page-d9d1141b54f2eedd.js"),
  "utf8",
);
assert.ok(!clientChunkClean.includes(uiStatusMarker), "rolled back client chunk must not contain UI_STATUS_MARKER");
assert.ok(!clientChunkClean.includes(uiMarker), "rolled back client chunk must not contain UI_MARKER");
const rb2 = runScratchPatch(["--rollback"]).trim();
assert.equal(rb2, "already clean", "second rollback must return already clean");
const original615Content = fs.readFileSync(path.join(srcVariantDir, "server/chunks/615.js"), "utf8");
const validLegacy615 = buildLegacyPatched("chunks/615.js", original615Content);

// Test B1: Altered legacy bundle with QuotaTrackerProviders:v2 marker rejected by --apply without modifying disk
const alteredLegacy615 = validLegacy615 + " /* altered legacy content */";
fs.writeFileSync(path.join(serverRoot, "chunks/615.js"), alteredLegacy615, "utf8");
assert.throws(
  () => runScratchPatch(["--apply"]),
  /Unsafe partial patch recovery/,
  "apply must reject altered legacy bundle",
);
const untouched615 = fs.readFileSync(path.join(serverRoot, "chunks/615.js"), "utf8");
assert.equal(untouched615, alteredLegacy615, "rejected apply must preserve altered file without modification");

// Test B2: Valid legacy provider-patched 615 bundle safely migrated by --apply
fs.writeFileSync(path.join(serverRoot, "chunks/615.js"), validLegacy615, "utf8");
const migrateApply = runScratchPatch(["--apply"]).trim();
assert.equal(migrateApply, "applied", "apply on valid legacy bundle must safely migrate and apply");
const migrated615 = fs.readFileSync(path.join(serverRoot, "chunks/615.js"), "utf8");
assert.ok(migrated615.includes(providerCatalogMarker), "migrated 615.js must contain new PROVIDER_CATALOG_MARKER");
assert.ok(migrated615.includes("qwen-cloud-token-plan"), "migrated 615.js must contain canonical provider");


// Test B3: Valid legacy UI-patched page and client bundle safely migrated by --apply
runScratchPatch(["--rollback"]);
const originalPageContent = fs.readFileSync(path.join(srcVariantDir, "server/app/(dashboard)/dashboard/quota/page.js"), "utf8");
const validLegacyPage = buildLegacyPatched("app/(dashboard)/dashboard/quota/page.js", originalPageContent);
fs.writeFileSync(path.join(serverRoot, "app/(dashboard)/dashboard/quota/page.js"), validLegacyPage, "utf8");

const originalClientContent = fs.readFileSync(path.join(srcVariantDir, "static/chunks/app/(dashboard)/dashboard/quota/page-d9d1141b54f2eedd.js"), "utf8");
const validLegacyClient = buildLegacyPatched("../static/chunks/app/(dashboard)/dashboard/quota/page-d9d1141b54f2eedd.js", originalClientContent);
fs.writeFileSync(path.join(scratchRoot, "app/.next-cli-build/static/chunks/app/(dashboard)/dashboard/quota/page-d9d1141b54f2eedd.js"), validLegacyClient, "utf8");

const migrateUiApply = runScratchPatch(["--apply"]).trim();
assert.equal(migrateUiApply, "applied", "apply on valid legacy UI bundle must safely migrate and apply");
const migratedPage = fs.readFileSync(path.join(serverRoot, "app/(dashboard)/dashboard/quota/page.js"), "utf8");
assert.ok(migratedPage.includes(uiStatusMarker), "migrated page.js must contain UI_STATUS_MARKER");
assert.ok(migratedPage.includes(uiMarker), "migrated page.js must contain UI_MARKER");

const migratedClient = fs.readFileSync(path.join(scratchRoot, "app/.next-cli-build/static/chunks/app/(dashboard)/dashboard/quota/page-d9d1141b54f2eedd.js"), "utf8");
assert.ok(migratedClient.includes(uiStatusMarker), "migrated client chunk must contain UI_STATUS_MARKER");
assert.ok(migratedClient.includes(uiMarker), "migrated client chunk must contain UI_MARKER");
// C1: Partial legacy rollback refused
runScratchPatch(["--rollback"]); // rollback to clean state
fs.writeFileSync(path.join(serverRoot, "chunks/615.js"), validLegacy615, "utf8");
assert.throws(
  () => runScratchPatch(["--rollback"]),
  /Partial quota patch detected; refusing unsafe rollback/,
  "rollback must refuse partial legacy patch set",
);

// C2: Full legacy set rollback succeeds and restores originals
// Seed all catalog files with valid legacy patched output from clean originals
const allRelatives = [
  "../static/chunks/1321-54939b699b5f3d07.js",
  "../static/chunks/app/(dashboard)/dashboard/quota/page-d9d1141b54f2eedd.js",
  "app/(dashboard)/dashboard/quota/page.js",
  "app/api/provider-nodes/route.js",
  "app/api/providers/client/route.js",
  "app/api/providers/validate/route.js",
  "app/api/usage/[connectionId]/codex-reset-credits/route.js",
  "app/api/usage/[connectionId]/route.js",
  "app/api/usage/providers/route.js",
  "app/api/v1/audio/voices/route.js",
  "app/api/v1/models/info/route.js",
  "app/api/v1beta/models/route.js",
  "chunks/4664.js",
  "chunks/5619.js",
  "chunks/615.js",
  "chunks/4695.js",
  "chunks/7211.js",
  "chunks/827.js",
  "chunks/869.js",
  "chunks/8847.js",
];
for (const rel of allRelatives) {
  const origFile = rel.startsWith("../static")
    ? path.join(srcVariantDir, rel.slice(3))
    : path.join(srcVariantDir, "server", rel);
  const targetFile = path.join(serverRoot, rel);
  const orig = fs.readFileSync(origFile, "utf8");
  fs.writeFileSync(targetFile, buildLegacyPatched(rel, orig), "utf8");
}
const legacyRb = runScratchPatch(["--rollback"]).trim();
assert.equal(legacyRb, "rolled back", "rollback on fully legacy-patched set must return rolled back");
const cleanServer615 = fs.readFileSync(path.join(serverRoot, "chunks/615.js"), "utf8");
assert.ok(!cleanServer615.includes(providersMarker), "rolled back 615.js must not contain legacy marker");

// Test D: Sanitize handles valid legacy output
fs.writeFileSync(path.join(serverRoot, "chunks/615.js"), validLegacy615, "utf8");
const sanitizeLegacyOut = runScratchPatch(["--sanitize"]).trim();
assert.ok(sanitizeLegacyOut.includes("sanitized"), "sanitize must restore valid legacy output");
const sanitized615 = fs.readFileSync(path.join(serverRoot, "chunks/615.js"), "utf8");
assert.equal(sanitized615, original615Content, "sanitized 615.js must match clean original");

// Sanitize rejects altered legacy bundle
fs.writeFileSync(path.join(serverRoot, "chunks/615.js"), alteredLegacy615, "utf8");
assert.throws(
  () => runScratchPatch(["--sanitize"]),
  /Refusing to sanitize an unknown patched bundle/,
  "sanitize must reject altered legacy bundle",
);
fs.writeFileSync(path.join(serverRoot, "chunks/615.js"), original615Content, "utf8");

// Cleanup scratch root
fs.rmSync(scratchRoot, { recursive: true, force: true });

// =========================================================================
// 3. Operational systemd service configuration verification
// =========================================================================
const serviceFile = path.join(__dirname, "../systemd/9router.service");
assert.ok(fs.existsSync(serviceFile), "systemd/9router.service must exist");
const serviceContent = fs.readFileSync(serviceFile, "utf8");

function parseSystemdSections(content) {
  const sections = Object.create(null);
  let currentSection = null;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) {
      continue;
    }
    const sectionMatch = line.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      if (!sections[currentSection]) {
        sections[currentSection] = [];
      }
      continue;
    }
    const targetSection = currentSection || "__global__";
    if (!sections[targetSection]) {
      sections[targetSection] = [];
    }
    sections[targetSection].push(line);
  }
  return sections;
}
function parseEnvironmentFileDirective(line) {
  const match = line.match(/^EnvironmentFile\s*=\s*(.*)$/);
  if (!match) {
    return null;
  }
  const value = match[1].trim();
  return {
    raw: line,
    value,
    normalized: `EnvironmentFile=${value}`,
  };
}

function verifyServiceEnvironmentFile(content) {
  const parsed = parseSystemdSections(content);
  const serviceDirectives = parsed["Service"] || [];
  const serviceEnvDirectives = serviceDirectives
    .map(parseEnvironmentFileDirective)
    .filter(Boolean);

  assert.equal(
    serviceEnvDirectives.length,
    1,
    "systemd/9router.service [Service] section must contain exactly one EnvironmentFile directive",
  );
  assert.equal(
    serviceEnvDirectives[0].normalized,
    "EnvironmentFile=-%h/.9router/token-plan.env",
    "[Service] section EnvironmentFile directive must be -%h/.9router/token-plan.env",
  );
  assert.equal(
    serviceEnvDirectives[0].value,
    "-%h/.9router/token-plan.env",
    "[Service] section EnvironmentFile directive value must be -%h/.9router/token-plan.env",
  );

  let totalEnvDirectives = 0;
  for (const [sec, directives] of Object.entries(parsed)) {
    const matching = directives
      .map(parseEnvironmentFileDirective)
      .filter(Boolean);
    totalEnvDirectives += matching.length;
    if (sec !== "Service") {
      assert.equal(
        matching.length,
        0,
        `systemd/9router.service must contain zero EnvironmentFile directives outside [Service], found ${matching.length} in [${sec}]`,
      );
    }
  }

  assert.equal(
    totalEnvDirectives,
    1,
    "systemd/9router.service must contain exactly one EnvironmentFile directive across all sections",
  );

  return parsed;
}

const parsedSections = verifyServiceEnvironmentFile(serviceContent);
assert.deepEqual(
  (parsedSections["Service"] || [])
    .map(parseEnvironmentFileDirective)
    .filter(Boolean)
    .map((d) => d.normalized),
  ["EnvironmentFile=-%h/.9router/token-plan.env"],
  "[Service] section must contain exactly the token-plan EnvironmentFile directive",
);
assert.equal(
  (parsedSections["Unit"] || [])
    .map(parseEnvironmentFileDirective)
    .filter(Boolean).length,
  0,
  "[Unit] section must contain zero EnvironmentFile directives",
);
assert.equal(
  (parsedSections["Install"] || [])
    .map(parseEnvironmentFileDirective)
    .filter(Boolean).length,
  0,
  "[Install] section must contain zero EnvironmentFile directives",
);

// Regression assertions: moving directive outside [Service] or duplicating in other sections must fail verification
const unitMovedService = serviceContent
  .replace("EnvironmentFile=-%h/.9router/token-plan.env", "")
  .replace("[Unit]", "[Unit]\nEnvironmentFile=-%h/.9router/token-plan.env");
assert.throws(
  () => verifyServiceEnvironmentFile(unitMovedService),
  /systemd\/9router\.service \[Service\] section must contain exactly one EnvironmentFile directive/,
  "verifyServiceEnvironmentFile must reject service unit where EnvironmentFile is in [Unit]",
);

const installMovedService = serviceContent
  .replace("EnvironmentFile=-%h/.9router/token-plan.env", "")
  .replace("[Install]", "[Install]\nEnvironmentFile=-%h/.9router/token-plan.env");
assert.throws(
  () => verifyServiceEnvironmentFile(installMovedService),
  /systemd\/9router\.service \[Service\] section must contain exactly one EnvironmentFile directive/,
  "verifyServiceEnvironmentFile must reject service unit where EnvironmentFile is in [Install]",
);

const duplicateUnitService = serviceContent.replace(
  "[Unit]",
  "[Unit]\nEnvironmentFile=-%h/.9router/token-plan.env",
);
assert.throws(
  () => verifyServiceEnvironmentFile(duplicateUnitService),
  /zero EnvironmentFile directives outside \[Service\]/,
  "verifyServiceEnvironmentFile must reject service unit with duplicate EnvironmentFile in [Unit]",
);

// Regression assertions: whitespace-formatted EnvironmentFile outside [Service] or with invalid value
const whitespaceUnitMovedService = serviceContent
  .replace("EnvironmentFile=-%h/.9router/token-plan.env", "")
  .replace("[Unit]", "[Unit]\nEnvironmentFile = -%h/.9router/token-plan.env");
assert.throws(
  () => verifyServiceEnvironmentFile(whitespaceUnitMovedService),
  /systemd\/9router\.service \[Service\] section must contain exactly one EnvironmentFile directive/,
  "verifyServiceEnvironmentFile must reject service unit where whitespace-formatted EnvironmentFile is in [Unit]",
);

const whitespaceInstallMovedService = serviceContent
  .replace("EnvironmentFile=-%h/.9router/token-plan.env", "")
  .replace("[Install]", "[Install]\nEnvironmentFile  =  -%h/.9router/token-plan.env");
assert.throws(
  () => verifyServiceEnvironmentFile(whitespaceInstallMovedService),
  /systemd\/9router\.service \[Service\] section must contain exactly one EnvironmentFile directive/,
  "verifyServiceEnvironmentFile must reject service unit where whitespace-formatted EnvironmentFile is in [Install]",
);

const whitespaceDuplicateUnitService = serviceContent.replace(
  "[Unit]",
  "[Unit]\nEnvironmentFile = -%h/.9router/token-plan.env",
);
assert.throws(
  () => verifyServiceEnvironmentFile(whitespaceDuplicateUnitService),
  /zero EnvironmentFile directives outside \[Service\]/,
  "verifyServiceEnvironmentFile must reject service unit with whitespace-formatted duplicate EnvironmentFile in [Unit]",
);

const whitespaceDuplicateInstallService = serviceContent.replace(
  "[Install]",
  "[Install]\nEnvironmentFile   =   -%h/.9router/token-plan.env",
);
assert.throws(
  () => verifyServiceEnvironmentFile(whitespaceDuplicateInstallService),
  /zero EnvironmentFile directives outside \[Service\]/,
  "verifyServiceEnvironmentFile must reject service unit with whitespace-formatted duplicate EnvironmentFile in [Install]",
);

const whitespaceServiceOnly = serviceContent.replace(
  "EnvironmentFile=-%h/.9router/token-plan.env",
  "EnvironmentFile  =  -%h/.9router/token-plan.env",
);
const parsedWhitespaceService = verifyServiceEnvironmentFile(whitespaceServiceOnly);
assert.equal(
  (parsedWhitespaceService["Service"] || [])
    .map(parseEnvironmentFileDirective)
    .filter(Boolean)[0].normalized,
  "EnvironmentFile=-%h/.9router/token-plan.env",
  "verifyServiceEnvironmentFile must normalize whitespace in [Service] EnvironmentFile directive",
);

const wrongValueService = serviceContent.replace(
  "EnvironmentFile=-%h/.9router/token-plan.env",
  "EnvironmentFile = -%h/.9router/other.env",
);
assert.throws(
  () => verifyServiceEnvironmentFile(wrongValueService),
  /\[Service\] section EnvironmentFile directive must be -%h\/\.9router\/token-plan\.env/,
  "verifyServiceEnvironmentFile must reject [Service] EnvironmentFile directive with invalid path",
);
// Reject tracked literal secret values or secret names with assignments
assert.ok(
  !serviceContent.includes("ALIBABA_TOKEN_PLAN_QUOTA_COOKIE"),
  "systemd/9router.service must not contain ALIBABA_TOKEN_PLAN_QUOTA_COOKIE",
);
assert.ok(
  !serviceContent.includes("ALIBABA_TOKEN_PLAN_SEC_TOKEN"),
  "systemd/9router.service must not contain ALIBABA_TOKEN_PLAN_SEC_TOKEN",
);
assert.ok(
  !/ALIBABA_TOKEN_PLAN_[A-Z_]+\s*=/i.test(serviceContent),
  "systemd/9router.service must not contain literal secret assignments",
);
console.log("quota tracker integration tests: ok");
