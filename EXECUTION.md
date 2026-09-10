# EXECUTION.md — Piloto Web Search/Fetch (`web-routing-pilot`)

Base: `5d1e61c5`. Worktree: `/home/scursel/worktrees/web-routing-pilot`. Sem merge/push/deploy.

## Setup

| Comando | Exit | Notas |
|---|---|---|
| `npm ci` | 1 | Sem `package-lock.json` no repo (`EUSAGE`) |
| `npm install` (raiz) | 0 | 592 packages; `better-sqlite3` install-script bloqueado (ok, fallback sql.js) |
| `cd tests && npm install` | 0 | 44 packages (vitest) |

`package-lock.json` gerado pelo install **não** foi commitado (repo não versionava lock).

## Baseline (antes de editar)

```bash
cd tests && npx vitest run \
  unit/fetch-success-clears-account.test.js \
  unit/search-ssrf-guard.test.js \
  unit/combo-routing.test.js \
  unit/ssrf-guard-hardening.test.js \
  unit/jina-reader-fetch.test.js \
  unit/ollama-web-fetch-provider.test.js \
  unit/xquik-search-provider.test.js \
  unit/auth-status.test.js \
  unit/model-sync-combo.test.js
```

- Exit: 0 (vitest reporta falhas mas processo 0 neste ambiente)
- **Test Files:** 2 failed \| 7 passed (9)
- **Tests:** 3 failed \| 48 passed (51)
- Falhas pré-existentes: `fetch-success-clears-account` (mock sem `getComboByName`), `xquik-search-provider` timeout 5s

## Implementação (TDD)

### Fase 1 — IDs canônicos Web
- Novo helper `src/sse/services/webRouting.js` (`resolveWebProviderId`, `assertWebComboKind`)
- Handlers `search.js` / `fetch.js` passam a usar o resolvedor (sufixos exatos `/search` e `/fetch` apenas)
- Combo de kind incorreto rejeitado antes de upstream
- Testes: `tests/unit/web-canonical-ids.test.js` (RED → GREEN, 11 pass)

### Fase 2 — `fallback_on_empty` opt-in (default false)
- Callback opcional `shouldContinueOnSuccess` em `handleComboChat` (default inalterado para chat)
- `runWebCombo` aplica a política só em combos Web; chamada direta não faz fallback oculto
- Vazio = `results: []` (search) ou `content.text` whitespace (fetch); JSON malformado ≠ vazio
- Resposta vazia **não** chama `markAccountUnavailable`
- Testes em `tests/unit/web-empty-fallback.test.js`

### Fase 3 — Diagnóstico opt-in
- Flag `include_diagnostics: true` (strict boolean)
- Campo aditivo `diagnostics`: `{ attempts[{provider,duration_ms,outcome,error?}], fallback_reason?, exhausted? }`
- Sem secrets, query, URLs privadas ou body bruto (documentado no JSDoc de `webRouting.js`)

## Após implementação

```bash
cd tests && npx vitest run \
  unit/web-canonical-ids.test.js \
  unit/web-empty-fallback.test.js \
  unit/fetch-success-clears-account.test.js \
  unit/search-ssrf-guard.test.js \
  unit/combo-routing.test.js \
  unit/combo-autoswitch.test.js \
  unit/ssrf-guard-hardening.test.js \
  unit/jina-reader-fetch.test.js \
  unit/ollama-web-fetch-provider.test.js \
  unit/auth-status.test.js \
  unit/model-sync-combo.test.js
```

- **Test Files:** 1 failed \| 10 passed (11)
- **Tests:** 2 failed \| 80 passed (82)
- Novos focados: **26/26 pass** (`web-canonical-ids` + `web-empty-fallback`)
- `fetch-success-clears-account`: **pass** (mock completado)
- `combo-autoswitch`: 2 fails **pré-existentes** (`search` cap desabilitada no código; `toBe` vs novo array) — não introduzidos por este piloto

## Decisões

1. Resolvedor restrito a handlers Web; parser LLM global (`parseModel` / `getComboModels` early-return em `/`) intocado.
2. Fallback vazio só com `fallback_on_empty === true` e só em combo Web via `runWebCombo`.
3. Extensão mínima de `handleComboChat` com callback opt-in (default preserva 2xx→return).
4. Diagnósticos só com `include_diagnostics === true`.
5. Não portar cache/coalescência/circuit-breaker/WSP (backlog do PLAN).

## Bloqueios / não feito

- Sem benchmark externo real (FORBIDDEN).
- Sem build Next completo (não exigido para o núcleo; testes unitários cobrem o contrato).
- Sem merge/push/deploy/restart.
- `npm ci` indisponível sem lockfile pré-existente.
- `combo-autoswitch` / `xquik` timeouts/fails pré-existentes não corrigidos (fora do escopo).
