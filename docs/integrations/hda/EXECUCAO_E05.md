# Execução E05 — Help Desk + Dev Agent

**14/10/2026 · versão de desenvolvimento 2.0+E05.**

## Resultado

Implementadas a composição transacional concreta, a observação restrita dos recibos originais e a fábrica do serviço de análise. Quatro módulos de produto, quatro suítes de teste e duas fixtures de transporte foram adicionados. Todo o overlay E04 foi preservado; SQL, migrations, core, HTTP, telas, Email Kit, callback e flags não foram alterados.

HDA-02 e HDA-04 permanecem parciais. HDA-03 não foi iniciada, e a recuperação de análise desta entrega não conclui HDA-09. Não há cadastro automático, aprovação humana nova ou notificação HDA operacional.

## Fonte e ambiente

GitHub lido em `ea7a4454f30c45f35dece6e4a702591c55c79cd5`, PR43 integrado. Clone voltou a falhar por DNS; não houve reset, push ou alteração remota. Trabalho em árvore parcial isolada, construída a partir do ZIP E04. Histórico Git local é apenas dessa árvore parcial, sem ancestralidade do repositório remoto.

`runTransaction` completo e três arquivos compartilhados foram recuperados com hashes Git conferidos. Permanecem em `verificacao/context`, exclusivamente para reprodução. A suíte utiliza Node 22.16.0 com usuário Linux não-root. Checagem de tipos usa @types/node 22.19.7 disponível no ambiente, não 22.15.30 do lock. Não houve npm ci/audit/build da árvore completa.

## Testes observados

| Grupo | Resultado |
|---|---:|
| Base E04 recém-executada | 345/345 |
| Proprietário transacional | 24/24 |
| Consulta de recibos | 25/25 |
| Serviço composto | 8/8 |
| Expiração durante esperas | 5/5 |
| Cumulativo final de desenvolvimento | 407/407 |
| TypeScript focado | aprovado |
| Vetores Python independentes | 14 válidos, 12 inválidos, zero falhas |

Os primeiros testes de cada recurso falharam pela funcionalidade ausente antes da implementação. A checagem inicial de tipos apontou quatro parâmetros sem anotação; foram anotados, sem mudança de comportamento. Na revisão, quatro novos negativos demonstraram expiração não aplicada durante esperas. Após correção, 5/5 dessa suíte e 407/407 cumulativos passaram. Logs vermelhos foram preservados.

O runner nativo foi chamado como usuário não-root e retornou código 2, `native_prerequisites_missing`, `executed:false`. Faltam árvore completa/package/lock, pg e binários PG17. Nenhum SQL foi executado; não foi usado um banco hospedado como alternativa.

## Limites

Core real não significa banco real: o transporte das novas provas é sintético. O runner/analisador da composição é sintético; os testes anteriores de subprocesso da E04 também foram repetidos, mas não houve Claude real ou custo de modelo. A revisão foi autorrevisão, sem subagente/revisor independente.

Sem push, merge, deploy, migration remota, segredo, MFA, email, infraestrutura nova ou registro de negócio. Os 81 aceites integrais permanecem pendentes; a contagem técnica não é percentual de conclusão.

## Evidências

`evidencias/E05/01-baseline.tap`; `03/04` TDD transações; `05/06` TDD leitura; `08/09` TDD composição; `13/14` negativos/correção de expiração; `15/16` cumulativo/tipos; `17` Python; `18/19` plano/bloqueio PostgreSQL. A reprodução do pacote final tem relatório separado e confirma os hashes do overlay, patches e execução após extração.
