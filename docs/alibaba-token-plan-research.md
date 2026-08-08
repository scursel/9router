# Relatório de Pesquisa: Alibaba Token Plan e Integração OmniRoute / 9Router

**Data**: 07 de Agosto de 2026  
**Repositório Base**: `/home/scursel/9router-enhanced` (Overlay sobre 9Router 0.5.50)  
**Alvo da Pesquisa**: `diegosouzapw/OmniRoute` e APIs/Documentação Oficial Alibaba Cloud / DashScope / Token Plan  
**Arquivo de Destino**: `docs/alibaba-token-plan-research.md`  

---

## 1. Sumário Executivo

Esta pesquisa avalia a viabilidade técnica e a arquitetura necessária para integrar o endpoint customizado do **Alibaba Token Plan** (`https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions`) no dashboard do 9Router / OmniRoute, especificamente quanto a:
1. Cadastramento como provedor oficial vs. provedor customizado OpenAI-compatible.
2. Implementação de um controlador/rastreador de quota e consumo no dashboard.
3. Investigação da relação estrutural entre **9Router** e **OmniRoute**.

- **Relação 9Router / OmniRoute**: a relação de origem é o inverso da hipótese inicial. O README do OmniRoute diz que ele começou como fork do [`decolua/9router`](https://github.com/decolua/9router). Hoje o OmniRoute também incorpora o 9Router como serviço gerenciado e porta correções entre as duas bases.
- **Endpoint do Alibaba Token Plan**: trata-se de um endpoint oficial da Alibaba Cloud Model Studio em Cingapura (`ap-southeast-1`), compatível com a API OpenAI (`/compatible-mode/v1`), operando com chaves dedicadas (`sk-sp-...`).
- **Decisão Arquitetural do Quota Tracker**: como não existe API pública/oficial para leitura remota de Credits do Token Plan (apenas endpoints internos do console sujeitos a expiração de sessão), a medição foi substituída por um **medidor local de janela deslizante 5h/7d** baseado nos registros de uso do próprio 9Router (`usageHistory` em SQLite).
- **Sem segredos de console**: elimina qualquer dependência de cookies de sessão, `sec_token` ou variáveis de ambiente externas.

---

## 2. Investigação Relação 9Router vs. OmniRoute

### 2.1 Análise do Repositório `diegosouzapw/OmniRoute`
Através de consultas à API do GitHub no repositório `diegosouzapw/OmniRoute` (branch padrão `release/v3.8.50`), constatou-se a seguinte estrutura:

- **Nome e Identidade**: `package.json` (`name: "omniroute"`, `version: "3.8.50"`, autor: `diegosouzapw`, homepage: `https://omniroute.online`).
- **Integração do 9Router como Serviço**: OmniRoute possui rotas dedicadas para instalar, iniciar, parar e supervisionar o processo do 9Router:
  - `src/app/api/services/9router/_lib.ts` (linhas 1-45): Define a criação sob demanda do `ServiceSupervisor` para o executável `9router` na porta `20130`.
  - `src/app/api/services/9router/start/route.ts`
  - `src/app/api/services/9router/status/route.ts`
  - `src/app/api/services/9router/update/route.ts`
- **Histórico de Commits e Commits de Port de Bugfixes**:
  - Commit `595e9e3b1f8b`: `docs(readme): restore 9router acknowledgment` (Reconhecimento do projeto 9Router).
  - Commit `205ef64ac412`: `Merge pull request #2393 from diegosouzapw/chore/restore-9router-acknowledgment`
  - Commit `7a7a72c6f41f`: `fix(network): enable Happy Eyeballs on direct egress (port from 9router#1237)`
  - Commit `9827ae613797`: `fix(api): count tool_use/tool_result/thinking blocks in count_tokens estimate (port from 9router#2337)`
  - Commit `0130a4bbb2f2`: `fix(sse): handle space-separated arg name/value in Composer tool calls (port from 9router#1811)`
  - Commit `b67f2c58da2f`: `fix(dashboard): disambiguate colliding passthrough model aliases (port from 9router#1850)`
  - Commit `cfbc2c27c2dd`: `fix(translator): suppress </think> marker for Antigravity client (port from 9router#1061)`

### 2.2 Veredito da Relação
9Router e OmniRoute **não são o mesmo projeto nem 9Router é um fork de OmniRoute**. 9Router é o projeto original upstream de proxy/roteamento (pacote npm `9router`), enquanto OmniRoute é uma plataforma mais ampla que incorpora o 9Router como um runtime gerenciado e porta melhorias e correções entre as duas bases de código.

---

## 3. Especificações Oficiais do Alibaba Token Plan

### 3.1 Endpoint e Autenticação
- **URL Base**: `https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1`
- **Endpoint Chat Completions**: `https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions`
- **Região**: Cingapura (`ap-southeast-1`).
- **Protocolo/Wire Format**: OpenAI Compatible (`POST /compatible-mode/v1/chat/completions`).
- **Autenticação**: Cabeçalho HTTP `Authorization: Bearer <API_KEY>`.
- **Formato da Chave**: Chaves de assinatura de plano de tokens (frequentemente com prefixo `sk-sp-...`).
- **Isolamento de Canais**: A Alibaba Cloud isola estritamente os canais de bilhetagem. Utilizar uma chave standard do DashScope (`sk-...`) ou de um Coding Plan no endpoint do Token Plan resulta em erros `401 Unauthorized` ou `403 Forbidden`.

### 3.2 Limite da API da chave de inferência e gateway do console
Fontes oficiais da Alibaba confirmam quotas de 5 horas/7 dias, créditos e a visualização da assinatura no console. A issue #9603 do OmniRoute registra a evidência operacional complementar:
- a chave `sk-sp-...` funciona para `/models` e inferência, mas não expõe `/usage`, `/quota` ou `/subscription`;
- o console foi observado usando `/tokenplan/personal/api/v2/subscription`, `/tokenplan/personal/api/v2/usage` e `/tokenplan/personal/api/v2/quota-config`;
- esses métodos exigem sessão autenticada e `sec_token`, não apenas a chave de inferência.

Portanto, há um caminho técnico para um coletor remoto, mas ele depende de uma API interna do console, sem contrato público estável. O dashboard deve sinalizar a origem e a data da leitura; não deve transformar falha/ausência da sessão em saldo zero.
---

## 4. Implementação no OmniRoute (`diegosouzapw/OmniRoute`)

No repositório `diegosouzapw/OmniRoute`, a família de provedores Alibaba / Qwen e o Token Plan são tratados de forma estruturada:

### 4.1 Registros de Provedor
Em `docs/providers/ALIBABA-QWEN-PROVIDER-FAMILIES.md` e `open-sse/config/providers/registry/qwen-cloud-token-plan/index.ts`:
- **ID do Provedor**: `qwen-cloud-token-plan` (alias `qct`).
- **Formato**: `"openai"`.
- **BaseURL Padrão**: `"https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1/chat/completions"`.
- **Modelos Homologados**: `qwen3.8-max-preview`, `qwen3.7-max`, `qwen3.7-plus`, `qwen3.6-flash`, `glm-5.2`, `deepseek-v4-pro`.

### 4.2 Classificação de Bilhetagem (*Flat-Rate*)
No arquivo `src/lib/usage/flatRateProviders.ts` (linhas 1-52):
```typescript
const FLAT_RATE_SUBSCRIPTION_PROVIDER_IDS: ReadonlySet<string> = new Set([
  "minimax",
  "kimi-coding",
  "kimi-coding-apikey",
  "xiaomi-mimo",
  "bailian-coding-plan", // Alibaba Token Plan (legacy ID)
  "qwen-cloud-token-plan", // Qwen Cloud Token Plan
  "glm",
  "glm-cn",
]);
```
- **Abordagem do OmniRoute**: Como o Token Plan é pago via assinatura mensal fixa e não possui API remota de saldo, o OmniRoute o classifica como `FLAT_RATE_SUBSCRIPTION_PROVIDER_IDS`. Em telas de custos/analytics, o custo estimado em dólares é exibido como **$0** (para não distorcer o custo por token cobrado do usuário), evitando simular uma cobrança por token que não existe na fatura oficial.

---

## 5. Comparativo com o Overlay Local (`9router-enhanced`)

No repositório local `/home/scursel/9router-enhanced` (overlay sobre 9Router 0.5.50):
- **Quota Tracker Atual**: O arquivo `patches/quota-tracker.patch.js` e `docs/operations.md` implementam coletores de saldo em USD para 6 provedores específicos:
  1. OpenRouter (`/api/v1/credits` e `/api/v1/auth/key`)
  2. DeepSeek (`/user/balance`)
  3. CommandCode (`/alpha/billing/credits` e `/alpha/billing/subscriptions`)
  4. xAI / Grok (consulta via token OAuth xAI)
  5. Xiaomi MiMo (`/api/v1/balance` utilizando cookie da sessão do console web `MIMO_QUOTA_COOKIE`)
  6. ClinePass (`/api/v1/users/me` e `/api/v1/users/me/plan`)
- **Situação para Alibaba Token Plan**: O 9Router oficial/enhanced atual não possui um provedor pré-configurado `qwen-cloud-token-plan` nem um coletor de quota para ele.

---

## 6. Avaliação de Viabilidade

| Dimensão | Viabilidade | Complexidade | Observação Técnica |
| :--- | :---: | :---: | :--- |
| **(a) Provedor Oficial Preset** | **ALTA** | Média | O OmniRoute já registra `qwen-cloud-token-plan`; no 9Router 0.5.50 isso exige portar catálogo/modelos/endpoint para bundles compilados ou usar temporariamente um `provider-node` OpenAI-compatible. |
| **(b) Contador Local de Consumo** | **ALTA** | Média | O gateway pode acumular tokens/requisições observados nas respostas HTTP/SSE por conexão/chave, sempre rotulados como “consumo do proxy”. |
| **(c) Quota Remota do Console** | **CONDICIONAL** | Alta | Requer sessão/cookie + `sec_token` do console; a chave `sk-sp-...` sozinha não basta. É um endpoint interno, sujeito a expiração, mudanças e falhas de autenticação. |

---

## 7. Riscos de Afirmar Saldo Sem API Pública Estável
Exibir um valor de “saldo restante oficial” sem distinguir a origem apresenta riscos:
1. **Dessincronização de consumo**: uso da mesma conta fora do 9Router não aparece no contador local.
2. **Sessão expirada**: uma resposta vazia/401 não pode ser interpretada como saldo zero ou quota cheia.
3. **Mudança de contrato**: endpoints internos do console podem mudar sem compatibilidade.
4. **Imprecisão financeira**: Token Plan usa créditos e assinatura, não uma carteira USD simples.
5. **Conformidade**: a documentação Alibaba restringe a Token Plan a ferramentas de coding/agent; um gateway genérico pode sair desse escopo.

---

## 8. Recomendação Mínima de Implementação
1. **Cadastramento do provedor**:
   - portar a identidade `qwen-cloud-token-plan` com o endpoint OpenAI-compatible de Singapore;
   - manter a alternativa `provider-node` somente como fallback de compatibilidade.
2. **Medição de Quota**:
   - medição local de janela deslizante (5h / 7d) calculada a partir de `usageHistory`;
   - sem dependência de cookies de console ou segredos de ambiente;
   - suporte a limites opcionais em `providerSpecificData` (`limit5h`, `limit7d`).
3. **Dashboard**:
   - mostrar as janelas 5h e 7d calculadas localmente pelo roteador;
   - rotular a origem explicitamente como `router-local` / consumo medido pelo proxy.
4. **Fallback/segurança**:
   - o erro do coletor nunca pode impedir inferência;
   - cachear a última leitura com timestamp, sem apresentá-la como atual depois da expiração;
   - testar 401, resposta vazia, mudança de ano no reset e retorno normal após reset.

---

## 9. Evidências e Referências Rastreáveis

### Repositório GitHub: `diegosouzapw/OmniRoute`
- `docs/providers/ALIBABA-QWEN-PROVIDER-FAMILIES.md`
- `open-sse/config/providers/registry/qwen-cloud-token-plan/index.ts`
- `src/lib/usage/flatRateProviders.ts`
- `src/app/api/services/9router/_lib.ts`
- Commits de integração: `595e9e3b1f8b`, `205ef64ac412`, `7a7a72c6f41f`, `9827ae613797`.

### Documentação Oficial Alibaba Cloud / DashScope
- [Alibaba Cloud Model Studio Base URLs](https://www.alibabacloud.com/help/en/model-studio/base-url)
- [Alibaba Cloud Token Plan Overview](https://www.alibabacloud.com/help/en/model-studio/token-plan-overview)
- [Alibaba Cloud Token Plan Quickstart](https://www.alibabacloud.com/help/en/model-studio/token-plan-quickstart)
- [China Token Plan Overview](https://help.aliyun.com/zh/model-studio/token-plan-overview)
- Console oficial de gestão de quotas: [Bailian Console](https://bailian.console.aliyun.com/)


## 10. Desenho aprovado para o overlay 9router-enhanced

### 10.1 Objetivo e não-objetivos

O overlay deve:

1. cadastrar `qwen-cloud-token-plan` como provider oficial, com alias `qct`;
2. usar o endpoint OpenAI-compatible regional de Singapore;
3. mostrar no dashboard a quota remota observada no Console Alibaba;
4. manter o consumo observado pelo proxy separado da quota oficial;
5. continuar encaminhando inferência quando o coletor de quota falhar.

Esta versão não fará enforcement de quota, bloqueio de inferência, rotação automática de contas ou roteamento quota-aware. Também não implementará suporte multi-conta para sessões de console.

### 10.2 Provider oficial

- ID canônico: `qwen-cloud-token-plan`.
- Alias: `qct`.
- Base URL: `https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1`.
- Autenticação de inferência: `Authorization: Bearer <sk-sp-...>`.
- Catálogo inicial: `qwen3.8-max-preview`, `qwen3.7-max`, `qwen3.7-plus`, `qwen3.6-flash`, `glm-5.2` e `deepseek-v4-pro`.
- O ID será incluído no catálogo cliente/servidor, allowlists de usage e estruturas de provider necessárias à validação.
- O patcher continuará hash-pinned e recusará bundles ou versões fora do catálogo conhecido.
- `provider-node` OpenAI-compatible permanece somente como fallback manual, não como caminho principal.

### 10.3 Medidor Local de Quota (Sliding Window 5h / 7d)

O coletor de quota opera 100% localmente:

```text
qtpAlibaba(arg, now) ->
  Calcula tokens de prompt + completion em usageHistory (SQLite)
  - Window 5h: agora - 5 horas
  - Window 7d: agora - 7 dias
  Retorna { plan, status: "ok", source: "router-local", fetchedAt, quotas }
```

O cálculo consulta a tabela `usageHistory` para o provider `qwen-cloud-token-plan` e/ou `connectionId`, somando tokens de requisições cujos timestamps estejam dentro das janelas deslizantes de 5 horas e 7 dias.

Se a conexão possuir limites configurados em `providerSpecificData` (`limit5h` / `limit7d`), o dashboard exibe percentual e saldo restante. Caso contrário, exibe o consumo absoluto (ex.: `1.500 / ∞`).

### 10.4 Autenticação e Inferência

Inferência utiliza a chave de API fornecida na conexão (`Authorization: Bearer <sk-sp-...>`). Não são utilizadas nem exigidas credenciais adicionais de console.

1. Parser determinístico cobre payload normal, campos ausentes, schema incompatível e timestamps em segundos, milissegundos, ISO e mudança de ano.
2. Adapter com `fetch` injetado cobre 401, 403, 429, timeout, 5xx e retorno normal.
3. Cache cobre leitura atual, stale e expiração total.
4. O catálogo e o patcher têm teste de reconhecimento da versão/bundle e falha explícita para artefato desconhecido.
5. Um teste verifica que os secrets não entram em payload persistido, resposta de providers, logs ou mensagens de erro.
6. O smoke test executa o patcher contra os artefatos suportados e consulta o endpoint real somente quando os secrets estiverem configurados localmente.
7. A inferência continua funcionando quando o coletor retorna `unavailable`, e o card mantém as linhas visíveis nos estados `ok` e `stale` ao lado da faixa de status.

### 10.6 Riscos aceitos

O endpoint do console não é uma API pública estável. Mudanças de sessão, schema ou host podem tornar a quota indisponível sem afetar chat. O dashboard deve expor essa condição e a data da última leitura, sem afirmar saldo oficial quando a fonte não responder.