# Modelo de branch: o Enhanced como fonte

Até `0.5.59` o Enhanced era um **overlay**: patchers que injetavam JavaScript
minificado nos bundles Next.js já compilados do pacote oficial, presos a hashes
por versão. A partir daqui o Enhanced é um **branch do upstream**, e o produto
sai de um build próprio.

## Topologia

Um repositório, duas histórias sem ancestral comum:

| Branch | Conteúdo |
|---|---|
| `main` | operação: `install.sh`, `scripts/start-9router.sh`, `systemd/`, `docs/` |
| `enhanced/<versão>` | upstream `v<versão>` + os commits do Enhanced |

O upstream é o remote `upstream` (`https://github.com/decolua/9router.git`,
licença MIT). O branch vive num worktree, ignorado por `main`:

```bash
git fetch upstream --tags
git worktree add .worktrees/enhanced-0.5.59 -b enhanced/0.5.59 v0.5.59
```

## Os deltas do Enhanced

Sete commits sobre `v0.5.59`, um por assunto:

| Commit | O que é | O que aposentou |
|---|---|---|
| `feat(antigravity): tool-loop circuit breaker` | limita 3 chamadas idênticas de tool e força turno final de texto | `antigravity-tool-loop-breaker-*.patch` (4 versões) |
| `feat(quota): widen Antigravity model selection` | mantém o coletor oficial e amplia a seleção de modelos | `antigravity-quota-model-filter-0.5.59.patch` |
| `feat(server): CORS preflight and headers` | `OPTIONS` → 204 antes do auth; CORS em toda resposta | `cors-preflight.patch.js` |
| `feat(images): Alibaba WAN image adapter` | adapter de imagem para o endpoint compatível da Alibaba | `wan-image.patch.js` |
| `fix(catalog): drop NVIDIA EOL models…` | remove 2 modelos EOL; busca por nome de provider; flags de usage | `remove-nvidia-eol-models.patch.js` |
| `feat(quota): balance collectors upstream does not ship` | OpenRouter, CommandCode, MiMo, ClinePass, OpenCode Go + medidor Alibaba | as 20 funções `qtp*` de `quota-tracker.patch.js` |
| `feat(quota): render money quotas as currency…` | moeda nas cotas `(USD)` e procedência do medidor local | patch de UI de `quota-tracker.patch.js` |

## O que deixou de existir

```text
patchers .js                 2.479 linhas   →  0
.patch de fonte                1.451 linhas →  histórico do branch
testes de hash-pinning         1.537 linhas →  0
fixtures de bundle                 6,5 MB   →  0
sha256 fixados                       272    →  0
variantes de catálogo                 12    →  0
lista de chunks p/ revalidar cache    50 ln  →  0
```

A lista de revalidação de cache caiu por construção: ela existia porque o
overlay reescrevia um chunk *sem trocar o nome content-hashed*, então todo
browser ficava presdo na versão anterior. No build próprio o nome deriva do
conteúdo, e `immutable` volta a ser correto.

A ordem obrigatória entre patchers (quota-tracker antes de NVIDIA EOL, porque
os hashes de um eram calculados depois do outro) também desapareceu: em fonte
não há ordem.

## Ciclo de release

```bash
cd .worktrees/enhanced-0.5.59
git fetch upstream --tags
git checkout -b enhanced/<nova> enhanced/<antiga>
git rebase --onto v<nova> v<antiga>          # conflito = arquivo-fonte, não chunk
npm install && npm install --no-save vitest@4.1.10
npx vitest run --config tests/vitest.config.js   # compare com o baseline da tag
npm --prefix cli run build
cd cli && npm pack --pack-destination /tmp
```

O upstream `v0.5.59` já vem com 197 testes falhando (drift de endpoint do
Windsurf, 125 snapshots). Compare sempre contra um worktree limpo da tag:

```bash
git worktree add /tmp/baseline v<nova> --detach
```

Aceitável é *igualdade de falhas*, não zero falhas.

## Testes do Enhanced

Nove arquivos, 61 testes, todos rodando na árvore-fonte:

```text
tests/translator/tool-loop-breaker.test.js
tests/translator/antigravity-usage.test.js
tests/unit/cors-preflight-source.test.js
tests/unit/wan-image-adapter.test.js
tests/unit/nvidia-eol-models.test.js
tests/unit/model-search-name-match.test.js
tests/unit/quota-collectors.test.js
tests/unit/alibaba-token-plan-meter.test.js
tests/unit/quota-currency-rendering.test.js
```

No modelo antigo, os dois primeiros existiam **apenas como texto dentro de um
arquivo `.patch`** e só rodavam num clone temporário.

## Instalação

O tarball do branch é autossuficiente: nenhum patcher é aplicado depois.

```bash
npm install -g /tmp/9router-0.5.59-branch.tgz
./install.sh          # launcher + systemd, sem patch de bundle
```
