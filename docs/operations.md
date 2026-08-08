# 9Router Quota Tracker Patch

This is modification 1 of 3 in this overlay — see the top-level
[`README.md`](../README.md) for the full list (quota tracker, Antigravity
tool-loop breaker, CORS preflight fix).

For the separately built Antigravity tool-loop circuit breaker, see
[`tool-loop-breaker.md`](tool-loop-breaker.md). For the CORS preflight fix,
see [`cors-preflight.md`](cors-preflight.md). The quota overlay is hash-pinned
to the official 0.5.50 build and official/enhanced builds for 0.5.35, 0.5.40,
and 0.5.45 (fingerprint selection). Other source builds fail cleanly when
their chunk hashes differ.

Local compatibility patch tested with 9Router `0.5.50`; existing 0.5.35–0.5.45
catalogs remain supported.

## Providers

- OpenRouter credits and usage in USD.
- DeepSeek available, promotional, and topped-up balances.
- CommandCode monthly balance plus 5-hour and 7-day windows.
- xAI/Grok subscription quota and prepaid balance.
- Xiaomi MiMo paid and granted balances through a console session cookie.
- ClinePass 5-hour, 7-day, and 30-day quota windows.
- Alibaba Token Plan 5-hour and 7-day quota windows.
## Commands

```bash
node ~/.9router/quota-tracker.patch.js --check
node ~/.9router/quota-tracker.patch.js --apply
node ~/.9router/quota-tracker.patch.js --rollback
node ~/.9router/quota-tracker.patch.js --sanitize
node ~/.9router/quota-tracker.test.js
node tests/alibaba-token-plan.test.js
node tests/quota-tracker-integration.test.js
```

## Update guard

The user service launcher at
`~/.hermes/profiles/zen/scripts/start-9router.sh` performs these steps:

1. Detects a 9Router version change and backs up the database, patch files,
   launcher, and installed package metadata.
2. Applies the patch only when all known bundles are byte-compatible.
3. Removes exact, known patch residue after an incompatible or partial update.
4. Starts unpatched upstream 9Router when the new build is incompatible.
5. Waits for `/api/health`; on failure with an active patch, rolls it back and
   quarantines that 9Router version before starting upstream clean.

Startup state is recorded in `~/.9router/quota-tracker-startup.status`. The
quarantine is automatically cleared when a different 9Router version appears.
Version-change backups are stored below `~/.9router/db/backups/pre-update-*`.
## Cache-Safe Deployment

Static Next.js chunks patched in-place by `quota-tracker.patch.js` maintain their original
content-hashed filenames (for example `/_next/static/chunks/1321-54939b699b5f3d07.js`). Upstream
Next.js serves `/_next/static/` with `Cache-Control: public, max-age=31536000, immutable`, which
causes existing browser sessions to cache old bundle chunks indefinitely across service updates.

The `cors-preflight.patch.js` server wrapper reads the target static paths from `quota-tracker.patch.js`
at apply time and overrides `Cache-Control` to `public, max-age=0, must-revalidate` for overlay-modified
chunks. This ensures normal page reloads revalidate updated chunks via HTTP 304/200 while preserving
`immutable` caching for unmodified static assets.

Original bundles used for rollback are stored under
`~/.9router/quota-tracker-originals/<variant>/` (for example
`enhanced-0.5.45/`, `official-0.5.45/`, `enhanced-0.5.40/`).

The pre-update snapshot from 0.5.40, including the database, complete installed
package, patch files, launcher, checksums, and Git bundle, is stored below
`~/.9router/db/backups/pre-npm-update-0.5.40-to-0.5.45-*`. Earlier 0.5.35→0.5.40
snapshots remain under `pre-npm-update-0.5.35-to-0.5.40-*`.

The pre-fix operational backup, including the SQLite database, systemd unit,
startup script, bundles, patchers, and checksums, is stored in
`~/.9router/backups/quota-tracker-v2-20260711-225500/`.

## Grok

The Grok collector uses the xAI OAuth connection already stored by 9Router. If
that session and its refresh token have expired, reconnect xAI in the Providers
screen. A normal xAI OAuth token is not a Management API key and is never sent
to the xAI Management API by this patch. When the billing response provides
`creditUsagePercent` and a weekly period but no absolute allotment, the tracker
shows a 100-point percentage bar with the provider's period end as its reset
time. It does not estimate or invent a credit total.

## Alibaba Token Plan (qwen-cloud-token-plan)

O coletor do Alibaba Token Plan utiliza um **medidor local de janela deslizante (5h / 7d)** calculado a partir do histórico de uso (`usageHistory`) do próprio 9Router.

- **Como funciona**: A cada consulta, o 9Router soma os tokens de entrada e saída (prompt + completion) registrados para o provider `qwen-cloud-token-plan` e/ou conexão nas janelas de **5 horas** e **7 dias** ancoradas em `Date.now()`.
- **Origem dos dados (`source`)**: Identificado no dashboard como `router-local`.
- **O que NÃO é**: **Não** reflete os "Credits" ou quotas oficiais do console da Alibaba Cloud (para os quais não existe API pública/oficial de consulta). Trata-se exclusivamente do consumo medido localmente pelo roteador.
- **Sem credenciais de console**: Não exige cookies, `sec_token` ou variáveis de ambiente externas (`ALIBABA_TOKEN_PLAN_*`). Funciona 100% de forma local e durável.
- **Limites opcionais**: Por padrão, o consumo é exibido de forma absoluta (ex.: `1.500 / ∞`). Se desejar exibir percentuais e saldo restante, configure os limites em tokens `limit5h` e `limit7d` (ou `quotaLimit5h`, `quotaLimit7d`) no campo `providerSpecificData` da conexão.
