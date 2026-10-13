# HDN-01g — plano executado para recusa do fluxo antigo

**Objetivo:** proteger o caminho original de finalização de chamados vinculados ao checklist, sem alterar o comportamento dos chamados legados sem vínculo.
**Base:** HDN-01F e principal 6e069005beaa12d7cb55c77af92478c21f7526ca.
**Fonte de requisito:** Requisitos Help Desk.md, RF-CEN-07; handoff HDN01F, Montagem e operação.
**Execução:** inline em cópia local isolada; não é clone ou branch remota.

## Fronteiras e decisão

O guard rejeita finalização pelo adaptador antigo; não substitui o workflow estruturado nem concede autorização SQL. Snapshot do alvo antes do primeiro await. Ausência integral da instalação preserva legado; ausência parcial é falha. Estado idêntico não é nova finalização. Não modificar schemas hospedados, scopes, Auth, login, UI ou gates.

Ruling: com PostgreSQL indisponível, o incremento cobre a recusa no caminho antigo já prevista no handoff. Não foi criado outro módulo funcional. A aceitação de SQL permanece aberta; custo da decisão é uma função candidata adicional a integrar e testar.
Ruling: testes do método AST real são explicitamente isolados; não substituem construção da unidade de trabalho ou testes SQL. O conjunto novo inclui cenário PostgreSQL para essa composição.
Ruling: a proteção contra SQL arbitrário e o corte inicial da migration permanecem bloqueios, não garantias inferidas do novo guard.

## Arquivos e tarefas

- [x] Conferir input ZIP (98 hashes/61 arquivos) e a base remota; ler o adaptador original e as políticas do projeto.
- [x] Reproduzir ausência de recusa por testes de `assertLegacyTerminalUpdateAllowed` e do método AST `PostgresStore.updateTicket`.
- [x] Implementar `src/infrastructure/legacy-transition-guard.ts`: verificação de catálogo, contrato de saída, chamadas parametrizadas e erros sanitizados.
- [x] Alterar somente import e `updateTicket` em `src/infrastructure/postgres.ts`: snapshot único + guard + UPDATE original + assertSingleWrite.
- [x] Escrever função privada candidata `hdn_legacy_terminal_update` com ordem de lock, revisão, scopes e recurso completos.
- [x] Acrescentar seis cenários no arquivo SQL existente, sem remover as 23 verificações anteriores.
- [x] Executar 504 testes focais; testar mutações; verificar tipos novos/sintaxe e fontes de apoio.
- [x] Autorrevisar limites e compatibilidade; registrar pendências abaixo.
- [ ] Executar os 29 cenários em PostgreSQL17 descartável usando o runner do checkout completo.
- [ ] Executar instalação fixada, typecheck integral, contratos, migrations, build, audit e browser aplicável.
- [ ] Revisão independente da composição, SQL e corte de migração.
- [ ] Concluir montagem real, migration/upgrade e proteção de todos os caminhos antes da liberação.

## Interfaces verificadas

`assertLegacyTerminalUpdateAllowed(client,p,change,expectedVersion):Promise<void>` consome a conexão emprestada existente e os identificadores imutáveis da escrita; não devolve prova reutilizável. `hdn_legacy_terminal_update(w,a,target,next_status,expected_version)` devolve somente `legacy_allowed` ou lança exceção. O tratamento defensivo de `structured_required` permanece recusa, jamais autorização.

A alteração não modifica `runTransaction`, não cria pool e não retenta mutações. `assertSingleWrite` continua exigindo exatamente uma linha. Estado compartilhado da entrada não pode retargetar UPDATE enquanto o guard aguarda.

## Evidência

Testes novos: 42. Regressões preservadas: 462. Final 504/504 sem skip, falha, cancelamento ou TODO. Três mutações detectadas e restauradas. Cenários SQL: 29 escritos/0 executados. O relatório de operações e os logs do pacote descrevem a verificação focal e o método AST, sem alegar validação integral.

Final review: self-review (no subagent tool). Revisão independente não realizada. O template auxiliar code-reviewer.md da skill não foi recuperado; a revisão seguiu as instruções principais disponíveis e as fronteiras de segurança descritas neste plano.
