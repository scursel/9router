# Pesquisa: provedores e modelos que se atualizam

Pesquisa feita em 5 de setembro de 2026. O único candidato verificado que
atende substancialmente ao objetivo é o
[OmniRoute](https://github.com/diegosouzapw/OmniRoute), na revisão
[`9d1a896`](https://github.com/diegosouzapw/OmniRoute/tree/9d1a896c6058b2ade94c9078c2e54377b9aa76d3).

## Resposta curta

Vale aproveitar código do OmniRoute, mas não trocar o nosso fork por ele.
Ele traz uma lista muito maior de integrações nativas e, mais importante,
atualiza periodicamente os modelos que cada conta realmente pode usar. É a
base mais pronta encontrada para remover a manutenção manual de listas de
modelos.

Não existe um fork verificado que descubra sozinho, de forma confiável, que
um modelo passou a ser gratuito ou pago em **todos** os provedores. Essa
informação raramente vem na API do provedor: alguém ainda precisa confirmar
as condições comerciais. O OmniRoute também tem esse limite.

## O que o OmniRoute já faz

| Necessidade | O que existe lá | Limite importante |
| --- | --- | --- |
| Mais provedores nativos | Catálogo central com centenas de provedores, separados por tipos de acesso; não são apenas campos de URL personalizados. [Referência gerada](https://github.com/diegosouzapw/OmniRoute/blob/9d1a896c6058b2ade94c9078c2e54377b9aa76d3/docs/reference/PROVIDER_REFERENCE.md) | Alguns continuam sendo compatíveis com a API padrão; isso é normal e não reduz a utilidade. |
| Novos modelos de uma conta/provedor | Cada conexão pode ter `autoSync`; o sistema busca e guarda a lista do próprio provedor no início e a cada 24 horas. [Agendador](https://github.com/diegosouzapw/OmniRoute/blob/9d1a896c6058b2ade94c9078c2e54377b9aa76d3/src/shared/services/modelSyncScheduler.ts#L147-L280) | Só funciona onde o provedor expõe uma lista de modelos ou onde eles escreveram um conector específico. |
| Modelos e preços/capacidades atualizados | Baixa diariamente o catálogo aberto do [models.dev](https://models.dev/api.json), aplica tentativas de novo em falhas e guarda preço, contexto e capacidades. [Implementação](https://github.com/diegosouzapw/OmniRoute/blob/9d1a896c6058b2ade94c9078c2e54377b9aa76d3/src/lib/modelsDevSync.ts#L1-L21) e [rotina](https://github.com/diegosouzapw/OmniRoute/blob/9d1a896c6058b2ade94c9078c2e54377b9aa76d3/src/lib/modelsDevSync.ts#L565-L710) | O models.dev melhora os dados de modelos conhecidos; não cria automaticamente uma integração de autenticação/transporte para um provedor novo. |
| Grátis versus pago claro | Classifica modelos como gratuitos por preço zero, sufixo `:free`, sinal do provedor e catálogo curado; prioriza grátis e permite importá-los separadamente. [Classificador](https://github.com/diegosouzapw/OmniRoute/blob/9d1a896c6058b2ade94c9078c2e54377b9aa76d3/src/shared/utils/freeModels.ts) | A classificação comercial não pode ser deduzida com segurança apenas pelo nome. |
| Atualização de grátis entre lançamentos | O Radar recebe um catálogo remoto assinado, com cache local e opção de desligar. [Documentação e limites](https://github.com/diegosouzapw/OmniRoute/blob/9d1a896c6058b2ade94c9078c2e54377b9aa76d3/docs/frameworks/RADAR.md) | O servidor que alimenta o Radar é privado e a parte ao vivo requer chave; não dá para simplesmente copiar e ter uma fonte independente. |

Um exemplo de integração nativa é o Kiro: ele pergunta ao serviço quais
modelos aquela conta e plano liberam, e só recorre à lista fixa se a consulta
falhar. [Código](https://github.com/diegosouzapw/OmniRoute/blob/9d1a896c6058b2ade94c9078c2e54377b9aa76d3/open-sse/services/kiroModels.ts).

Para OpenRouter, há ainda uma rotina própria que lê a lista oficial, mantém
um cache de 24 horas e conserva o último catálogo bom se a rede falhar.
[Código](https://github.com/diegosouzapw/OmniRoute/blob/9d1a896c6058b2ade94c9078c2e54377b9aa76d3/src/lib/catalog/openrouterCatalog.ts).

## Onde nosso fork está hoje

O nosso fork já baixou uma parte dessa ideia: ele consulta `models.dev` uma
vez por dia com ETag e aplica apenas correções de capacidade (por exemplo,
contexto e suporte a imagem) sobre as tabelas locais.
[Implementação local](../src/lib/modelCatalog/sync.js). Ele também mostra
sugestões de alguns provedores no painel, mas esse resultado fica só em cache
curto e não vira uma lista persistente e automaticamente utilizável para cada
conta. [Busca local](../src/shared/utils/providerModelsFetcher.js).

Portanto, o que ainda falta não é uma nova pesquisa do zero: é portar do
OmniRoute o mecanismo de sincronizar, guardar e usar os modelos por conexão,
mais a tela/filtro que deixa “gratuito”, “com créditos” e “pago” visíveis.

## Recomendação prática

Copiar do OmniRoute, nesta ordem:

1. O `autoSync` por conexão e a gravação das listas retornadas pelos provedores.
2. Os conectores nativos dos provedores que hoje usamos como “custom”, começando pelos que você já utiliza.
3. O filtro visual gratuito/pago, usando preço retornado por OpenRouter quando houver e uma lista curada para os demais.

Não portar o Radar por enquanto: sem operar uma fonte própria, ele nos deixa
dependentes do serviço privado deles. A lista estática de gratuitos do próprio
OmniRoute também declara explicitamente que é curada manualmente.
[Fonte](https://github.com/diegosouzapw/OmniRoute/blob/9d1a896c6058b2ade94c9078c2e54377b9aa76d3/open-sse/config/freeModelCatalog.data.ts#L1-L27).
