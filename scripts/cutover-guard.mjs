// Cutover guard: keeps a build from silently downgrading the machine it will
// be installed on.
//
// This exists because it happened: the main checkout sat on the previous
// release line (enhanced/0.5.69) while the live service ran 0.5.75 from
// update/upstream-0.5.75, and `npm run cli:pack` from the wrong tree happily
// packed 0.5.69 — the install then downgraded the running service and the
// dashboard announced an update. Nothing in the pack pipeline compared the
// tree being built against the package that was already installed.
//
// Modes:
//   pre     run before packing (wired as `precli:pack`); fails closed when the
//           candidate is older than the installed package
//   verify  run after `npm install -g`; checks the live service answers with the
//           version that was just installed
//
// Escape hatch: ALLOW_DOWNGRADE=1 (a deliberate rollback).

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function readVersion(packageJsonPath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    return typeof parsed?.version === "string" ? parsed.version.trim() : null;
  } catch {
    return null;
  }
}

/** Numeric-segment compare: 0.5.9 < 0.5.10, so lexical ordering would be wrong. */
export function compareVersions(a, b) {
  const parts = (v) =>
    String(v)
      .split("-")[0]
      .split(".")
      .map((n) => Number.parseInt(n, 10) || 0);
  const left = parts(a);
  const right = parts(b);
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (left[i] || 0) - (right[i] || 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

export function evaluateCutover({ candidateVersion, installedVersion, allowDowngrade = false }) {
  if (!candidateVersion) return { ok: false, reason: "no version in the tree being packed" };
  if (!installedVersion) return { ok: true, reason: "nothing installed on this machine" };
  const cmp = compareVersions(candidateVersion, installedVersion);
  if (cmp > 0) return { ok: true, reason: `upgrade ${installedVersion} -> ${candidateVersion}` };
  if (cmp === 0) return { ok: true, reason: `same-version hot cut (${candidateVersion})` };
  if (allowDowngrade) return { ok: true, reason: `downgrade allowed by ALLOW_DOWNGRADE=1` };
  return {
    ok: false,
    reason:
      `this tree builds ${candidateVersion}, the installed package is ${installedVersion}: ` +
      `packing here would DOWNGRADE the live service`,
  };
}

/** Installed package root, mirroring what start-9router.sh will launch. */
export function resolveInstalledRoot(env = process.env) {
  if (env.NINE_ROUTER_PACKAGE_ROOT) return env.NINE_ROUTER_PACKAGE_ROOT;
  const home = env.HOME || os.homedir();
  const stateFile = path.join(home, ".9router", "9router-package-root");
  try {
    const fromState = fs.readFileSync(stateFile, "utf8").trim();
    if (fromState) return fromState;
  } catch {}
  return path.join(home, ".hermes", "node", "lib", "node_modules", "9router");
}

function git(args) {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function preflight() {
  const candidateVersion = readVersion(path.join(ROOT, "package.json"));
  const installedRoot = resolveInstalledRoot();
  const installedVersion = readVersion(path.join(installedRoot, "package.json"));
  const branch = git(["branch", "--show-current"]) || "(detached)";
  const verdict = evaluateCutover({
    candidateVersion,
    installedVersion,
    allowDowngrade: process.env.ALLOW_DOWNGRADE === "1",
  });

  console.log(`[cutover-guard] tree: ${candidateVersion || "?"} on ${branch}`);
  console.log(`[cutover-guard] installed: ${installedVersion || "none"} (${installedRoot})`);
  console.log(`[cutover-guard] ${verdict.ok ? "ok" : "BLOCKED"}: ${verdict.reason}`);
  if (!verdict.ok) {
    console.log(
      `[cutover-guard] pack the deployed line instead, or set ALLOW_DOWNGRADE=1 for a deliberate rollback`,
    );
    return 1;
  }

  // `npm pack` writes 9router-<ver>.tgz into the repo root, and some of those
  // tarballs are tracked release artifacts — packing would dirty them.
  const tarball = `9router-${candidateVersion}.tgz`;
  if (git(["ls-files", "--error-unmatch", tarball])) {
    console.log(
      `[cutover-guard] note: ${tarball} is tracked; restore it with \`git checkout -- ${tarball}\` after packing`,
    );
  }
  return 0;
}

async function getJson(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return { ok: response.ok, status: response.status, body: await response.json().catch(() => null) };
  } catch (err) {
    return { ok: false, status: 0, error: err?.message || "request failed" };
  }
}

async function verify() {
  const port = process.env.NINE_ROUTER_PORT || "20128";
  const base = `http://127.0.0.1:${port}`;
  const installedRoot = resolveInstalledRoot();
  const installedVersion = readVersion(path.join(installedRoot, "package.json"));
  let failed = false;

  const health = await getJson(`${base}/api/health`);
  const healthy = health.ok && health.body?.ok === true;
  console.log(`[cutover-guard] health: ${healthy ? "ok" : `FAIL (${health.error || health.status})`}`);
  failed ||= !healthy;

  const version = await getJson(`${base}/api/version`);
  if (!version.ok) {
    console.log(`[cutover-guard] version endpoint: FAIL (${version.error || version.status})`);
    return 1;
  }
  const live = version.body?.currentVersion;
  const matches = Boolean(live) && live === installedVersion;
  console.log(
    `[cutover-guard] live ${live} vs installed ${installedVersion}: ${matches ? "match" : "MISMATCH"}`,
  );
  failed ||= !matches;

  if (version.body?.hasUpdate) {
    // Expected whenever the fork trails the upstream npm release — the endpoint
    // compares against registry npm `9router`, not against this fork — so it is
    // reported, not counted as a failure.
    console.log(
      `[cutover-guard] note: dashboard offers ${version.body?.latestVersion} (upstream npm) over ${live}`,
    );
  }
  return failed ? 1 : 0;
}

const invokedDirectly =
  Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const mode = process.argv[2];
  const run = mode === "pre" ? preflight : mode === "verify" ? verify : null;
  if (!run) {
    console.error("usage: node scripts/cutover-guard.mjs pre|verify");
    process.exit(2);
  }
  process.exit(await run());
}
