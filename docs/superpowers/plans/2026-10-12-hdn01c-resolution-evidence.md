# HDN-01c — plano de continuidade e registro

> Executar com `superpowers:executing-plans`. Este plano continua a HDN-01b, sem abrir módulo opcional em lugar da integração.

**Goal:** conferir notas atuais ao consumir o checklist na resolução.
**Architecture:** domínio + adapter/SQL privado existente + composição original de workflow/transação.
**Tech Stack:** Node22/TypeScript, PostgreSQL 17 candidato; nenhuma nova dependência de produto.
**Spec:** `../specs/2026-10-12-hdn01c-resolution-evidence.md`.

## Restrições

Preservar R1, HDW-00/00b, PR28/29 e os arquivos atuais do login/painel. Não ampliar scopes, permissões, versões, migrations históricas, gates ou ambiente hospedado. Sem associação por email, provas do corpo do cliente ou notas em DTOs públicos. SQL é candidato até execução real. Adotar uma das alternativas de patch, não ambas.

## Etapas

- [x] Conferir entrada: 67 hashes internos e 28 arquivos HDN-01b. Reconsultar principal 6e06900; comparação desde fb4c7b9 não altera as três preimagens de HDN-01a/b.
- [x] Reproduzir a lacuna pelo adapter real: 29 testes, 27 RED e 2 controles positivos na leitura antiga. Erros eram de comportamento, não imports ausentes.
- [x] Implementar a conferência de evidências e a leitura privada qualificada.29/29 GREEN.
- [x] Compor com workflow: 2 RED de classificação segura de erro, 30 aprovados; preservar códigos seguros de evidência e indisponibilidade.32/32 GREEN.
- [x] Autorrevisão: resposta internamente coerente de outro ticket era aceita pelo adapter; 1 RED / 32 positivos. Vincular target;33/33 GREEN.
- [x] Preservar 184 testes anteriores e adaptar somente a fixture do envelope de `readExecutionChecklist` ao contrato novo, mantendo e reforçando suas asserções. Conjunto 217/217.
- [x] Acrescentar 7 cenários SQL: existência, nota de C, autor, data, ACL, ausência de efeitos e locks. Os 12 anteriores permanecem; 19 subtestes escritos.
- [ ] Executar candidato / 19 subtestes em PostgreSQL 17 pelo runner existente. Não executado nesta rodada.
- [ ] Executar instalação pinada, testes/contratos/build/upgrade/CI integrais e revisão independente.
- [ ] Depois dos gates, integrar armazenamento real do workflow, publicador de template/binding, migração, interface e proteção dos endpoints antigos. Mantêm-se como requisitos da HDN-01b, não concluídos por esta leitura.

## Rulings

- T5b bloqueado por pré-requisitos: manter o gate aberto e realizar somente revisão/correção desta mesma fronteira. Custo: não comprova comportamento no motor SQL.
- Não confundir constatação no snapshot com ação no GEO: evidencia registrada não certifica execução.
- Notas de vários itens: deduplicar somente a leitura, nunca eliminar uma das validações de autoria/tempo.
- Histórico/replay: confirmação antiga não faz outra resolução e não deve se transformar em gravação nova para atualizar evidências.

## Foco da revisão

Ausência/troca de nota, divergência de ticket/conta/workspace, autoria múltipla, precisão temporal, dados privados no envelope, erro sem fallback, transação e COMMIT. Contenção por SQL/RLS/concorrência só se comprova no runner real, ainda pendente.

Final review: self-review (no subagent tool). Autorrevisão não é revisão independente.
