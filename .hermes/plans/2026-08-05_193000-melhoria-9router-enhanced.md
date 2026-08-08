# Plano de Melhoria — 9router-enhanced

**Data:** 2026-08-05
**Versão base:** 9router 0.5.50 (enhanced) · serviço ativo, patched, health OK
**Escopo:** melhorar o overlay `9router-enhanced` (repo privado) **sem tocar o serviço em produção** — mudanças viram patches/commits revisáveis; aplicação no serviço só após validação explícita.

> **Nota (2026-08-05):** A P0 original (destravar compressão RTK/Caveman) foi **descartada por decisão do usuário** — ele não quer a compressão ligada. O restante das frentes (P1, P2, P3) permanece válido.

---

## Objetivo

Transformar o overlay `9router-enhanced` (que hoje tem 3 patches: quota tracker, antigravity tool-loop breaker, CORS preflight) para:
1. ~~Destravar recursos nativos desligados (RTK/Caveman)~~ — **descartado pelo usuário**
2. **Integrar o quota tracker ao roteamento** (quota-aware routing) — usar os saldos que já coletamos para decidir para onde vai cada pedido.
3. **Reduzir custo de manutenção do overlay** — simplificar o update-guard, testar mais, documentar.

## Contexto / Estado atual (verificado)

- Serviço: `9router.service` ativo e enabled, porta 20128, `/api/health` OK, `/api/version` = 0.5.50 (sem update).
- Overlay patches aplicados: quota-tracker (20/20 bundles), cors-preflight (applied), antigravity tool-loop breaker (compilado no tarball enhanced).
- Testes: `quota-tracker.test.js` ok, `cors-preflight.test.js` ok.
- **API key necessária para chat** (novo em 0.5.50): `/v1/chat/completions` exige `Authorization` mesmo em localhost. Key ativa em `~/.9router/db/data.sqlite` (tabela `apiKeys`, `isActive=1`). Models/health/version abertos.
- Recursos nativos presentes mas desligados no settings (`rtkEnabled=0`, `cavemanEnabled=0`, `comboStrategy=round-robin`) — **decisão do usuário: manter desligados**.
- Combo exemplo: `KIMIk3 = ["tkr/moonshotai/kimi-k3-free", "clinepass/cline-pass/kimi-k3", "tkr/moonshotai/kimi-k3"]` (fallback real funciona).
- Modelos validados via 9router (com API key): `cx/gpt-5.6-luna` (Codex Luna) OK, `KIMIk3`/`clinepass/cline-pass/kimi-k3` (Kimi K3) OK.
- OMP (Oh My Pi) v17.2.9 conecta ao 9router via plugin `pi-9router-ext` (provider `9router/`, usa API key do 9router para chat).
- Codex CLI roteado pelo 9router via provider custom (`-c 'model_providers.9router...'`) com `cx/gpt-5.6-luna` — funcionou (executor validado).

## Proposta de melhorias (priorizadas)

### P1 — Integrar quota tracker ao roteamento (quota-aware routing)
- **O que:** o quota tracker já coleta saldos de 6 providers (OpenRouter, DeepSeek, CommandCode, xAI/Grok, Xiaomi MiMo, ClinePass). Ligar isso às estratégias de combo `headroom` / `reset-window` / `fill-first` que o 9router 0.5.50 já oferece.
- **Por que:** evita esgotar um provedor enquanto outro tem saldo sobrando; maximiza o uso dos free tiers.
- **Entregável:** script/patch que, dado o saldo coletado, seleciona a estratégia de combo adequada (ou expõe o saldo ao motor de combo). Documentar o mapping provider→estratégia.
- **Risco:** nem todos os providers têm API de saldo em tempo real; usar fallback com o tracking atual.

### P2 — Reduzir custo de manutenção do overlay / update-guard
- **O que:** o quota tracker é hash-pinned por versão (20 bundles; catálogos para oficial/enhanced × 0.5.35/0.5.40/0.5.45/0.5.50). Verificar se dá para reduzir o acoplamento (ex.: usar webhooks/API nativa do 9router se existir, ou tornar o pinning mais tolerante).
- **Por que:** cada bump de versão exige re-portar e re-testar. Reduzir superfície facilita upgrades.
- **Entregável:** análise + refactor do update-guard no start-9router.sh; manter segurança (backup/rollback/quarantine intactos).

### P3 — Testes e documentação
- **O que:** aumentar cobertura de testes (settings/estratégias, roteamento), documentar o estado atual e os comandos de validação.
- **Entregável:** testes novos + atualização do README e docs.

## Validação

- Serviço continua `active` e health OK após mudanças de config.
- `/v1/chat/completions` com `cx/gpt-5.6-luna` e `KIMIk3` responde (com API key).
- Testes do overlay passam (`quota-tracker.test.js`, `cors-preflight.test.js`).
- Estratégia de combo alterada respeita fallback (combo KIMIk3 continua caindo para o próximo provider em 429).

## Riscos / Tradeoffs / Questões abertas

- **Não tocar produção:** todas as mudanças no repo; aplicação no serviço só após aprovação explícita.
- **API key obrigatória:** documentar que o OMP/Codex agora precisam da key do 9router (mudança de comportamento do 0.5.50).
- **Questão aberta:** o headroom proxy (8787) está ativo mas o `headroomUrl` aponta para ele sem integração de roteamento — confirmar se é seguro habilitar a estratégia `headroom` sem o adaptador configurado.

## Permissões / aprovações necessárias

- [ ] Aplicar mudanças de código no repo `9router-enhanced` (commits revisáveis) — **sem** tocar o serviço em produção.
- [ ] Após validação local, aprovar explicitamente a aplicação das mudanças de config no serviço ativo.