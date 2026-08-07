# Alibaba Token Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar `qwen-cloud-token-plan` como provider oficial do overlay 9router-enhanced e exibir quota remota Alibaba no dashboard sem persistir secrets ou bloquear inferência.

**Architecture:** O patcher CommonJS injeta um parser/adapter Alibaba no bundle de usage, registra o provider canônico nos catálogos compilados cliente/servidor e altera o card de quota para renderizar status junto das linhas. O adapter recebe secrets exclusivamente do ambiente, usa cache curto e devolve estados `ok`, `stale` ou `unavailable`; o contrato de quota público mantém as linhas percentuais 5h/7d.

**Tech Stack:** Node.js CommonJS, bundles minificados Next.js 9Router 0.5.50, `proxyAwareFetch`, SQLite existente somente para conexões normais, testes Node com `node:assert/strict`, smoke test via serviço local/browser.

## Global Constraints

- Provider canônico: `qwen-cloud-token-plan`; alias: `qct`.
- Inferência usa `Authorization: Bearer <sk-sp-...>` e nunca reutiliza a API key como `sec_token`.
- Endpoint de inferência: `https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions`.
- Modelos iniciais: `qwen3.8-max-preview`, `qwen3.7-max`, `qwen3.7-plus`, `qwen3.6-flash`, `glm-5.2`, `deepseek-v4-pro`.
- Secrets remotos somente em `ALIBABA_TOKEN_PLAN_QUOTA_COOKIE` e `ALIBABA_TOKEN_PLAN_SEC_TOKEN`; não usar `providerSpecificData` para esses valores.
- O coletor não pode bloquear inferência, desativar conexão, rotacionar conta ou alterar roteamento.
- `ok` e `stale` não podem incluir `message` porque o card atual troca a lista de quotas por essa mensagem.
- `unavailable` nunca pode ser representado por `used: 0`.
- Cache fresco: 60 segundos; cache stale: no máximo 5 minutos após `fetchedAt`.
- O patcher deve continuar hash-pinned, rejeitar bundles desconhecidos e preservar rollback/sanitize seguro.
- Nenhum secret pode aparecer em SQLite, export, backup, `/api/providers`, URL, log ou mensagem de erro.
- Não adicionar dependências npm; manter os testes executáveis com `node`.

## File Map

- **Modify:** `patches/quota-tracker.patch.js` — parser, adapter, cache, dispatcher, provider catalog injection, UI injection, marker migration e exports de teste.
- **Create:** `tests/fixtures/alibaba-token-plan/usage.json` — payload de usage sanitizado e determinístico capturado do contrato real.
- **Create:** `tests/alibaba-token-plan.test.js` — testes unitários do parser, adapter, cache, estados e ausência de secrets.
- **Create:** `tests/quota-tracker-integration.test.js` — apply/check/rollback em cópia temporária dos bundles suportados.
- **Modify:** `systemd/9router.service` — carregar opcionalmente o arquivo de secrets externo com `EnvironmentFile`.
- **Modify:** `docs/operations.md` — documentar provider, configuração local dos secrets, estados do dashboard e comandos de verificação.

## Task 1: Freeze the private console response contract

**Files:**
- Create: `tests/fixtures/alibaba-token-plan/usage.json`

**Interfaces:**
- Produces the exact sanitized response shape consumed by `qtpParseAlibabaTokenPlan` in Task 2.
- Does not produce or store cookies, `sec_token`, bearer keys, account IDs, email addresses, or raw request headers.

- [ ] **Step 1: Capture the authenticated console request metadata locally**

  Use a local authenticated browser session for the Alibaba Model Studio console and inspect the Network requests triggered by the Token Plan quota view. Record only method, host, path, non-secret header names, request envelope shape, response status, and response JSON shape. Do not copy cookie values or tokens into the repository or conversation.

  The capture must establish which private requests provide the 5-hour window, 7-day window, and reset timestamps. Plan/expiry metadata is optional and is not part of the first-version acceptance contract. The implementation must not guess those paths from the inference endpoint.


- [ ] **Step 2: Create deterministic sanitized fixtures**

  Save the exact response structure with synthetic values that preserve types and field names. The fixture must represent two valid windows and reset timestamps in the real wire format. Replace identifiers with fixed values and remove every authentication field. Keep the fixture valid JSON and make the synthetic values deterministic so tests do not depend on the live console.

  Expected normalized values used by the later tests:

  ```text
  5-hour used percentage: 37
  7-day used percentage: 12
  5-hour reset: 2026-08-08T01:00:00.000Z
  7-day reset: 2026-08-13T00:00:00.000Z
  ```

- [ ] **Step 3: Verify the fixtures contain no secrets**

  Run:

  ```bash
  node -e 'for (const f of process.argv.slice(1)) { const s=require("fs").readFileSync(f,"utf8"); if (/cookie|sec[_-]?token|authorization|bearer|sk-sp-|email|accountId/i.test(s)) throw new Error(`secret-like field in ${f}`); JSON.parse(s); }' tests/fixtures/alibaba-token-plan/*.json
  ```

  Expected: no output and exit code 0.

- [ ] **Step 4: Commit the frozen contract**

  ```bash
  git add tests/fixtures/alibaba-token-plan
  git commit -m "test: freeze Alibaba Token Plan quota fixtures"
  ```

## Task 2: Implement and test the pure parser

**Files:**
- Modify: `patches/quota-tracker.patch.js` near `qtpNum`, `qtpReset`, and the other exported `qtpParse*` helpers.
- Create: `tests/alibaba-token-plan.test.js`.

**Interfaces:**
- Consumes: sanitized fixtures from Task 1.
- Produces: `qtpParseAlibabaTokenPlan(body, now = Date.now())`.
- Return type:

  ```text
  null | {
    plan: "Alibaba Token Plan",
    quotas: {
      "5 hour window (%)": { used, total: 100, remainingPercentage, resetAt },
      "7 day window (%)": { used, total: 100, remainingPercentage, resetAt }
    }
  }
  ```

- [ ] **Step 1: Write the failing parser tests**

  `tests/alibaba-token-plan.test.js` must load the patcher with `require`, load both fixtures, and assert the observable contract:

  ```js
  const assert = require("assert/strict");
  const fs = require("fs");
  const path = require("path");
  const {
    qtpParseAlibabaTokenPlan,
  } = require("../patches/quota-tracker.patch.js");

  const fixture = JSON.parse(fs.readFileSync(
    path.join(__dirname, "fixtures/alibaba-token-plan/usage.json"),
    "utf8",
  ));
  const parsed = qtpParseAlibabaTokenPlan(fixture);

  assert.equal(parsed.plan, "Alibaba Token Plan");
  assert.equal(parsed.quotas["5 hour window (%)"].used, 37);
  assert.equal(parsed.quotas["5 hour window (%)"].total, 100);
  assert.equal(parsed.quotas["5 hour window (%)"].remainingPercentage, 63);
  assert.equal(parsed.quotas["5 hour window (%)"].resetAt, "2026-08-08T01:00:00.000Z");
  assert.equal(parsed.quotas["7 day window (%)"].used, 12);
  assert.equal(parsed.quotas["7 day window (%)"].remainingPercentage, 88);
  assert.equal(parsed.quotas["7 day window (%)"].resetAt, "2026-08-13T00:00:00.000Z");
  assert.equal(qtpParseAlibabaTokenPlan({}), null);
  assert.equal(qtpParseAlibabaTokenPlan({ data: null }), null);
  ```

  Add a fixture case with a reset represented in the previous calendar year and assert that parsing uses the supplied timestamp rather than the host timezone.

- [ ] **Step 2: Run the parser test to verify it fails**

  Run:

  ```bash
  node tests/alibaba-token-plan.test.js
  ```

  Expected: FAIL because `qtpParseAlibabaTokenPlan` is not exported yet.

- [ ] **Step 3: Implement the minimal parser**

  Add a normal host-side function that is also serializable into the runtime through `runtimeFunctions()`:

  ```js
  function qtpParseAlibabaTokenPlan(body, now = Date.now()) {
    const source = body && typeof body === "object" ? body : null;
    const usage = qtpFindAlibabaUsage(source, now);
    if (!usage) return null;

    const fiveHour = qtpAlibabaWindow(usage.fiveHour, now);
    const sevenDay = qtpAlibabaWindow(usage.sevenDay, now);
    if (!fiveHour || !sevenDay) return null;

    return {
      plan: "Alibaba Token Plan",
      quotas: {
        "5 hour window (%)": fiveHour,
        "7 day window (%)": sevenDay,
      },
    };
  }
  ```

  `qtpFindAlibabaUsage` and `qtpAlibabaWindow` must use the exact field paths frozen in Task 1, accept numeric strings, clamp percentages to `[0, 100]`, normalize seconds/milliseconds/ISO through `qtpReset`, and return `null` on missing/invalid fields. Do not treat missing values as zero.

  Add the function to `runtimeFunctions()` and `module.exports`.

- [ ] **Step 4: Run the parser tests to verify they pass**

  ```bash
  node tests/alibaba-token-plan.test.js
  node tests/quota-tracker.test.js
  ```

  Expected: both commands print their existing success line and exit 0.

- [ ] **Step 5: Commit the parser**

  ```bash
  git add patches/quota-tracker.patch.js tests/alibaba-token-plan.test.js
  git commit -m "feat: parse Alibaba Token Plan quota windows"
  ```

## Task 3: Add the environment-only adapter, cache, and usage dispatcher

**Files:**
- Modify: `patches/quota-tracker.patch.js` in `injectedCode`, `runtimeFunctions`, `buildUsagePatched`, and the provider allowlist constants.
- Modify: `tests/alibaba-token-plan.test.js`.

**Interfaces:**
- Consumes: `qtpParseAlibabaTokenPlan` from Task 2 and a fetcher with `(url, init) => Promise<Response>`.
- Produces: `qtpFetchAlibabaTokenPlan(fetcher, cache, env, now = Date.now())`.
- Adapter result:

  ```text
  {
    plan: "Alibaba Token Plan",
    quotas: object,
    status: "ok" | "stale",
    source: "alibaba-console",
    fetchedAt: ISO string
  }
  ```

  or

  ```text
  {
    status: "unavailable",
    source: "alibaba-console",
    fetchedAt?: ISO string,
    reason: "session unavailable" | "authentication failed" | "quota unavailable"
  }
  ```

- [ ] **Step 1: Write failing adapter tests**

  Add a response helper and tests that prove behavior without a live network:

  ```js
  const response = (status, body) => ({
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; },
  });

  const env = {
    ALIBABA_TOKEN_PLAN_QUOTA_COOKIE: "fixture-cookie",
    ALIBABA_TOKEN_PLAN_SEC_TOKEN: "fixture-sec-token",
  };
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, init });
    return response(200, fixture);
  };
  ```

  Cover these assertions:

  - missing either environment secret returns `unavailable` without calling `fetcher`;
  - a normal response returns `status: "ok"`, `source: "alibaba-console"`, both windows, and no `message` property;
  - 401, 403, 429, timeout/rejected fetch, 5xx, empty JSON, and invalid schema return `unavailable` or a valid stale response without exposing the raw response body;
  - a failed fetch within five minutes of a successful `fetchedAt` returns `stale` with the original timestamp;
  - a failed fetch after five minutes returns `unavailable`;
  - a result serialized with `JSON.stringify` contains neither `fixture-cookie` nor `fixture-sec-token`.

- [ ] **Step 2: Run the adapter tests to verify they fail**

  ```bash
  node tests/alibaba-token-plan.test.js
  ```

  Expected: FAIL because the adapter is not exported yet.

- [ ] **Step 3: Implement the adapter and safe response mapping**

  Add the adapter around the exact private-console URLs and request envelope frozen in Task 1. Keep those URLs as constants; do not expose them as user-configurable inputs in this version. Use the following control flow:

  ```js
  async function qtpFetchAlibabaTokenPlan(fetcher, cache, env, now = Date.now()) {
    const cookie = String(env?.ALIBABA_TOKEN_PLAN_QUOTA_COOKIE || "").trim();
    const secToken = String(env?.ALIBABA_TOKEN_PLAN_SEC_TOKEN || "").trim();
    if (!cookie || !secToken) {
      return { status: "unavailable", source: "alibaba-console", reason: "session unavailable" };
    }

    const cached = cache.get("qwen-cloud-token-plan");
    if (cached && now - cached.fetchedAt < 60_000) return { ...cached.value, status: "ok" };

    try {
      const payload = await qtpFetchAlibabaPayload(fetcher, cookie, secToken);
      const parsed = qtpParseAlibabaTokenPlan(payload, now);
      if (!parsed) throw new Error("quota unavailable");
      const value = { ...parsed, status: "ok", source: "alibaba-console", fetchedAt: new Date(now).toISOString() };
      cache.set("qwen-cloud-token-plan", { value, fetchedAt: now });
      return value;
    } catch (error) {
      if (cached && now - cached.fetchedAt <= 300_000) {
        return { ...cached.value, status: "stale" };
      }
      return {
        status: "unavailable",
        source: "alibaba-console",
        reason: qtpSafeAlibabaReason(error),
      };
    }
  }
  ```

  `qtpFetchAlibabaPayload` must send the cookie and sec token only in request headers required by the captured contract, use `AbortSignal.timeout(8_000)`, and never include either value in thrown errors. `qtpSafeAlibabaReason` may return only `session unavailable`, `authentication failed`, or `quota unavailable`.

  Convert the adapter result into the existing response shape. For `ok` and `stale`, include `status`, `source`, and `fetchedAt` but omit `message`; for `unavailable`, include only a safe message such as `Console Alibaba: quota oficial indisponível — sessão ausente ou expirada.` and an empty `quotas` object.

  Inject the runtime wrapper through the existing `proxyAwareFetch` seam:

  ```js
  async function qtpAlibaba(a) {
    return qtpFetchAlibabaTokenPlan(
      (url, init) => d.proxyAwareFetch(url, init, a.proxyOptions),
      qtpAlibabaCache,
      process.env,
      Date.now(),
    );
  }
  ```

  Add `qwen-cloud-token-plan:a=>qtpAlibaba(a)` to `qtpProviders`, add the canonical ID to both usage allowlists, and preserve the existing provider dispatch entries unchanged.

- [ ] **Step 4: Run all unit tests**

  ```bash
  node tests/alibaba-token-plan.test.js
  node tests/quota-tracker.test.js
  ```

  Expected: both exit 0; no secret-like value appears in output.

- [ ] **Step 5: Commit the adapter**

  ```bash
  git add patches/quota-tracker.patch.js tests/alibaba-token-plan.test.js
  git commit -m "feat: fetch Alibaba Token Plan quota from console session"
  ```

## Task 4: Register the official provider in compiled catalogs

**Files:**
- Modify: `patches/quota-tracker.patch.js` in catalog markers, `buildPatched`, `buildProvidersPatched`, and catalog-specific builders.
- Modify: `tests/quota-tracker-integration.test.js`.
- Existing bundle targets: `chunks/615.js` and the selected `../static/chunks/1321-*.js` for each supported catalog variant.

**Interfaces:**
- Consumes: canonical provider entry from OmniRoute and runtime dispatcher from Task 3.
- Produces: server/client catalog entries that resolve the same ID, alias, transport, auth, and model list.

- [ ] **Step 1: Write catalog transformation tests**

  Add a fixture-level test that runs the catalog builder against each supported original variant and asserts exactly one occurrence of `qwen-cloud-token-plan`, alias `qct`, the Singapore endpoint, and all six model IDs in both the server and client catalog output. Assert a second application is idempotent and returns the same bytes.

  Also seed a temporary bundle with the legacy `QuotaTrackerPatch:v2` marker and an expected original hash; assert the new migration path restores the saved original before applying the new marker.

- [ ] **Step 2: Run the catalog tests to verify they fail**

  ```bash
  node tests/quota-tracker-integration.test.js
  ```

  Expected: FAIL because no catalog builder or migration marker exists.

- [ ] **Step 3: Implement the catalog entry**

  Use this single canonical data shape in both builders, adapting only the surrounding minified catalog syntax:

  ```js
  {
    id: "qwen-cloud-token-plan",
    alias: "qct",
    display: {
      name: "Qwen Cloud Token Plan",
      icon: "cloud",
      color: "#FF6A00",
      textIcon: "QCT",
      website: "https://www.alibabacloud.com/help/en/model-studio/token-plan-overview",
    },
    category: "apikey",
    transport: {
      format: "openai",
      baseUrl: "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions",
      auth: { combined: true, header: "Authorization", scheme: "bearer" },
    },
    models: [
      { id: "qwen3.8-max-preview", name: "Qwen3.8 Max Preview", supportsReasoning: true, supportsVision: true, toolCalling: true, contextLength: 1000000, maxOutputTokens: 65536 },
      { id: "qwen3.7-max", name: "Qwen3.7 Max", supportsReasoning: true, toolCalling: true, contextLength: 1000000, maxOutputTokens: 65536 },
      { id: "qwen3.7-plus", name: "Qwen3.7 Plus", supportsReasoning: true, supportsVision: true, toolCalling: true, contextLength: 1000000, maxOutputTokens: 65536 },
      { id: "qwen3.6-flash", name: "Qwen3.6 Flash", supportsReasoning: true, supportsVision: true, toolCalling: true, contextLength: 1000000, maxOutputTokens: 32768 },
      { id: "glm-5.2", name: "GLM 5.2", supportsReasoning: true, toolCalling: true, contextLength: 1000000, maxOutputTokens: 16384 },
      { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", supportsReasoning: true, toolCalling: true, contextLength: 163840, maxOutputTokens: 32768 },
    ],
    features: { usage: true, usageApikey: true },
  }
  ```

  For `chunks/615.js`, inject the entry into the shared provider array immediately after `var d=c(44963);` with a duplicate guard before `AI_PROVIDERS` is derived. For the client `1321-*.js` chunk, append to the existing provider array anchored by `id:"alicode-intl"`; assert exactly one insertion and preserve the original array delimiters.

  Route `chunks/615.js` and every selected `1321-*.js` through `buildProviderCatalogPatched` before the generic usage-allowlist builder. Add `PROVIDER_CATALOG_MARKER = "/* QuotaTrackerAlibabaProvider:v1 */"` and make apply, rollback, sanitize, and idempotence recognize it.

  Export `buildProviderCatalogPatched` and `buildUiPatched` only for deterministic integration tests; keep the runtime adapter and catalog data private to the generated bundle.

- [ ] **Step 4: Add safe migration from the previous patch marker**

  Before applying the new builder, if all affected files contain a recognized legacy marker (`QuotaTrackerPatch:v2`, `QuotaTrackerProviders:v2`, or `QuotaTrackerCurrency:v2`) and their saved originals match the expected hash, restore those originals and re-run `apply`. Refuse partial or hash-mismatched residue. Do not restore arbitrary files without the saved-original hash check.

- [ ] **Step 5: Run catalog and existing tests**

  ```bash
  node tests/quota-tracker-integration.test.js
  node tests/alibaba-token-plan.test.js
  node tests/quota-tracker.test.js
  ```

  Expected: all exit 0; catalog outputs contain one canonical provider and reapplication is byte-identical.

- [ ] **Step 6: Commit the catalog**

  ```bash
  git add patches/quota-tracker.patch.js tests/quota-tracker-integration.test.js
  git commit -m "feat: register Alibaba Token Plan provider catalog"
  ```

## Task 5: Patch the quota card to show status beside rows

**Files:**
- Modify: `patches/quota-tracker.patch.js` in `buildUiPatched`, UI markers, and `UI_RELATIVES` handling.
- Modify: `tests/quota-tracker-integration.test.js` for generated UI markers.

**Interfaces:**
- Consumes: response metadata `{ status, source, fetchedAt }` from Task 3.
- Produces: a card where `ok` and `stale` retain the quota list and add a compact status line; `unavailable` retains the existing message-only branch.

- [ ] **Step 1: Write the failing UI transformation assertion**

  Add a fixture test using each supported dashboard page bundle. After `buildUiPatched`, assert that the generated card contains:

  ```text
  QuotaTrackerAlibabaStatus:v1
  i.raw?.source
  i.raw?.status
  i.raw?.fetchedAt
  ```

  Assert that the original `i?.message ? message : quota-list` branch is replaced exactly once and the quota-list renderer remains in the non-message branch.

- [ ] **Step 2: Run the UI assertion to verify it fails**

  ```bash
  node tests/quota-tracker-integration.test.js
  ```

  Expected: FAIL because the card currently chooses the message branch instead of rendering status plus quotas.

- [ ] **Step 3: Implement the minimal UI patch**

  Preserve the current message behavior for errors and replace only the quota branch with the equivalent minified structure:

  ```js
  i?.message
    ? errorMessage(i.message)
    : jsxs("div", {
        children: [
          i?.raw?.source
            ? jsx("p", {
                className: "text-[10px] text-text-muted mb-1",
                children: `${i.raw.source} · ${i.raw.status || "ok"} · ${i.raw.fetchedAt || ""}`,
              })
            : null,
          jsx(QuotaList, { quotas: D, compact: true, ... }),
        ],
      })
  ```

  Use the bundle’s existing aliases (`d.jsx`, `d.jsxs`, `r`) and retain existing loading/error/hidden-quota behavior. Add `UI_STATUS_MARKER` and make reapplication, rollback, and sanitize verify it. Do not put any cookie, sec token, API key, or raw server error in the status line.

- [ ] **Step 4: Run generated-bundle tests**

  ```bash
  node tests/quota-tracker-integration.test.js
  ```

  Expected: all supported dashboard variants contain the status marker and retain the quota renderer.

- [ ] **Step 5: Commit the card patch**

  ```bash
  git add patches/quota-tracker.patch.js tests/quota-tracker-integration.test.js
  git commit -m "feat: show Alibaba quota status beside dashboard rows"
  ```

## Task 6: Wire service secrets and operational documentation

**Files:**
- Modify: `systemd/9router.service`.
- Modify: `docs/operations.md`.

**Interfaces:**
- Consumes: two externally managed environment variables.
- Produces: a user service that can load `~/.9router/token-plan.env` without storing it in the repository or SQLite.

- [ ] **Step 1: Write the operational verification first**

  Add an assertion to `tests/quota-tracker-integration.test.js` that reads `systemd/9router.service` and verifies exactly one `EnvironmentFile=-%h/.9router/token-plan.env` directive and no literal secret names with values. This keeps the service wiring check deterministic.

- [ ] **Step 2: Add the optional systemd environment file**

  Add this line under `[Service]`:

  ```ini
  EnvironmentFile=-%h/.9router/token-plan.env
  ```

  The leading `-` keeps the service valid when the file is absent. Do not add actual values or a tracked env file.

- [ ] **Step 3: Document local secret setup**

  Add to `docs/operations.md`:

  ```bash
  install -d -m 700 ~/.9router
  umask 077
  cat > ~/.9router/token-plan.env <<'EOF'
  ALIBABA_TOKEN_PLAN_QUOTA_COOKIE=
  ALIBABA_TOKEN_PLAN_SEC_TOKEN=
  EOF
  chmod 600 ~/.9router/token-plan.env
  systemctl --user daemon-reload
  systemctl --user restart 9router.service
  ```

  Explain that the values must be copied locally from the authenticated Alibaba console, never sent in chat, and that the dashboard reports `unavailable` when either value is empty or expired. Document that the quota source is an internal console endpoint, not a public balance API.

  Add Alibaba Token Plan to the provider list and add commands for `--check`, `--apply`, `--rollback`, `--sanitize`, `node tests/alibaba-token-plan.test.js`, and `node tests/quota-tracker-integration.test.js`.

- [ ] **Step 4: Verify shell/service documentation**

  ```bash
  node tests/quota-tracker-integration.test.js
  systemd-analyze --user verify systemd/9router.service
  ```

  Expected: integration test passes and `systemd-analyze` reports no unit errors. If the host lacks `systemd-analyze --user`, run `systemd-analyze verify systemd/9router.service` and record that limitation rather than skipping the syntax check.

- [ ] **Step 5: Commit operational wiring**

  ```bash
  git add systemd/9router.service docs/operations.md
  git commit -m "docs: configure Alibaba Token Plan quota secrets"
  ```

## Task 7: Execute end-to-end patch and UI smoke checks

**Files:**
- Modify only if a preceding task exposes a concrete failure: `patches/quota-tracker.patch.js`, tests, or operations docs.

**Interfaces:**
- Consumes: all previous task outputs.
- Produces: evidence that patch apply/check/rollback, provider discovery, quota status rendering, and fail-open inference work together.

- [ ] **Step 1: Run deterministic test commands**

  ```bash
  node tests/alibaba-token-plan.test.js
  node tests/quota-tracker.test.js
  node tests/quota-tracker-integration.test.js
  ```

  Expected: all exit 0 and no output contains a fixture secret.

- [ ] **Step 2: Run patcher lifecycle in a temporary package copy**

  The integration test must exercise these commands against a temporary copy, not the active service package:

  ```bash
  node patches/quota-tracker.patch.js --check
  node patches/quota-tracker.patch.js --apply
  node patches/quota-tracker.patch.js --check
  node patches/quota-tracker.patch.js --rollback
  node patches/quota-tracker.patch.js --check
  ```

  Expected: initial state is clean, apply reports `applied`, second check reports every catalog target patched and `usagePatched: true`, rollback reports `rolled back`, and final check reports clean state. Unknown hashes must fail before any file is changed.

- [ ] **Step 3: Verify provider discovery and inference fail-open**

  With the patched temporary service and no Alibaba quota secrets, create/select a Token Plan connection using a non-secret fixture API key, call `/api/usage/<connectionId>`, and assert a JSON response with `status: "unavailable"`, a safe message, and no secret fields. Send one normal inference request to the provider and assert that the request reaches the provider path independently of the quota result.

- [ ] **Step 4: Smoke-test the actual card for `ok` and `stale`**

  Open the quota dashboard in a local browser. Intercept the connection’s `/api/usage/<connectionId>` response with these two sanitized JSON payloads in sequence:

  ```json
  {
    "plan": "Alibaba Token Plan",
    "status": "ok",
    "source": "alibaba-console",
    "fetchedAt": "2026-08-07T12:00:00.000Z",
    "quotas": {
      "5 hour window (%)": { "used": 37, "total": 100, "remainingPercentage": 63, "resetAt": "2026-08-08T01:00:00.000Z" },
      "7 day window (%)": { "used": 12, "total": 100, "remainingPercentage": 88, "resetAt": "2026-08-13T00:00:00.000Z" }
    }
  }
  ```

  Repeat with only `status: "stale"` and an older `fetchedAt`. Assert visually/through the accessibility tree that both quota rows remain visible in both states and that the source/status/timestamp line is visible above them. Then return `status: "unavailable"` with a safe `message` and assert the message is visible without fabricated quota rows.

- [ ] **Step 5: Run the final smoke command and record evidence**

  ```bash
  curl -fsS http://127.0.0.1:20128/api/health
  node patches/quota-tracker.patch.js --check
  ```

  Expected: health returns successfully; check reports the selected supported variant and all expected markers. Do not claim a live Alibaba quota read unless the local secrets were configured and the console response returned successfully.

- [ ] **Step 6: Commit only concrete fixes**

  ```bash
  git add patches tests systemd/9router.service docs/operations.md
  git commit -m "test: verify Alibaba Token Plan quota integration"
  ```

## Plan self-review

- **Spec coverage:** provider identity/models/endpoint: Task 4; private response contract: Task 1; parser and percent windows: Task 2; env-only secrets/cache/error states: Task 3 and Task 6; UI status coexistence: Task 5 and Task 7; fail-open inference: Task 3 and Task 7; hash-pinned lifecycle/migration: Task 4 and Task 7; operations: Task 6; deterministic and browser smoke tests: Tasks 2, 3, 5, and 7.
- **Placeholder scan:** no `TBD`, `TODO`, or unspecified “appropriate handling” step remains. The private endpoint paths are intentionally obtained and frozen in Task 1 because they are not present in the repository and are not the public inference endpoint.
- **Type consistency:** `qtpParseAlibabaTokenPlan` feeds `qtpFetchAlibabaTokenPlan`; the adapter feeds `qtpProviders`; the dispatcher returns `status/source/fetchedAt/message?`; the UI reads those fields from the existing raw response object.
- **Scope:** all work remains inside the existing patch overlay, tests, service environment loading, and operations documentation. Quota enforcement and multi-account encryption remain explicitly outside this plan.
