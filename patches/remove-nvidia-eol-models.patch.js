#!/usr/bin/env node
"use strict";

// Remove NVIDIA NIM model metadata that the live NVIDIA catalog retired.
//
// This is deliberately narrow: it removes only the NVIDIA provider's static
// catalog entries and capability metadata. Provider aliases owned by
// TokenRouter/other connections, and request/usage history, are untouched.
// The live provider catalog and configured combos are cleaned separately via
// the 9Router API/SQLite before this overlay is applied.

const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const HOME = os.homedir();
const PACKAGE_ROOT = process.env.NINE_ROUTER_PACKAGE_ROOT ||
  path.join(HOME, ".hermes/node/lib/node_modules/9router");
const BUNDLE_ROOT = path.join(PACKAGE_ROOT, "app/.next-cli-build");
const PACKAGE_JSON = path.join(PACKAGE_ROOT, "package.json");
const BACKUP_ROOT = path.join(HOME, ".9router/nvidia-eol-catalog-originals");
const PATCH_TAG = "/* HERMES_NVIDIA_EOL_MODELS_V1 */";
const UI_PATCH_TAG = "/* HERMES_PROVIDER_NAME_SEARCH_V1 */";

const CATALOG_NEEDLE =
  ',{id:"z-ai/glm-5.2",name:"GLM 5.2"},{id:"deepseek-ai/deepseek-v4-pro",name:"DeepSeek V4 Pro"}';
const CAPABILITY_NEEDLE =
  ',"z-ai/glm-5.2":{reasoning:!0,thinkingFormat:"openai",contextWindow:2e5,maxOutput:128e3},"deepseek-ai/deepseek-v4-pro":{reasoning:!0,thinkingFormat:"openai",contextWindow:1e6,maxOutput:65536}';
// The server-side provider grid and its client bundle drop a provider whose
// name matches the search term but whose model list does not.
const UI_SERVER_NEEDLE =
  'if(a){let b=d.name.toLowerCase().includes(a);if(0===(f=f.filter(b=>b.name.toLowerCase().includes(a)||b.id.toLowerCase().includes(a))).length&&!b)return}';
const UI_SERVER_REPLACEMENT =
  'if(a){let b=d.name.toLowerCase().includes(a);if(!b&&0===(f=f.filter(b=>b.name.toLowerCase().includes(a)||b.id.toLowerCase().includes(a))).length)return}/* HERMES_PROVIDER_NAME_SEARCH_V1 */';
const UI_STATIC_NEEDLE =
  'if(e){let t=s.name.toLowerCase().includes(e);if(0===(n=n.filter(t=>t.name.toLowerCase().includes(e)||t.id.toLowerCase().includes(e))).length&&!t)return}';
const UI_STATIC_REPLACEMENT =
  'if(e){let t=s.name.toLowerCase().includes(e);if(!t&&0===(n=n.filter(t=>t.name.toLowerCase().includes(e)||t.id.toLowerCase().includes(e))).length)return}/* HERMES_PROVIDER_NAME_SEARCH_V1 */';

// Hashes are the enhanced build *after* quota-tracker applies: that overlay
// owns some of the same catalog chunks and always runs first.
const TARGETS_BY_VERSION = {
  "0.5.55": [
    {
      relative: "server/chunks/3547.js",
      expectedSha256: "39c3e97e0d3ebda0217447285520f18932e72e98e8ea9ce6d64efbbe10f3cc0f",
      needle: CATALOG_NEEDLE,
    },
    {
      relative: "server/chunks/4953.js",
      expectedSha256: "c9434782232c0869713bed2290c947cddb4897b98f7def75017d4bd430e8e425",
      needle: CATALOG_NEEDLE,
    },
    {
      relative: "server/chunks/5285.js",
      expectedSha256: "4b7f0a2afb39e548c4ef23f60d2293a9f718054a32c83c50f583a6c5b485e9f0",
      needle: CATALOG_NEEDLE,
    },
    {
      relative: "static/chunks/1321-914afc18e65fc58b.js",
      expectedSha256: "f511f471f76d2aad286937225f7a851d3699b0e98ce27453725227dd8f203796",
      needle: CATALOG_NEEDLE,
    },
    {
      relative: "server/chunks/412.js",
      expectedSha256: "7ace787f6e70ebda57c5bf719175443591da4308754582f70775d0cedfd042ba",
      needle: CAPABILITY_NEEDLE,
      uiNeedle: UI_SERVER_NEEDLE,
      uiReplacement: UI_SERVER_REPLACEMENT,
    },
    {
      relative: "server/chunks/6306.js",
      expectedSha256: "18abe759d54d4043089748fc6dbadd80b45dccc7a15f0b38d169d68f1cb3eaa5",
      needle: CAPABILITY_NEEDLE,
    },
    {
      relative: "static/chunks/5497-17db8ce7293bc189.js",
      expectedSha256: "ecb2af60f11b0b95a73f6dfde2b2f3c167600c1e8460a094b9dd0ac32a14faee",
      needle: CAPABILITY_NEEDLE,
      uiNeedle: UI_STATIC_NEEDLE,
      uiReplacement: UI_STATIC_REPLACEMENT,
    },
  ],
  "0.5.59": [
    {
      relative: "server/chunks/3257.js",
      expectedSha256: "380797fad638910e2e08542f24567846a5937b2b565e44825fa6bf6c712353cc",
      needle: CATALOG_NEEDLE,
    },
    {
      relative: "server/chunks/3753.js",
      expectedSha256: "1651fedef03cf23bee259d1674b2c2fff5d7b4214a160ac8cbe3c6f556e022e8",
      needle: CATALOG_NEEDLE,
    },
    {
      relative: "server/chunks/8236.js",
      expectedSha256: "6b2218ff5041ef364cfe9b2679553234015df6125997fb33f879674b7d57ce22",
      needle: CATALOG_NEEDLE,
    },
    {
      relative: "static/chunks/1321-2a57edbbd554a357.js",
      expectedSha256: "367a82ec8e6a88043c9680694355c6fafeab26ca6174acd548d4bf316c8e9a90",
      needle: CATALOG_NEEDLE,
    },
    {
      relative: "server/chunks/412.js",
      expectedSha256: "ca21936b7a989aaaf620daeed633df27d2a355f0690cecb43433fec12042a069",
      needle: CAPABILITY_NEEDLE,
      uiNeedle: UI_SERVER_NEEDLE,
      uiReplacement: UI_SERVER_REPLACEMENT,
    },
    {
      relative: "server/chunks/24.js",
      expectedSha256: "918697a16971b4a9aba899ceb052236b25fd3fe22ca43d67d6923ac031634d1f",
      needle: CAPABILITY_NEEDLE,
    },
    {
      relative: "server/chunks/8402.js",
      expectedSha256: "7d2877fe672c69a23beb57f25bce34dcde5e91ed48340eac6fa6908f2d40d90c",
      needle: CAPABILITY_NEEDLE,
    },
    {
      relative: "static/chunks/5497-d69a7840b37e537e.js",
      expectedSha256: "d32df5f353062c5a090e9c1e2864db5929a19a9a8fddd7524de9db01f7505a4c",
      needle: CAPABILITY_NEEDLE,
      uiNeedle: UI_STATIC_NEEDLE,
      uiReplacement: UI_STATIC_REPLACEMENT,
    },
  ],
};

function packageVersion() {
  try {
    return JSON.parse(fs.readFileSync(PACKAGE_JSON, "utf8")).version || "unknown";
  } catch {
    return "unknown";
  }
}

const VERSION = packageVersion();
const VERSION_BACKUP_ROOT = path.join(BACKUP_ROOT, VERSION);
const TARGETS = TARGETS_BY_VERSION[VERSION] || [];

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function count(content, needle) {
  let total = 0;
  let position = 0;
  while (true) {
    const found = content.indexOf(needle, position);
    if (found < 0) return total;
    total += 1;
    position = found + needle.length;
  }
}

function targetPath(target) {
  return path.join(BUNDLE_ROOT, target.relative);
}

function backupPath(target) {
  return path.join(VERSION_BACKUP_ROOT, target.relative);
}

function readTarget(target) {
  const file = targetPath(target);
  if (!fs.existsSync(file)) {
    throw new Error(`target missing: ${file}`);
  }
  return fs.readFileSync(file, "utf8");
}

function inspectTarget(target, content) {
  const markers = count(content, PATCH_TAG);
  const oldNeedle = count(content, target.needle);
  const hash = sha256(content);
  const uiMarkers = target.uiNeedle ? count(content, UI_PATCH_TAG) : 0;
  const oldUiNeedle = target.uiNeedle ? count(content, target.uiNeedle) : 0;

  if (markers === 1 && oldNeedle === 0) {
    if (!target.uiNeedle) return "applied";
    if (uiMarkers === 1 && oldUiNeedle === 0) return "applied";
    // Version 1 of this overlay already removed the NVIDIA entries but did not
    // yet own the provider-name search fix. It is safe to peel and reapply.
    if (uiMarkers === 0 && oldUiNeedle === 1) return "applied-legacy";
  }
  if (
    markers === 0 &&
    oldNeedle === 1 &&
    hash === target.expectedSha256 &&
    (!target.uiNeedle || (uiMarkers === 0 && oldUiNeedle === 1))
  ) {
    return "patchable";
  }
  if (markers === 0 && oldNeedle === 0) return "already-clean-unknown-shape";
  return `incompatible(markers=${markers},needle=${oldNeedle},uiMarkers=${uiMarkers},uiNeedle=${oldUiNeedle},sha256=${hash})`;
}

function readAll() {
  return TARGETS.map((target) => {
    const content = readTarget(target);
    return { target, content, state: inspectTarget(target, content) };
  });
}

function writeAtomic(file, content) {
  const temporary = `${file}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, content, { mode: 0o644 });
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}

function makeBackups(items) {
  fs.mkdirSync(VERSION_BACKUP_ROOT, { recursive: true, mode: 0o700 });
  for (const { target, content } of items) {
    const backup = backupPath(target);
    fs.mkdirSync(path.dirname(backup), { recursive: true, mode: 0o700 });
    if (fs.existsSync(backup)) {
      const existing = fs.readFileSync(backup, "utf8");
      if (sha256(existing) !== target.expectedSha256) {
        throw new Error(`backup hash mismatch: ${backup}`);
      }
    } else {
      fs.writeFileSync(backup, content, { mode: 0o600 });
    }
    fs.chmodSync(backup, 0o600);
  }
}

function restoreFromBackups() {
  for (const target of TARGETS) {
    const backup = backupPath(target);
    if (!fs.existsSync(backup)) {
      throw new Error(`backup missing: ${backup}`);
    }
    const original = fs.readFileSync(backup, "utf8");
    if (sha256(original) !== target.expectedSha256) {
      throw new Error(`backup hash mismatch: ${backup}`);
    }
  }
  for (const target of TARGETS) {
    const original = fs.readFileSync(backupPath(target), "utf8");
    writeAtomic(targetPath(target), original);
  }
}

function apply() {
  if (!TARGETS_BY_VERSION[VERSION]) {
    console.error(`[nvidia-eol] unsupported 9Router version ${VERSION}; refusing to patch`);
    return false;
  }

  let items;
  try {
    items = readAll();
  } catch (error) {
    console.error(`[nvidia-eol] ${error.message}`);
    return false;
  }
  let states = items.map((item) => item.state);
  if (states.every((state) => state === "applied")) {
    console.log(JSON.stringify({ patch: "nvidia-eol", version: VERSION, status: "already-applied", targets: TARGETS.length }));
    return true;
  }
  if (
    states.some((state) => state === "applied-legacy") &&
    states.every((state) => state === "applied" || state === "applied-legacy")
  ) {
    try {
      restoreFromBackups();
      items = readAll();
      states = items.map((item) => item.state);
      console.log(JSON.stringify({ patch: "nvidia-eol", version: VERSION, status: "upgrading-legacy-ui" }));
    } catch (error) {
      console.error(`[nvidia-eol] legacy upgrade rollback failed: ${error.message}`);
      return false;
    }
  }
  if (!states.every((state) => state === "patchable")) {
    console.error(JSON.stringify({ patch: "nvidia-eol", version: VERSION, status: "refused", states }));
    return false;
  }

  const transformed = items.map(({ target, content }) => {
    let next = content.replace(target.needle, PATCH_TAG);
    if (target.uiNeedle) {
      next = next.replace(target.uiNeedle, target.uiReplacement);
    }
    if (
      next === content ||
      count(next, target.needle) !== 0 ||
      count(next, PATCH_TAG) !== 1 ||
      (target.uiNeedle && (count(next, target.uiNeedle) !== 0 || count(next, UI_PATCH_TAG) !== 1))
    ) {
      throw new Error(`transform sanity check failed: ${target.relative}`);
    }
    return { target, original: content, next };
  });

  try {
    makeBackups(transformed.map(({ target, original }) => ({ target, content: original })));
    for (const { target, next } of transformed) {
      writeAtomic(targetPath(target), next);
    }
    const after = readAll();
    if (!after.every((item) => item.state === "applied")) {
      throw new Error("post-write state check failed");
    }
  } catch (error) {
    try {
      restoreFromBackups();
    } catch (rollbackError) {
      console.error(`[nvidia-eol] automatic rollback failed: ${rollbackError.message}`);
    }
    console.error(`[nvidia-eol] apply failed: ${error.message}`);
    return false;
  }

  console.log(JSON.stringify({ patch: "nvidia-eol", version: VERSION, status: "applied", targets: TARGETS.length, backup: VERSION_BACKUP_ROOT }));
  return true;
}

function rollback() {
  try {
    restoreFromBackups();
    const after = readAll();
    if (!after.every((item) => item.state === "patchable")) {
      throw new Error("post-rollback state check failed");
    }
  } catch (error) {
    console.error(`[nvidia-eol] rollback failed: ${error.message}`);
    return false;
  }
  console.log(JSON.stringify({ patch: "nvidia-eol", version: VERSION, status: "rolled-back", targets: TARGETS.length }));
  return true;
}

function check() {
  if (!TARGETS_BY_VERSION[VERSION]) {
    console.error(`[nvidia-eol] unsupported 9Router version ${VERSION}`);
    return false;
  }
  let items;
  try {
    items = readAll();
  } catch (error) {
    console.error(`[nvidia-eol] ${error.message}`);
    return false;
  }
  const states = items.map((item) => item.state);
  if (states.every((state) => state === "applied")) {
    console.log(JSON.stringify({ patch: "nvidia-eol", version: VERSION, status: "applied", targets: TARGETS.length }));
    return true;
  }
  if (
    states.some((state) => state === "applied-legacy") &&
    states.every((state) => state === "applied" || state === "applied-legacy")
  ) {
    console.log(JSON.stringify({ patch: "nvidia-eol", version: VERSION, status: "applied-legacy", targets: TARGETS.length, states }));
    return true;
  }
  console.log(JSON.stringify({ patch: "nvidia-eol", version: VERSION, status: "not-applied", states }));
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
  console.error("Usage: remove-nvidia-eol-models.patch.js --apply|--rollback|--check");
  process.exit(2);
}
