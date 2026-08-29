#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");

const HOME = os.homedir();
const PACKAGE_ROOT = process.env.NINE_ROUTER_PACKAGE_ROOT ||
  fs.readFileSync(path.join(HOME, ".9router/9router-package-root"), "utf8").trim();
const ROUTE = path.join(
  PACKAGE_ROOT,
  "app/.next-cli-build/server/app/api/v1/images/generations/route.js",
);
const LEGACY_ORIGINAL = path.join(HOME, ".9router/wan-image-original.route.js");
const MARKER = "WanImageProviderPatch:v1";
const PROVIDER_ID = "openai-compatible-chat-f13a8bca-e94e-478a-99e2-d4b1032f1522";
const ALIBABA_COMPAT_URL =
  "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions";

function atomicWrite(file, content) {
  const temporary = `${file}.wan-image-${process.pid}.tmp`;
  fs.writeFileSync(temporary, content, { mode: 0o600 });
  fs.renameSync(temporary, file);
}

const PROVIDER_ENTRY = [
  `"${PROVIDER_ID}":{`,
  `buildUrl:(model,credentials)=>${JSON.stringify(ALIBABA_COMPAT_URL)},`,
  `buildHeaders:credentials=>{const key=credentials?.apiKey||credentials?.accessToken||"";return{"Content-Type":"application/json",Authorization:"Bearer "+key}},`,
  `buildBody:(model,body)=>{const raw=String(body.size||"1024x1024");const size=raw.includes("4096")?"4K":(raw.includes("2048")||raw.includes("1536")?"2K":"1K");const content=[{text:String(body.prompt||"")}];const refs=[];if(Array.isArray(body.images))refs.push(...body.images);if(body.image)refs.push(body.image);for(const image of refs.filter(x=>typeof x==="string"&&x).slice(0,4))content.push({image});const parameters={size,watermark:typeof body.watermark==="boolean"?body.watermark:false};for(const key of ["negative_prompt","prompt_extend","seed","enable_interleave"])if(body[key]!==undefined)parameters[key]=body[key];return{model,messages:[{role:"user",content}],parameters}},`,
  `normalize:payload=>{const data=[];const seen=new Set();const add=item=>{const key=JSON.stringify(item);if(!seen.has(key)){seen.add(key);data.push(item)}};const walk=value=>{if(typeof value==="string"){if(/^data:image\\//i.test(value)||/^https?:\\/\\//i.test(value))add({url:value});return}if(Array.isArray(value)){for(const item of value)walk(item);return}if(!value||typeof value!=="object")return;if(typeof value.b64_json==="string"&&value.b64_json)add({b64_json:value.b64_json});for(const key of ["url","image_url","image","data","output","choices","message","content","images"])walk(value[key])};walk(payload);return{created:Math.floor(Date.now()/1000),data}}`,
  `}`,
].join("");

const ANCHOR = `,"cloudflare-ai":p.A};function s(a){return t[a]||null}`;
const REPLACEMENT =
  `,"cloudflare-ai":p.A,${PROVIDER_ENTRY}};function s(a){return t[a]||null}/*${MARKER}*/`;

function buildPatched(original) {
  if (original.includes(MARKER)) return original;
  if (!original.includes(ANCHOR)) {
    throw new Error("9Router image provider map anchor not found; refusing an unsafe patch");
  }
  return original.replace(ANCHOR, REPLACEMENT);
}

function apply() {
  if (!fs.existsSync(ROUTE)) throw new Error(`Image route not found: ${ROUTE}`);
  const current = fs.readFileSync(ROUTE, "utf8");
  if (current.includes(MARKER)) return "already applied";
  atomicWrite(ROUTE, buildPatched(current));
  return "applied";
}

// Reverse the injection instead of restoring a saved copy: a backup taken from
// another 9Router build carries that build's webpack chunk ids and corrupts the
// route when restored over a different version.
function rollback() {
  const current = fs.readFileSync(ROUTE, "utf8");
  if (!current.includes(MARKER)) return "already clean";
  if (!current.includes(REPLACEMENT)) {
    throw new Error("patched image route does not match this patcher; refusing an unsafe rollback");
  }
  const restored = current.replace(REPLACEMENT, ANCHOR);
  if (restored.includes(MARKER)) throw new Error("rollback left patch residue");
  atomicWrite(ROUTE, restored);
  return "rolled back";
}

function check() {
  const current = fs.readFileSync(ROUTE, "utf8");
  const state = {
    route: ROUTE,
    providerId: PROVIDER_ID,
    marker: MARKER,
    applied: current.includes(MARKER),
    staleBackup: fs.existsSync(LEGACY_ORIGINAL) ? LEGACY_ORIGINAL : null,
  };
  console.log(JSON.stringify(state, null, 2));
  return state;
}

const command = process.argv[2] || "--check";
if (command === "--apply") console.log(apply());
else if (command === "--rollback") console.log(rollback());
else if (command === "--check") check();
else throw new Error("usage: --apply|--rollback|--check");
