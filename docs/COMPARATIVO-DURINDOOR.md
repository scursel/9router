# Comparativo: nosso 9Router e DurinDoor

_Verificado em 2026-09-05 contra o `HEAD` local `c9404f2` e o `main` do
DurinDoor `cf572ec911afbef2e7cc1248a9be2e7a7b0d439a`._

O DurinDoor declara explicitamente que é um fork do 9Router e mantém
compatibilidade com `DATA_DIR`, chaves e cabeçalhos legados. Portanto, o
núcleo — gateway local Next.js, `/v1`, tradução de formatos, OAuth/API keys,
combos, fallback por conta e telemetria — é largamente compartilhado, não uma
vantagem exclusiva de nenhum dos dois. [Fonte primária: README do
DurinDoor](https://github.com/bloodf/durindoor/blob/cf572ec911afbef2e7cc1248a9be2e7a7b0d439a/README.md#L433-L464).

## O que o nosso fork expõe e o DurinDoor não expõe nesse snapshot

| Diferença confirmada | Evidência local | Impacto |
| --- | --- | --- |
| Fluxo de vídeo mais específico: `POST /v1/videos/generations`, `/edits`, `/extensions` e consulta por id. | `src/app/api/v1/videos/` e `src/sse/handlers/videoGeneration.js` | Oferece edição e extensão de vídeo sob rotas estáveis; o DurinDoor só traz as rotas genéricas `video/generations` e `videos/[[...path]]` no snapshot. |
| Instalação/gestão em runtime do `pxpipe-proxy` (install, start, stop, restart, health, logs e métricas). | `src/app/api/pxpipe/`, `src/lib/pxpipe/install.js`, `src/lib/pxpipe/events.js` | Operação de compressão multimodal no dashboard, incluindo auto-instalação. O DurinDoor usa dependência embutida e não expõe essas ações de instalação. |
| Integração explícita com o serviço de sync existente (`CLOUD_URL`) descrita na documentação local. | `src/shared/services/cloudSyncScheduler.js`, `src/app/api/sync/cloud/route.js`, [README local](../README.md#L649-L662) | Sincroniza configurações entre dispositivos. |

## O que o DurinDoor expõe e o nosso fork não expõe nesse snapshot

| Diferença confirmada | Fonte primária DurinDoor | Impacto |
| --- | --- | --- |
| Gateway MCP administrado: instâncias, chaves, OAuth, SSE e mensagens. | [`src/app/api/mcp-gateway`](https://github.com/bloodf/durindoor/tree/cf572ec911afbef2e7cc1248a9be2e7a7b0d439a/src/app/api/mcp-gateway); [README](https://github.com/bloodf/durindoor/blob/cf572ec911afbef2e7cc1248a9be2e7a7b0d439a/README.md#L376-L385) | Publicar/agregar servidores MCP atrás de chaves e rotas geridas. Nosso `api/mcp/[plugin]` é o mecanismo de plugins, não este gateway de instâncias/chaves. |
| API: files, batches (inclusive cancelamento/resultados), completions, image edits, tradução de áudio, música, rerank e moderação. | [árvore `/v1`](https://github.com/bloodf/durindoor/tree/cf572ec911afbef2e7cc1248a9be2e7a7b0d439a/src/app/api/v1); [API declarada](https://github.com/bloodf/durindoor/blob/cf572ec911afbef2e7cc1248a9be2e7a7b0d439a/README.md#L360-L375) | Maior compatibilidade de superfícies OpenAI/Anthropic e mais modalidades; suporte continua dependente do provedor. |
| Realtime com autenticação e `/v1/realtime`, além de grupos de conexões. | [`realtime/auth`](https://github.com/bloodf/durindoor/tree/cf572ec911afbef2e7cc1248a9be2e7a7b0d439a/src/app/api/v1/realtime), [`connection-groups`](https://github.com/bloodf/durindoor/tree/cf572ec911afbef2e7cc1248a9be2e7a7b0d439a/src/app/api/connection-groups) | Sessões de texto em tempo real e organização/seleção de conexões em grupo. |
| Persistência operacional com backups SQLite documentados. | [arquitetura](https://github.com/bloodf/durindoor/blob/cf572ec911afbef2e7cc1248a9be2e7a7b0d439a/README.md#L433-L444); [operações](https://github.com/bloodf/durindoor/blob/cf572ec911afbef2e7cc1248a9be2e7a7b0d439a/README.md#L447-L457) | Vale comparar migrations/backup/retenção antes de portar; nosso fork já possui camada SQLite, portanto isto é principalmente uma diferença de operação e documentação, não prova de ausência de banco local. |

## Leitura prática

Prioridade de portabilidade: **MCP Gateway**, depois **files/batches e Realtime**
se esses clientes fizerem parte do público-alvo. Não vale portar por reflexo
recursos já compartilhados (MITM, Tailscale/túneis, Headroom, RTK/PXPIPE,
Caveman/Ponytail, fallback e Cloud Sync): a inspeção de ambos os códigos mostra
esses blocos nos dois forks. Antes de qualquer cherry-pick, comparar o contrato
de cada rota e testes: os forks já divergiram em nomes, armazenamento e UI.
