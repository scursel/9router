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
  "patches/quota-tracker-originals/official-0.5.55",
);
const patcher = path.join(repoRoot, "patches/quota-tracker.patch.js");

assert.ok(fs.existsSync(originals), "official-0.5.55 originals must exist");
assert.ok(fs.existsSync(patcher), "quota-tracker.patch.js must exist");

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "quota-0555-"));
fs.mkdirSync(path.join(scratch, "app/.next-cli-build"), { recursive: true });
fs.cpSync(path.join(originals, "server"), path.join(scratch, "app/.next-cli-build/server"), {
  recursive: true,
});
fs.cpSync(path.join(originals, "static"), path.join(scratch, "app/.next-cli-build/static"), {
  recursive: true,
});
fs.writeFileSync(
  path.join(scratch, "package.json"),
  JSON.stringify({ name: "9router", version: "0.5.55" }),
);
fs.copyFileSync(patcher, path.join(scratch, "quota-tracker.patch.js"));

function run(args) {
  return execFileSync(process.execPath, [path.join(scratch, "quota-tracker.patch.js"), ...args], {
    env: { ...process.env, NINE_ROUTER_PACKAGE_ROOT: scratch },
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });
}

const checkBefore = JSON.parse(run(["--check"]));
assert.equal(checkBefore.catalogVariant, "official-0.5.55");
assert.equal(checkBefore.usagePatched, false);
assert.equal(checkBefore.catalogPatched, 0);
assert.equal(checkBefore.catalogTotal, 20);

assert.equal(run(["--apply"]).trim(), "applied");

const checkAfter = JSON.parse(run(["--check"]));
assert.equal(checkAfter.catalogVariant, "official-0.5.55");
assert.equal(checkAfter.usagePatched, true);
assert.equal(checkAfter.catalogPatched, checkAfter.catalogTotal);
assert.equal(checkAfter.catalogTotal, 20);

const usage = fs.readFileSync(
  path.join(scratch, "app/.next-cli-build/server/chunks/7211.js"),
  "utf8",
);
assert.ok(usage.includes("qtpOpenCodeGo"), "0.5.55 usage chunk must include OpenCode Go collector");
assert.ok(usage.includes("https://opencode.ai/zen/go/v1/usage"));
assert.ok(usage.includes('"opencode-go":a=>qtpOpenCodeGo'));
assert.ok(usage.includes('"alitp-intl":a=>qtpAlibaba'));
assert.ok(usage.includes('"qwen-cloud-token-plan":a=>qtpAlibaba'));

const catalog = fs.readFileSync(
  path.join(scratch, "app/.next-cli-build/server/chunks/7011.js"),
  "utf8",
);
assert.ok(catalog.includes("/* OpenCodeGoUsage:v1 */"));
assert.ok(catalog.includes('id:"alitp-intl"'));
assert.ok(catalog.includes("transports:[{format:\"openai\""));
assert.ok(catalog.includes("qwen-cloud-token-plan"));

const client = fs.readFileSync(
  path.join(scratch, "app/.next-cli-build/static/chunks/1321-914afc18e65fc58b.js"),
  "utf8",
);
assert.ok(client.includes("/* OpenCodeGoUsage:v1 */"));
assert.ok(client.includes("qwen-cloud-token-plan"));

assert.equal(run(["--apply"]).trim(), "already applied");
assert.equal(run(["--rollback"]).trim(), "rolled back");
assert.ok(
  !fs
    .readFileSync(path.join(scratch, "app/.next-cli-build/server/chunks/7211.js"), "utf8")
    .includes("qtpOpenCodeGo"),
);
assert.equal(run(["--rollback"]).trim(), "already clean");

fs.rmSync(scratch, { recursive: true, force: true });
console.log("quota tracker official-0.5.55 isolation tests: ok");
