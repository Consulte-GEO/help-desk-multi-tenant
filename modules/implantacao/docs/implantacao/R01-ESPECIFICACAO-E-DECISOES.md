# R01 — Integridade de dados e ponte do conversor

## Objetivo e estado

Implementar a primeira parte de IMP-01: impedir que valores especificados/padrões se tornem medições; tornar explícita a revisão de eventos; impedir equivalências estruturais indevidas; iniciar identidades e contabilidade por entrega. Desenvolvimento local, sem liberação operacional. IMP-01 completo continua aberto.

## Decisões implementadas

### Especificação, medição e unidade

`SimilarityEngine` 2.0.0 apresenta o nominal como referência (`semanticRole=specified`, `referenceOnly=true`). `apply` nega escrita em Slump/Flow/Volume mesmo com aceite em lote, valor escolhido ou proposta antiga sem metadados. Mantém associações de cadastro, preservação de originais e placa IMPORT.

`ImportIntegrity.readFreshMeasurement` aceita apenas escalar com unidade explícita na célula, no cabeçalho ou confirmada para aquela aba/coluna. Não decide mm pelo tamanho do número. `120 mm` vira `12 cm`; `120` sem unidade permanece pendente. `12±2` é especificação, inclusive quando digitado no campo medido. Raw, unidade e decisão permanecem disponíveis.

No exportador geomat, FLOW não é gravado em campos slump_*. Especificação de SLUMP só normaliza com unidade documentada; a descrição permanece intacta. Ausência de representação de FLOW no contrato deve ser resolvida na qualificação do destino, não pela invenção de campos novos.

### Eventos distintos e revisão

Sem revisão explícita, cada linha recebe número provisório próprio. Duas linhas com mesmo dia/bloco/unidade/peça **não são agrupadas automaticamente**; geram pendência até confirmação na coluna Número Concretagem. A decisão fica em `_importEventDecision` vinculada ao contexto. Mudança de data/local/peça invalida a decisão. Revalidar não apaga a numeração confirmada.

A R01 não trata linhas de CP como caminhões: esse reconhecimento exige a classificação da granularidade em IMP-06/08. Não foi habilitada união de locais/peças diferentes; casos assim permanecem pendentes para o importador específico. Número provisório não é identidade do destino nem idempotência operacional.

### Tipos estruturais

A equivalência agora considera grupo, local, etapa, FCK, concreto, volume, projetista e observações; usa array serializado, evitando colisões por `|`. A identidade da peça não é eliminada. Itens diferentes não herdam silenciosamente o projetista/nome do primeiro. Volume por tipo representa uma peça equivalente, não a soma das repetições. O payload candidato informa schema 1.2.0; aceitação pelo consumidor ainda não foi comprovada.

### Identidade e soma por entrega

`sourceRecordId` identifica deterministicamente arquivo/aba/linha/tipo/ordinal e preserva CPs diferentes com resultados iguais. `summarizeDeliveries` requer vínculo documentado de entrega e mesmo escopo, soma volumes uma vez por entrega e usa centésimos exatos. Conflito, precisão não suportada ou vínculo ausente resultam em total indefinido e pendências, não número inventado.

Esses dois recursos são **núcleo testado**, ainda não conectados à entrada real de laudos/planilhas nem à persistência. Eles não criam autenticação, aprovação, PK de produção ou prova de execução.

## Montagem transitória

`frontend/public/assets/import-legacy-adapter.js` é uma ponte explícita para o Copilot 3.4.0. A transformação do HTML carrega os motores versionados e chama `install` antes de STORAGE.load/BOOT. Não se faz patch de trecho recuperado parcialmente como se fosse arquivo completo.

A ponte recompõe medições após o preparo legado a partir de `_raw`; bloqueia o caminho antigo de aceite nominal por grupo; preserva validators existentes e acrescenta achados de integridade; valida novamente antes de exportar; adiciona unidade por coluna e orientação de revisão de eventos. O preenchimento padrão de volume aparece desativado. Troca de arquivo/aba descarta decisões de unidade.

É uma integração **temporária e limitada**: em IMP-06, extrair os componentes do monólito e substituir as interceptações por chamadas diretas, mantendo os testes de contrato. Falha/incompatibilidade de motores impede o BOOT e informa atualização incompleta. Aprovação/autorização não pode depender desses objetos no navegador.

## Contratos de código e responsabilidade

| Arquivo | Responsabilidade |
|---|---|
| `frontend/public/assets/similarity-engine.js` | Propostas consultivas e bloqueio de escrita inferida em medições. |
| `frontend/public/assets/import-integrity.js` | Leitura escalar/unidades, eventos, identidades, soma de entregas e achados. |
| `frontend/public/assets/import-legacy-adapter.js` | Ponte de interface/preparo/revisão/exportação para o legado. |
| `frontend/src/services/geoControleExportService.ts` | Tipos sem fusão indevida e unidade/família de especificação. |
| `tools/apply-imp-r01.cjs` | Conferir/aplicar arquivos e transformações somente no checkout local. |
| `tools/tests/import-integrity/*` | Testes focais e harness explicitamente sintético. |

Não há arquivos novos em src/services/models/components/views; a allow-list do cleanup não precisa ser ampliada para os dois motores em public/assets. Ainda assim, o build completo precisa ser executado no checkout real para detectar qualquer efeito do prebuild.

## Alteração das regras de testes anteriores

S11 e S15 da SimilaritySelfTest contradiziam os requisitos aprovados: S11 exigia aplicar nominal como medição; S15 exigia inferir mm. Os casos permanecem, com asserções invertidas/fortalecidas e rastro RED/GREEN. Os outros IDs e gates não foram removidos, desativados ou convertidos em skip. A suite antiga retornou 19/21 contra o novo comportamento; a revisão das duas regras retornou 21/21.

## Fora desta entrega

Persistência multiusuário, armazenamento privado, identidade do cliente, Help Desk, aprovação imutável, Claude CLI/executor, importação real, conciliação de destino, OCR e atualizações da wiki. Continuam necessários testes de tipos/build/monólito completo, dados reais autorizados, PG/RLS e homologação hospedada.
