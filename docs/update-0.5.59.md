# Update 0.5.59: avaliação e port do Enhanced

Pesquisa e port feitos em 2026-08-29 contra fontes primárias do repositório e
do pacote npm oficiais. O artefato Enhanced `0.5.59` já está construído e
validado; o serviço em produção continua em `0.5.55` até o corte.

## Conclusão

O update oficial mais recente é o `9router@0.5.59`. Um upgrade **direto para o
pacote oficial** preservaria o 9Router base, o patch de CORS e o adaptador WAN,
mas perderia o circuit breaker Antigravity, os coletores extras de quota e a
remoção dos modelos NVIDIA EOL.

Por isso o caminho é o mesmo das versões anteriores: rebuild privado do
`0.5.59` com os patches-fonte, mais o overlay hash-pinned por variante. Esse
port está **concluído e validado em isolamento** (ver
[Port executado](#port-executado)); falta apenas o corte do serviço.

O port seguiu a estratégia *upstream-first*: onde o oficial já implementa a
funcionalidade, o Enhanced deixou de duplicá-la e ficou apenas com o delta.

## Versões e intervalo auditado

- Base Enhanced atual: `9router@0.5.55`, tag `v0.5.55`, commit
  [`699edac3273e13d4744bc46f6082618f08560702`](https://github.com/decolua/9router/commit/699edac3273e13d4744bc46f6082618f08560702).
- Nova versão oficial: `9router@0.5.59`, tag anotada `v0.5.59`, commit
  [`90b52e06ffd666b7929554211474d01588f6b1f8`](https://github.com/decolua/9router/commit/90b52e06ffd666b7929554211474d01588f6b1f8).
- Publicação npm: 2026-08-29 11:04:13 UTC; `latest` aponta para `0.5.59` e o
  `gitHead` do pacote é o mesmo commit da tag. Veja o
  [pacote oficial no npm](https://www.npmjs.com/package/9router/v/0.5.59) e o
  [manifesto CLI na tag](https://github.com/decolua/9router/blob/v0.5.59/cli/package.json).
- Intervalo: [`v0.5.55...v0.5.59`](https://github.com/decolua/9router/compare/v0.5.55...v0.5.59),
  com 41 commits e 114 arquivos alterados (`+5579/-2176`).

O GitHub Releases estava defasado no momento da consulta. Para determinar a
versão real foram usadas a tag Git, o commit, o changelog e o dist-tag do npm.

## Principais melhorias oficiais

O resumo completo pertence ao
[`CHANGELOG.md` oficial de 0.5.59](https://github.com/decolua/9router/blob/90b52e06ffd666b7929554211474d01588f6b1f8/CHANGELOG.md#v0559-2026-08-29).
As mudanças mais relevantes são:

1. **Busca web ampliada.** Novos provedores Antigravity/Google Search e Xquik/X,
   além de fallback de credenciais para Ollama Search e busca GLM. O isolamento
   de falhas também foi corrigido para uma busca com problema não derrubar a
   mesma credencial usada pelo chat
   ([commits de busca](https://github.com/decolua/9router/compare/v0.5.55...v0.5.59)).
2. **Catálogo e modelos mais atuais.** Sincronização diária, estritamente
   aditiva, de capacidades via models.dev; inclusão de GLM-5.3-Flash, DeepSeek
   V4 Vision e Grok 4.5/4.6. A sincronização pode ser desativada com
   `MODEL_CATALOG_SYNC=off`
   ([implementação](https://github.com/decolua/9router/blob/v0.5.59/src/lib/modelCatalog/sync.js)).
3. **Quota e roteamento.** Dashboard de quota do plano Zed, janelas do
   GPT-5.3-Codex-Spark e roteamento Antigravity consciente de quota e do instante
   de reset por conta/modelo
   ([Zed](https://github.com/decolua/9router/blob/v0.5.59/open-sse/services/usage/zed.js),
   [Codex](https://github.com/decolua/9router/blob/v0.5.59/open-sse/services/usage/codex.js),
   [Antigravity](https://github.com/decolua/9router/blob/v0.5.59/src/sse/services/antigravityQuota.js)).
4. **Antigravity e imagens.** Tiers Gemini 3.7 Flash no MITM e conversão de
   `size` para o sufixo de aspect ratio na geração de imagens
   ([diff oficial](https://github.com/decolua/9router/compare/v0.5.55...v0.5.59)).
5. **Operação e UX.** Importação em lote de contas Grok CLI, presets de
   endpoint compartilhados entre todos os cards de ferramentas, timeout de
   compressão Headroom configurável e tradução pt-BR ampliada para 1132 termos.
6. **Correções de confiabilidade.** Registro de usage no evento terminal da
   Responses API, leitura da última linha NDJSON do Ollama, preservação de
   `cached_tokens`, session id do Claude Code, fallback correto para erros
   in-stream do CommandCode, imagens MiniMax, ferramentas Claude, RTK por formato,
   Muse Spark via Responses e instalação de `better-sqlite3` no Node 22+.

## Matriz de compatibilidade com o Enhanced

| Componente | Estado em 0.5.59 | Evidência e impacto |
|---|---|---|
| 9Router oficial | **Atualizável como upstream limpo** | `0.5.59` é a versão oficial publicada. Isso não implica preservar todos os recursos do Enhanced. |
| Quota/balance tracker | **Incompatível; falha fechada** | [`SUPPORTED_VERSIONS`](../patches/quota-tracker.patch.js) termina em `0.5.55` e os bundles são hash-pinned. Contra o tarball oficial, `--check` retornou `catalogVariant: "unknown"`; `--apply` recusou o fingerprint `0.5.59`. O [launcher](../scripts/start-9router.sh) sanitiza resíduos e sobe o upstream limpo. |
| Circuit breaker Antigravity | **Incompatível sem port** | `git apply --check` do [patch 0.5.55](../patches/antigravity-tool-loop-breaker-0.5.55.patch) falhou em `open-sse/handlers/chatCore.js:29`. O upstream alterou `chatCore.js`, `appConstants.js` e `toolCall.js`, todos tocados pelo breaker. O código oficial `0.5.59` não contém os marcadores nem a lógica de limite de chamadas idênticas. |
| CORS preflight | **Compatível, testado no artefato publicado** | `custom-server.js` é byte-idêntico entre as tags. O [patch por anchors](../patches/cors-preflight.patch.js) aplicou no tarball npm `0.5.59`, o check reportou `applied` e `node --check` passou. |
| Adaptador WAN image | **Compatível, testado no artefato publicado** | O anchor do mapa de image providers permaneceu presente. O patch operacional `WanImageProviderPatch:v1` aplicou na rota compilada do tarball `0.5.59` e `node --check` passou. Esse patch vive hoje em `~/.9router`, não neste repositório. |
| OpenCode Go e coletores de usage | **Requer auditoria no port de quota** | O upstream mudou `open-sse/executors/opencode.js`, o registry de OpenCode Go e vários serviços de usage no mesmo intervalo. Os coletores oficiais novos devem ser preservados ao gerar o overlay `0.5.59`; simplesmente reutilizar chunks `0.5.55` perderia essas mudanças. |
| Remoção NVIDIA EOL (WIP local) | **Incompatível** | O arquivo não rastreado [`remove-nvidia-eol-models.patch.js`](../patches/remove-nvidia-eol-models.patch.js) rejeita qualquer versão diferente de `0.5.55` e também depende de bundles fixos. |

## Oportunidades de substituição pelo oficial

Há substituições úteis, mas elas são seletivas. A melhor direção para o port
`0.5.59` é deixar o upstream ser dono de catálogo, transporte e coletores que
ele já implementa, reduzindo o Enhanced aos deltas que continuam exclusivos.

| Melhoria Enhanced | Conclusão | O que pode ser retirado e o que permanece |
|---|---|---|
| DeepSeek e Grok/xAI | **Substituição total, já adotada** | Desde o commit Enhanced [`d02d14d`](https://github.com/scursel/9router-enhanced/commit/d02d14d411d04c82c3f194714928d209a8572acd), o overlay não sombreia esses coletores. O `0.5.59` continua despachando ambos nativamente no [`USAGE_HANDLERS`](https://github.com/decolua/9router/blob/v0.5.59/open-sse/services/usage.js#L33-L59), incluindo o saldo multi-moeda do [DeepSeek](https://github.com/decolua/9router/blob/v0.5.59/open-sse/services/usage/deepseek.js) e as janelas/saldos do [Grok CLI](https://github.com/decolua/9router/blob/v0.5.59/open-sse/services/usage/grok-cli.js). Não reintroduzir `qtpDeepSeek` nem `qtpNormalizeXai` no catálogo `0.5.59`. |
| Alibaba Token Plan: registro e transporte | **Substituição total, já adotada** | O registro privado `qwen-cloud-token-plan` já foi substituído pelo `alitp-intl` oficial no commit Enhanced [`a532a67`](https://github.com/scursel/9router-enhanced/commit/a532a67722394ed449f9bb2113a537f85f01119c). Preservar o [registro oficial](https://github.com/decolua/9router/blob/v0.5.59/open-sse/providers/registry/alitp-intl.js); não portar a injeção do provedor legado. |
| OpenCode Go | **Substituição parcial forte** | Retirar `patchOpenCodeGoRuntime` e usar como base o catálogo oficial, que já possui três transportes (`chat/completions`, `messages`, `responses`) e `supportedFormats` por modelo no [registro `opencode-go`](https://github.com/decolua/9router/blob/v0.5.59/open-sse/providers/registry/opencode-go.js#L21-L50), com as correções de modelos no commit [`9c650e1`](https://github.com/decolua/9router/commit/9c650e1d5469d510463bd2d940f03ea3bc4a8194) e de Muse Spark no [`ab044e6`](https://github.com/decolua/9router/commit/ab044e6d6d49864f569d333872f539a7641b2cd4). Trocar `patchOpenCodeGoCatalog`, que hoje substitui o array inteiro, por um delta aditivo apenas para os 11 IDs Enhanced ausentes do oficial, se ainda forem aceitos ao vivo. Manter o coletor `/zen/go/v1/usage` de [`50929f2`](https://github.com/scursel/9router-enhanced/commit/50929f26797d46baa799fd624bb1dedcdccd2f2d), pois `opencode-go` não aparece no dispatcher oficial de usage. |
| Quota Antigravity (WIP não commitado) | **Substituição parcial forte** | O fetch, autenticação, tratamento 401/403 e renderização já existem em [`getAntigravityUsage`](https://github.com/decolua/9router/blob/v0.5.59/open-sse/services/usage/google.js#L116-L220); portanto, não vale manter `qtpAntigravity` nem substituir o dispatch oficial. O WIP local ainda cobre IDs tiered/recomendados dinamicamente e elimina aliases depreciados, enquanto o oficial usa uma lista estática. Se essa cobertura for necessária, portar apenas esse pequeno delta para o parser oficial, hoje em [`quota-tracker.patch.js`](../patches/quota-tracker.patch.js). |
| Roteamento Antigravity vs. tool-loop breaker | **Complementares; sem substituição do breaker** | O commit oficial [`1a3db1e`](https://github.com/decolua/9router/commit/1a3db1efae5c758483a7af9e3cfb01a7a64015df) mantém cache de quota, aprende `resetAt` após 409/429 e evita apenas a conta/modelo esgotada ([implementação](https://github.com/decolua/9router/blob/v0.5.59/src/sse/services/antigravityQuota.js)). A sanitização oficial [`dff6484`](https://github.com/decolua/9router/commit/dff648496c6b8ec2f334e90dd3f3ec5060ec3db8) apenas reescreve branding concorrente no system prompt. Nenhuma delas conta chamadas semanticamente idênticas nem força uma rodada final sem tools; manter o breaker Enhanced de [`bae164d`](https://github.com/scursel/9router-enhanced/commit/bae164d7d95eb3cf7dcbb618fc760d5cf778ba90). |
| OpenRouter, CommandCode, MiMo e ClinePass | **Sem substituição** | Nenhum dos quatro aparece no [`USAGE_HANDLERS` oficial](https://github.com/decolua/9router/blob/v0.5.59/open-sse/services/usage.js#L33-L59). A correção oficial do CommandCode em `0.5.59` trata erro NDJSON no executor, não saldo ou quota ([changelog](https://github.com/decolua/9router/blob/v0.5.59/CHANGELOG.md#L65-L68)). Manter os coletores Enhanced, inclusive a correção WIP que interpreta `monthlyCredits` como saldo restante e deriva o total pelo plano. |
| Alibaba: medidor 5h/7d (WIP atual) | **Sem substituição** | O `alitp-intl` oficial fornece conexão, modelos e transporte, mas não handler de usage. Manter o medidor local por `connectionId`, as janelas ancoradas e a estimativa em créditos do WIP em [`quota-tracker.patch.js`](../patches/quota-tracker.patch.js); somente a camada de registro do provedor é dispensável. |
| UI de quota | **Substituição parcial** | Preservar integralmente as melhorias oficiais de linhas `unlimited` e mensagens de quota dos commits [`e5a13c3`](https://github.com/decolua/9router/commit/e5a13c3ab7616751873d8a71b54805774687cde6) e [`40eed18`](https://github.com/decolua/9router/commit/40eed186881657a90aea0f5929e5d274e0039b06). No port, aplicar somente os deltas Enhanced de moeda e de `status/source/fetchedAt`, sem transplantar chunks UI antigos. |
| CORS preflight global | **Sem substituição** | O [`custom-server.js` oficial](https://github.com/decolua/9router/blob/v0.5.59/custom-server.js#L49-L75) ainda encaminha `OPTIONS` ao auth e não injeta CORS em todos os erros. Há `OPTIONS` em rotas específicas, como [images/generations](https://github.com/decolua/9router/blob/v0.5.59/src/app/api/v1/images/generations/route.js#L3-L10), mas isso não cobre `/v1/chat/completions` nem 401/403 globais. Manter o patch Enhanced de [`515127d`](https://github.com/scursel/9router-enhanced/commit/515127de769e24d4a7ce1f35dc33c14a692c2853). |
| Adaptador WAN image | **Sem substituição** | O registro oficial de [image adapters](https://github.com/decolua/9router/blob/v0.5.59/open-sse/handlers/imageProviders/index.js#L16-L42) continua fechado a IDs conhecidos e não reconhece o custom provider WAN que chama o endpoint de chat compatível da Alibaba. A nova conversão de `size` oficial pertence apenas ao Antigravity (commit [`2a9213c`](https://github.com/decolua/9router/commit/2a9213c5bde5834ce99ee03a070e751918aa69cd)); manter `~/.9router/wan-image.patch.js`. |
| Remoção NVIDIA EOL vs. models.dev | **Sem substituição** | A sincronização oficial é estritamente aditiva e percorre apenas modelos já registrados para complementar modalidades/limites ([código](https://github.com/decolua/9router/blob/v0.5.59/src/lib/modelCatalog/sync.js#L142-L166), commit [`0532f00`](https://github.com/decolua/9router/commit/0532f00d84b131b4e31424cf5045df5dd8b09b44)); ela não remove modelos. O catálogo `0.5.59` ainda contém exatamente `z-ai/glm-5.2` e `deepseek-ai/deepseek-v4-pro` no [registro NVIDIA](https://github.com/decolua/9router/blob/v0.5.59/open-sse/providers/registry/nvidia.js#L24-L35). Se a política EOL continuar desejada, portar [`remove-nvidia-eol-models.patch.js`](../patches/remove-nvidia-eol-models.patch.js). |

Em termos práticos, o port pode eliminar três blocos Enhanced: os coletores
DeepSeek/Grok antigos (já eliminados), o registro Alibaba legado (já eliminado)
e o runtime próprio do OpenCode Go, reduzindo a customização do catálogo a uma
lista aditiva. Também pode trocar a maior parte do WIP Antigravity pelo coletor
oficial. Os coletores financeiros
restantes, o uso OpenCode Go, o medidor Alibaba, o breaker, CORS, WAN e a
política NVIDIA continuam sendo diferenciais do Enhanced.

## Port executado

Tarball Enhanced `0.5.59` (`npm pack` do `cli/` já construído com os patches-fonte):

```text
/tmp/9router-0.5.59-enhanced.tgz
sha256 5caaf31635f5f92781c9a7dc60b020489a7b404b35d89ef5ef40b75777d1b3bf
```

O que mudou no overlay:

1. **Catálogos de quota `official-0.5.59` e `enhanced-0.5.59`.** Fingerprints
   `page-69f67dfea276e5ad.js` (oficial) e `page-f8f2554003335349.js` (enhanced),
   20 bundles hash-pinned cada. `0.5.59` entrou em `SUPPORTED_VERSIONS`;
   versões desconhecidas continuam falhando fechado.
2. **Antigravity: coletor oficial + delta.** O overlay não injeta mais
   `qtpAntigravity`/`qtpParseAntigravity`. O delta virou patch-fonte
   [`antigravity-quota-model-filter-0.5.59.patch`](../patches/antigravity-quota-model-filter-0.5.59.patch):
   `parseAntigravityQuotaModels` amplia a seleção estática oficial com os IDs
   recomendados dinamicamente (`agentModelSorts`), suprime aliases de
   `deprecatedModelIds`, trata `remainingFraction` ausente (proto3 omite zero)
   como esgotado e prefere `paidTier` ao `currentTier` no nome do plano.
3. **Breaker portado** para a árvore `v0.5.59` em
   [`antigravity-tool-loop-breaker-0.5.59.patch`](../patches/antigravity-tool-loop-breaker-0.5.59.patch).
   O conflito de import em `chatCore.js` foi resolvido contra o novo arquivo.
4. **UI de quota.** `buildLegacyUiPatched` ganhou o padrão novo da 0.5.59, que
   já traz a linha `Unlimited` oficial; o delta Enhanced acrescenta somente a
   formatação de moeda nas cotas `(USD)`.
5. **Alibaba/OpenCode Go/DeepSeek/Grok** continuam oficiais. O overlay
   acrescenta só os coletores que o upstream não tem e o medidor local 5h/7d.
6. **NVIDIA EOL + busca por nome de provider** viraram artefatos do repo
   ([`remove-nvidia-eol-models.patch.js`](../patches/remove-nvidia-eol-models.patch.js)),
   agora com tabela de alvos por versão (`0.5.55`: 7 alvos, `0.5.59`: 8 alvos)
   e aplicados pelo launcher, fail-open. Os hashes de `0.5.59` são do build
   **depois** do quota tracker: essa é a ordem obrigatória de aplicação.
7. **`wan-image.patch.js` entrou no repo com correção de rollback.** O rollback
   restaurava `~/.9router/wan-image-original.route.js`, um backup global capturado
   da `0.5.55`; sobre a `0.5.59` isso gravaria a rota compilada de outra build
   (outros ids de chunk webpack). Agora o rollback reverte a própria injeção,
   é byte-exato e independente de versão.

## Validação em isolamento

```text
node tests/quota-tracker.test.js                  parsers
node tests/quota-tracker-integration.test.js      integração
node tests/alibaba-token-plan.test.js             medidor 5h/7d
node tests/cors-preflight.test.js                 CORS + cache-control
node tests/quota-tracker-0555.test.js             apply/rollback oficial 0.5.55
node tests/quota-tracker-0555-enhanced.test.js    apply/rollback enhanced 0.5.55
node tests/quota-tracker-0559.test.js             apply/rollback oficial 0.5.59
node tests/quota-tracker-0559-enhanced.test.js    apply/rollback enhanced 0.5.59
```

No tarball Enhanced empacotado: `--check` → `enhanced-0.5.59`, `--apply` →
`20/20`, `--rollback` + `--sanitize` → árvore byte-idêntica ao tarball original;
CORS e WAN aplicam e revertem byte-exato; NVIDIA EOL aplica 8 alvos, `node
--check` passa e reverte.

Instância isolada na porta 20591 com os três patches aplicados:
`/api/health` → `{"ok":true}`; `OPTIONS /v1/chat/completions` → `204` com
cabeçalhos CORS; chunk modificado servido com `max-age=0, must-revalidate` e
chunk intocado com `immutable`; sha256 do chunk servido igual ao do disco;
dashboard de providers renderiza 40 providers, com `Alibaba Token Plan`, sem
`Invalid provider`; `/dashboard/quota` carrega sem erro de página.

## Corte do serviço (executado em 2026-08-29 13:51 UTC)

Backup em `~/.9router/db/backups/pre-cutover-0.5.55-to-0.5.59-20260829-135109`:
banco (`data.sqlite`, 32 MB), os quatro patchers e o launcher da 0.5.55, o
pacote 0.5.55 completo (`9router-package-0.5.55-enhanced.tgz`) e o tarball
0.5.59 instalado. O rollback é `npm install -g` do pacote 0.5.55 arquivado.

Sequência: `systemctl --user stop` → backup → `npm install -g
/tmp/9router-0.5.59-enhanced.tgz` → `./install.sh`. O launcher registrou o
backup automático de troca de versão, aplicou quota tracker (`already applied`),
CORS (`no-op`), NVIDIA EOL (`8 alvos`) e WAN (`applied`), nessa ordem, e o
health check de startup passou. O `postinstall` do npm foi bloqueado pela
política de scripts; é apenas warm-up do SQLite em `~/.9router/runtime` e o
`cli.js` refaz em runtime.

Estado verificado depois do corte:

```text
versão instalada          0.5.59
quota tracker             enhanced-0.5.59, usagePatched, 20/20
cors-preflight            applied
nvidia-eol                applied, 8 alvos
wan-image                 applied
/api/health               {"ok":true}
OPTIONS /v1/chat/...      204 + cabeçalhos CORS
GET /v1/models            200, 529 modelos, combos preservados
launcher                  quota-tracker-version=0.5.59, status=patched, sem quarentena
```

Catálogo ao vivo: o provider `nvidia` não lista mais `z-ai/glm-5.2` nem
`deepseek-ai/deepseek-v4-pro` (os aliases desses modelos em outros providers
continuam intactos, por desenho); os modelos novos do oficial aparecem
(`glm-5.3-flash`, `deepseek-v4-flash-vision-exp`, `grok-4.5`, `grok-4.6`).
Os chunks do dashboard tocados pelo overlay são servidos com
`max-age=0, must-revalidate` e sha256 igual ao disco; os intocados seguem
`immutable`.

## Comandos de verificação executados

```text
git rev-list --count v0.5.55..v0.5.59
git diff --shortstat v0.5.55..v0.5.59
git apply --check patches/antigravity-tool-loop-breaker-0.5.55.patch
npm view 9router@0.5.59 version gitHead dist.tarball dist.integrity time --json
npm pack 9router@0.5.59
NINE_ROUTER_PACKAGE_ROOT=<tarball extraído> node patches/quota-tracker.patch.js --check
NINE_ROUTER_PACKAGE_ROOT=<tarball extraído> node patches/quota-tracker.patch.js --apply
NINE_ROUTER_PACKAGE_ROOT=<tarball extraído> node patches/cors-preflight.patch.js --apply
NINE_ROUTER_PACKAGE_ROOT=<tarball extraído> node ~/.9router/wan-image.patch.js --apply
node --check <tarball extraído>/app/custom-server.js
node --check <tarball extraído>/app/.next-cli-build/server/app/api/v1/images/generations/route.js
npm pack                                   # rebuild privado -> 9router-0.5.59-enhanced.tgz
NINE_ROUTER_PACKAGE_ROOT=<tarball enhanced> node patches/quota-tracker.patch.js --check|--apply|--rollback|--sanitize
NINE_ROUTER_PACKAGE_ROOT=<tarball enhanced> node patches/remove-nvidia-eol-models.patch.js --check|--apply|--rollback
NINE_ROUTER_PACKAGE_ROOT=<tarball enhanced> node patches/wan-image.patch.js --apply|--rollback
npx vitest run --config tests/vitest.config.js tests/translator/tool-loop-breaker.test.js tests/translator/antigravity-usage.test.js tests/translator/bugs-antigravity.test.js
```
