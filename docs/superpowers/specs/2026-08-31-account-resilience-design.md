# Desenho: disjuntor e porteiro por conta

**Data:** 2026-08-31
**Branch:** `enhanced/0.5.59`
**Status:** aprovado na sessão de desenho
**Origem:** port seletivo de [Vanszs/VansRouter](https://github.com/Vanszs/VansRouter) (`open-sse/utils/circuitBreaker.js`, `open-sse/services/accountSemaphore.js`), **sem** proxy-fitness do MIBP e **sem** cache de settings.

## Objetivo

Quando uma conta começa a falhar de verdade (5xx / timeout), o Enhanced deixa de bater nela e passa para **outra conta do mesmo provedor**. No máximo **3 pedidos simultâneos** por conta (padrão). O painel mostra o estado e permite liberar a conta na hora.

O cliente (Claude Code, Cursor, etc.) não deve perceber a troca se existir outra conta saudável.

## Não-objetivos

- Fitness / rotação de proxy (MIBP). Sem túnel na chave.
- Cache de settings/connections do VansRouter.
- Persistir o disjuntor no SQLite. Restart zera.
- Página nova no dashboard.
- Mudar o breaker de loop de ferramenta do Antigravity.
- Mudar o coletor de quota.
- Form novo para `maxConcurrency` (lê `providerSpecificData.maxConcurrency` se existir).
- Semaphore nos handlers de TTS/STT/imagem/vídeo nesta versão (só chat). A **escolha** de conta já pula contas OPEN em todos os handlers que passam por `getProviderCredentials`, via predicado **puro** (`isBlocked`). Só o `handleChat` chama `canExecute` (sonda HALF_OPEN) e `recordSuccess`/`recordFailure`.

## Peças

### Disjuntor (`circuitBreaker`) — um por conta

Nome: `provider:connectionId` (ex. `glm:abc123`).

Estados: `CLOSED` → `DEGRADED` → `OPEN` → `HALF_OPEN` → `CLOSED`.

| Evento | Efeito |
|---|---|
| 408 / 500 / 502 / 503 / 504 / timeout | conta como falha |
| 429, cota esgotada, 401 | **não** conta |
| 5 falhas (threshold), com dedup 5s por conta | `OPEN` |
| `OPEN` | `getProviderCredentials` **pula** essa conta (`isBlocked`, sem consumir sonda) |
| ~30s depois | `HALF_OPEN` só quando o **chat** chama `canExecute` e vai de fato tentar a conta |
| Sobreposição com `markAccountUnavailable` | um 5xx já model-lock ~30s (`TRANSIENT_COOLDOWN_MS`). O disjuntor acumula falhas **entre modelos e depois do lock**; não é fallback mais rápido no primeiro erro |
| Restart do processo | registry vazio = tudo `CLOSED` |
| Reset no painel | essa conta volta a `CLOSED` |

`DEGRADED` ainda deixa passar; só aparece no painel.

Se **todas** as contas ativas daquele provedor estão `OPEN` (ou 429/`rateLimitedUntil` / model lock já existentes), o pedido cai no combo (próximo provedor). A resposta desse caso **força status 503** (não reutiliza `lastErrorCode` 401/403, que aborta o combo). Combo já trata 503 como fallback (`open-sse/services/combo.js`). Sem combo: **503** com `Retry-After` = menor tempo restante entre as contas.

### Porteiro (`accountSemaphore`) — um por conta

Chave: `provider:connectionId`.

- Padrão `maxConcurrency = 3`.
- `providerSpecificData.maxConcurrency === 0` ou `null` desliga o porteiro **nessa conta**.
- Fila até 20; timeout de espera **2s** (não 30s). Estouro → essa conta é excluída do loop e tenta a próxima, sem bloquear o cliente minutos.
- O slot conta o pedido **até o stream acabar** (ou o JSON não-stream retornar). Soltar no `handleChatCore` return libera cedo demais: o SSE ainda está aberto.
- 429 continua no `rateLimitedUntil` / `markAccountUnavailable` que já existe. Não abre o disjuntor.
- Restart zera a fila.

### Painel

Sem rota nova.

- Lista de provedores (`dashboard/providers/page.js`): selo só se alguma conta não estiver `CLOSED`, texto tipo `1 conta pausada`. Sem selo verde.
- Detalhe (`ConnectionRow`): selo em inglês como o resto do dashboard (`Degraded` / `Circuit Open` / `Recovering`) + botão de reset **só daquela conta** quando `OPEN`. Poll da API só enquanto houver estado ≠ `CLOSED`, não a cada 5s o tempo todo.

API:

- `GET /api/providers/circuit-breakers` → lista `{ name, state, failureCount, retryAfterMs, ... }`
- `POST /api/providers/circuit-breakers/[name]/reset` → reset daquela chave

## Fluxo no pedido de chat

```
getProviderCredentials  (pula id em excludeSet, model lock, quota AG, e isBlocked)
  → se nenhuma conta: 503 + Retry-After (menor entre 429 e breaker)
  → senão: pega a conta pela strategy atual (fill-first / round-robin)
canExecute (consome sonda se HALF_OPEN) + acquire semaphore (3, wait ≤2s)
  → handleChatCore
  → JSON ok: recordSuccess; release
  → SSE: solta o slot e recordSuccess/recordFailure no fim do stream
       (onStreamComplete / onDisconnect) — não no return do handleChatCore
  → 5xx/timeout: recordFailure; markAccountUnavailable; exclude; próxima conta
  → 429: markAccountUnavailable só; NÃO recordFailure
  → semaphore cheio: exclude; próxima conta
```

O breaker de tool-loop do Antigravity em `chatCore` / `toolCall.js` não é chamado daqui e não chama isto.

## Testes (seams)

1. Unidade disjuntor: threshold, 429 fora do set, HALF_OPEN, reset, backoff, registry isolado por nome.
2. Unidade porteiro: 4º na mesma chave espera/timeout; outra chave passa; `maxConcurrency` 0/null bypass; fila cheia.
3. Roteamento: A OPEN + B CLOSED → credencial B. A e B OPEN + combo C → C. Restart (resetAll) → A volta a ser escolhida.
4. Chat: 5xx registra falha; 429 não registra.

Sem teste de proxy.

## Fontes a portar (delta)

De VansRouter `dev`:

- `open-sse/utils/circuitBreaker.js` — manter in-memory; **não** chave `provider:proxyHash`. Expor `recordFailure` / `recordSuccess` em vez de `chat.js` chamar `_onFailure`.
- `open-sse/services/accountSemaphore.js` — chave sem `proxyHash` (`provider:accountKey`). Default 3.
- Badge + hook + rotas de API, adaptados à ConnectionRow e à lista de provedores atuais do 0.5.59.
- **Não** portar `isProviderFullyBlocked` por bucket de proxy, Kimchi quota hooks, nem settings cache.
