#!/usr/bin/env node
"use strict";

const assert = require("assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const originals = path.join(
  repoRoot,
  "patches/quota-tracker-originals/enhanced-0.5.59",
);
const patcher = path.join(repoRoot, "patches/quota-tracker.patch.js");

assert.ok(fs.existsSync(originals), "enhanced-0.5.59 originals must exist");
assert.ok(fs.existsSync(patcher), "quota-tracker.patch.js must exist");

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "quota-0559-enh-"));
fs.mkdirSync(path.join(scratch, "app/.next-cli-build"), { recursive: true });
fs.cpSync(path.join(originals, "server"), path.join(scratch, "app/.next-cli-build/server"), {
  recursive: true,
});
fs.cpSync(path.join(originals, "static"), path.join(scratch, "app/.next-cli-build/static"), {
  recursive: true,
});
fs.writeFileSync(
  path.join(scratch, "package.json"),
  JSON.stringify({ name: "9router", version: "0.5.59" }),
);
fs.copyFileSync(patcher, path.join(scratch, "quota-tracker.patch.js"));

function run(args) {
  return execFileSync(process.execPath, [path.join(scratch, "quota-tracker.patch.js"), ...args], {
    cwd: scratch,
    encoding: "utf8",
    env: { ...process.env, NINE_ROUTER_PACKAGE_ROOT: scratch },
  });
}

const checkBefore = JSON.parse(run(["--check"]));
assert.equal(checkBefore.catalogVariant, "enhanced-0.5.59");
assert.equal(checkBefore.usagePatched, false);
assert.equal(checkBefore.catalogPatched, 0);
assert.equal(checkBefore.catalogTotal, 20);

assert.equal(run(["--apply"]).trim(), "applied");

const checkAfter = JSON.parse(run(["--check"]));
assert.equal(checkAfter.catalogVariant, "enhanced-0.5.59");
assert.equal(checkAfter.usagePatched, true);
assert.equal(checkAfter.catalogPatched, checkAfter.catalogTotal);
assert.equal(checkAfter.catalogTotal, 20);

const usage = fs.readFileSync(
  path.join(scratch, "app/.next-cli-build/server/chunks/7211.js"),
  "utf8",
);
assert.ok(usage.includes("qtpOpenCodeGo"), "enhanced 0.5.59 usage chunk must include OpenCode Go collector");
assert.ok(usage.includes("https://opencode.ai/zen/go/v1/usage"));
assert.ok(usage.includes('"opencode-go":a=>qtpOpenCodeGo'));
assert.ok(usage.includes('"alitp-intl":a=>qtpAlibaba'));
assert.ok(!usage.includes("qtpDeepSeek"), "enhanced 0.5.59 must keep official DeepSeek usage");
assert.ok(!usage.includes("qtpNormalizeXai"), "enhanced 0.5.59 must keep official Grok usage unwrapped");
assert.ok(/deepseek:a=>[A-Za-z_$]/.test(usage), "official DeepSeek dispatch must remain");
assert.ok(usage.includes("Grok CLI usage error"), "official Grok CLI collector must remain");
assert.ok(
  !usage.includes("qtpAntigravity"),
  "enhanced 0.5.59 must keep the official Antigravity collector",
);
assert.ok(
  /antigravity:a=>\(0,/.test(usage),
  "official Antigravity dispatch must remain",
);
assert.ok(
  usage.includes("connectionId:a.id||a.connectionId"),
  "usage dispatch must pass connectionId into collectors",
);
assert.ok(
  usage.includes("agentModelSorts") && usage.includes("deprecatedModelIds"),
  "enhanced build must compile the Antigravity quota model-filter delta",
);

const catalog = fs.readFileSync(
  path.join(scratch, "app/.next-cli-build/server/chunks/3257.js"),
  "utf8",
);
assert.ok(catalog.includes("/* OpenCodeGoUsage:v1 */"));
assert.ok(catalog.includes('id:"alitp-intl"'));
assert.ok(catalog.includes("/* AlitpUsage:v1 */"));
assert.ok(
  catalog.includes('id:"glm-5.3-flash"') && catalog.includes('id:"deepseek-v4-flash-vision-exp"'),
  "enhanced 0.5.59 must keep the official OpenCode Go model catalog",
);
assert.ok(
  !catalog.includes('"id":"qwen-cloud-token-plan"') && !catalog.includes('id:"qwen-cloud-token-plan"'),
  "enhanced 0.5.59 catalog must use native alitp-intl instead of injecting qwen-cloud-token-plan",
);

const client = fs.readFileSync(
  path.join(scratch, "app/.next-cli-build/static/chunks/1321-2a57edbbd554a357.js"),
  "utf8",
);
assert.ok(client.includes("/* OpenCodeGoUsage:v1 */"));
assert.ok(client.includes("/* AlitpUsage:v1 */"));
assert.ok(
  !client.includes('"id":"qwen-cloud-token-plan"') && !client.includes('id:"qwen-cloud-token-plan"'),
  "enhanced 0.5.59 client catalog must not inject qwen-cloud-token-plan",
);

const server615 = fs.readFileSync(
  path.join(scratch, "app/.next-cli-build/server/chunks/615.js"),
  "utf8",
);
assert.ok(server615.includes("/* QuotaTrackerAlibabaProvider:v1 */"));
assert.ok(
  !server615.includes('"id":"qwen-cloud-token-plan"') && !server615.includes('id:"qwen-cloud-token-plan"'),
  "enhanced 0.5.59 615.js must not inject qwen-cloud-token-plan",
);

const ui = fs.readFileSync(
  path.join(
    scratch,
    "app/.next-cli-build/static/chunks/app/(dashboard)/dashboard/quota/page-f8f2554003335349.js",
  ),
  "utf8",
);
assert.ok(ui.includes("/* QuotaTrackerCurrency:v2 */"), "enhanced 0.5.59 dashboard must render USD currency");
assert.ok(ui.includes("Unlimited"), "official unlimited quota rendering must be preserved");

assert.equal(run(["--apply"]).trim(), "already applied");
assert.equal(run(["--rollback"]).trim(), "rolled back");
assert.ok(
  !fs
    .readFileSync(path.join(scratch, "app/.next-cli-build/server/chunks/7211.js"), "utf8")
    .includes("qtpOpenCodeGo"),
);
assert.equal(run(["--rollback"]).trim(), "already clean");

const checkClean = JSON.parse(run(["--check"]));
assert.equal(checkClean.catalogVariant, "enhanced-0.5.59");
assert.equal(checkClean.usagePatched, false);
assert.equal(checkClean.catalogPatched, 0);

fs.rmSync(scratch, { recursive: true, force: true });
console.log("quota tracker enhanced-0.5.59 isolation tests: ok");
