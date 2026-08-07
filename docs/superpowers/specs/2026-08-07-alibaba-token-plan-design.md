# Desenho: Alibaba Token Plan no 9Router Enhanced

**Data:** 2026-08-07  
**Escopo:** overlay `9router-enhanced` sobre 9Router 0.5.50  
**Status:** aprovado durante a sessão de desenho

## Objetivo

Adicionar o Alibaba Token Plan como provider oficial no catálogo do 9Router e exibir no dashboard a quota remota observada no Console Alibaba, sem confundir essa leitura com o consumo local do proxy.

A inferência deve continuar funcionando quando o coletor remoto estiver sem sessão, sofrer timeout ou encontrar mudança no endpoint do console.

## Não-objetivos

A primeira versão não fará:

- enforcement de quota;
- bloqueio de inferência;
- rotação automática de contas;
- roteamento quota-aware;
- suporte multi-conta para sessões de console;
- persistência de cookie ou `sec_token` no SQLite.

O `provider-node` OpenAI-compatible existente continua disponível somente como fallback manual; não é o caminho principal.

## Provider oficial

O catálogo terá a identidade canônica:

- **ID:** `qwen-cloud-token-plan`;
- **alias:** `qct`;
- **formato:** OpenAI-compatible;
- **base URL:** `https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1`;
- **autenticação de inferência:** `Authorization: Bearer <sk-sp-...>`;
- **modelos iniciais:** `qwen3.8-max-preview`, `qwen3.7-max`, `qwen3.7-plus`, `qwen3.6-flash`, `glm-5.2` e `deepseek-v4-pro`.

O ID será incluído nas estruturas cliente/servidor do catálogo, nas allowlists de usage e nas estruturas necessárias à validação do provider. O patcher continuará hash-pinned e recusará versões ou bundles não reconhecidos.

A API key `sk-sp-*` será usada apenas para inferência. Ela não será reinterpretada como credencial da sessão do console.

## Coletor remoto

O coletor será um módulo separado do provider de inferência, com uma interface pequena:

```text
fetchQuota() ->
  { status: "ok", plan, windows, fetchedAt }
  { status: "stale", plan, windows, fetchedAt }
  { status: "unavailable", reason, fetchedAt? }
```

A implementação usará `proxyAwareFetch`, timeout curto e cache em memória. Consultará os endpoints privados de quota do Console Alibaba usando a sessão configurada, normalizará o payload e retornará um contrato com metadados de estado:

```text
{ plan, quotas, status, source, fetchedAt, message? }
```

`status` será `ok`, `stale` ou `unavailable`; `source` será `alibaba-console`; `fetchedAt` sempre identificará a leitura que originou as linhas. Nos estados `ok` e `stale`, `message` ficará ausente para não acionar o ramo de erro do card atual e ocultar as quotas. `unavailable` terá `message` seguro e não terá linhas de quota.

O card de quota atual faz `message ? mensagem : <quotas>`. O patch de UI deverá renderizar, nos estados `ok` e `stale`, uma faixa compacta com origem, estado e timestamp **junto das quotas**; no estado `unavailable`, manterá a mensagem sem linhas. A UI usará os metadados do payload bruto já preservado no estado do card, sem expor secrets.

O cache terá TTL de 60 segundos. Uma leitura anterior poderá ser marcada como `stale` por no máximo cinco minutos após `fetchedAt`; depois disso, nenhuma quota será devolvida.


As linhas públicas serão:

- `5 hour window (%)`;
- `7 day window (%)`.

Cada linha terá `used`, `total: 100`, `remainingPercentage` e `resetAt`. A unidade será percentual: não serão exibidos USD ou créditos sem confirmação do contrato privado. O plano e a validade da assinatura poderão aparecer na mensagem.

O coletor não fará retry agressivo nem converterá resposta vazia em quota zero. O cache é curto e serve para evitar chamadas repetidas ao console. Um cache expirado não será apresentado como atual.

## Credenciais e segurança

A inspeção do bundle atual confirmou que `providerSpecificData` é serializado como JSON puro em `providerConnections.data` e também entra em export/backup. Portanto, a primeira versão fornecerá a sessão somente por secrets externos ao processo:

```text
ALIBABA_TOKEN_PLAN_QUOTA_COOKIE
ALIBABA_TOKEN_PLAN_SEC_TOKEN
```

A primeira versão suporta uma sessão global por processo/conta. Conexões Token Plan da mesma conta podem compartilhar a leitura. Múltiplas contas exigirão uma segunda especificação com criptografia dedicada por conexão, incluindo proteção de SQLite, export, backup e endpoints GET.

Os secrets não podem aparecer em:

- `/api/providers`;
- payload persistido ou `usageHistory`;
- exports ou backups;
- URLs;
- logs;
- mensagens de erro.

Logs e erros podem indicar somente estados como `session configured`, `session expired` e `session unavailable`.

## Estados e tratamento de erros

O dashboard exibirá a origem `Console Alibaba` e distinguirá:

- **`ok`:** leitura atual das janelas 5h e 7d;
- **`stale`:** última leitura válida, com timestamp visível e dentro do limite de stale;
- **`unavailable`:** sessão ausente/expirada, 401/403, 429/5xx, timeout, resposta vazia ou schema incompatível sem cache válido.

O estado `unavailable` nunca será representado por `used: 0`. O erro do coletor não altera a disponibilidade da inferência.

Timestamps em segundos, milissegundos ou ISO serão normalizados. Mudanças de ano no reset terão cobertura explícita. Um 429 não desativa a conexão nem aciona rotação automática.

O consumo local observado pelo proxy continuará separado da quota remota do console.

## Dados e fluxo

1. O cliente seleciona o provider `qwen-cloud-token-plan` e usa sua API key para inferência.
2. A rota existente de uso recebe a solicitação do dashboard para a conexão.
3. O dispatcher identifica o provider canônico e chama o coletor Alibaba.
4. O coletor lê os secrets do ambiente, consulta o console através do proxy configurado, valida o payload e atualiza o cache.
5. O dispatcher entrega `{ plan, quotas, status, source, fetchedAt, message? }` para a UI existente.
6. O patch de UI renderiza origem/estado/timestamp junto das linhas nos estados `ok` e `stale`; em `unavailable`, renderiza a mensagem sem quotas.

O payload bruto já preservado pelo card continua sendo a fonte dos metadados visuais; nenhum secret chega ao cliente.

A quota remota será apenas observacional nesta versão. Nenhuma decisão de roteamento será tomada com base nela.

## Verificação e critérios de aceite

1. Parser determinístico cobre resposta normal, campos ausentes, schema incompatível e timestamps em segundos, milissegundos, ISO e mudança de ano.
2. Adapter com `fetch` injetado cobre 401, 403, 429, timeout, 5xx e retorno normal.
3. Cache cobre leitura atual, stale e expiração completa.
4. O catálogo e o patcher reconhecem os bundles suportados e falham explicitamente para artefato desconhecido.
5. Testes verificam que os secrets não entram em payload persistido, resposta de providers, logs ou mensagens de erro.
6. O smoke test executa o patcher contra os artefatos suportados.
7. Um smoke test do card comprova que `ok` e `stale` exibem faixa de status e linhas de quota simultaneamente; `unavailable` exibe somente a mensagem segura.
8. Um teste ou cenário local comprova que a inferência continua funcionando quando o coletor retorna `unavailable`.
9. Uma leitura real do console só será executada quando os secrets estiverem configurados localmente; nenhum secret será incluído no repositório ou enviado pela conversa.

## Riscos aceitos

O endpoint do console é interno e não constitui uma API pública estável. Alterações de sessão, host ou schema podem tornar a quota indisponível sem afetar chat. O dashboard deve expor a indisponibilidade e a data da última leitura, sem afirmar saldo oficial quando a fonte não responder.

A documentação Alibaba também posiciona Token Plan para ferramentas de coding/agent; o uso através de um gateway genérico deve respeitar esse escopo.

## Fontes

- [OmniRoute — provider `qwen-cloud-token-plan`](https://github.com/diegosouzapw/OmniRoute/blob/ff679ab86e0113a009d8aeeeee464139bd090874/open-sse/config/providers/registry/qwen-cloud-token-plan/index.ts)
- [OmniRoute — famílias de providers Alibaba/Qwen](https://github.com/diegosouzapw/OmniRoute/blob/62c9058da18e/docs/providers/ALIBABA-QWEN-PROVIDER-FAMILIES.md)
- [Alibaba Cloud — Base URLs do Model Studio](https://www.alibabacloud.com/help/en/model-studio/base-url)
- [Alibaba Cloud — Token Plan Overview](https://www.alibabacloud.com/help/en/model-studio/token-plan-overview)
- [Alibaba Cloud — Token Plan Quickstart](https://www.alibabacloud.com/help/en/model-studio/token-plan-quickstart)
- [Relatório local de pesquisa](../../alibaba-token-plan-research.md)
