# HDN-01g — recusa de finalização pelo adaptador antigo

## Estado desta entrega — 12/10/2026

Implementação LOCAL sobre a fonte HDN-01a/b/c/d/e/f e a principal consultada `6e069005beaa12d7cb55c77af92478c21f7526ca` de `Consulte-GEO/help-desk-multi-tenant`. Não foi criado commit remoto, migration ou deploy. Login simplificado, painel após login, scopes e Auth permanecem inalterados.

Esta rodada retoma RF-CEN-07 (checklist obrigatório antes de finalizar) e o item do handoff F que exige proteger os caminhos antigos de resolução. Não altera o escopo de RF-CEN-11 nem autoriza ações no GEO. A execução real do candidato no PostgreSQL continua pendente.

## Achado e alcance da correção

O `PostgresStore.updateTicket` original escrevia status, versão e data sem consultar o vínculo do checklist. A proteção colocada somente no workflow estruturado não fazia esse adaptador antigo participar da recusa. Foi reproduzido que seu método emitia UPDATE para `resolved`/`closed` mesmo quando o transporte de teste declarava um vínculo protegido.

O adaptador original agora chama `assertLegacyTerminalUpdateAllowed` na mesma conexão emprestada, antes da escrita terminal. Um chamado vinculado a checklist precisa usar o workflow estruturado, MESMO se suas marcações parecem concluídas. A decisão estruturada continua responsável pela conferência de versão, evidências, auditoria e resolução. Este helper não concede autorização para essa decisão.

| Situação | Resultado desta implementação |
|---|---|
| Status solicitado não é resolved/closed | Caminho anterior preservado; nenhuma consulta adicional HDN |
| Tabela de vínculo e helper HDN inteiramente ausentes | Banco legado preservado; controles atuais de role/schema/RLS continuam valendo |
| Apenas uma das estruturas está presente | Recusa por indisponibilidade, não tratamento como legado |
| Consulta ausente, malformada ou falha | Recusa; não aceitar aprovação implícita |
| Chamado com vínculo muda para resolved/closed | Helper candidato lança HD008; camada aplica 409/structured_workflow_required |
| Chamado sem vínculo, autorizado e na revisão correta | Helper pode retornar legacy_allowed; o UPDATE ainda exige confirmação de uma linha |
| Status já é igual ao solicitado | Helper permite a atualização de mesma situação, necessária para mensagem que só avança versão |
| Conta, acesso ou revisão incompatível | Recusa específica sanitizada, sem mensagem bruta do driver |

A origem de identidade continua no executor atual. O objeto com status, versão e alvo é capturado uma única vez ANTES da espera. O UPDATE usa esse mesmo objeto, mesmo se o chamador interno alterar a referência original durante a consulta. Não há nova conexão, commit, retry ou release neste helper.

## Limite obrigatório: isto NÃO é uma regra geral do banco

A recusa cobre o adaptador original `PostgresStore.updateTicket`. Não impede, por si só, um UPDATE arbitrário emitido por outro componente com privilégio SQL, nem substitui o conjunto de proteções da futura migration e do armazenamento estruturado. Não foi criado trigger que afirme uma prova de checklist por GUC do cliente. O caminho estruturado ainda deve comprovar e gravar a decisão na mesma conexão, sob ACL e revisões atuais.

A instalação inicial do recurso e a criação/publicação dos vínculos devem ocorrer com atendimento fechado e revisão da atomicidade. Uma consulta ao catálogo não resolve corrida de instalação/DDL. A compatibilidade quando AMBAS as estruturas estão ausentes não deve ser utilizada como permissão de publicar uma categoria que exige checklist sem seu backend instalado.

## SQL candidato

`supabase/candidates/hdn_execution_checklist.sql` recebeu a função privada:

```sql
helpdesk_auth.hdn_legacy_terminal_update(uuid, uuid, uuid, text, integer)
```

Ela exige o login restrito `helpdesk_app`, contexto do workspace, escopos atuais de leitura/escrita, permissão de ticket e cobertura integral de recursos. O ticket é bloqueado antes de conferir revisão e vínculo; os scopes são conferidos novamente após a espera. O vínculo, quando presente, é lido com lock compartilhado. A ordem é pai antes de vínculo, consistente com as operações do checklist.

O SECURITY DEFINER é limitado à leitura privada e recusa; search_path vazio, parâmetros fixos, sem SQL livre. EXECUTE é revogado de PUBLIC e dos papéis de cliente antes do grant específico ao login da aplicação. Não há nova tabela, alteração nas 12 migrations, ampliação dos scopes humanos ou escrita em projeto hospedado. Esta função existe apenas no arquivo candidato, NÃO no banco de produção.

HD008 é exceção SQL, não sucesso com um booleano de recusa. A intenção é manter a transação malsucedida mesmo se o chamador capturar o erro. O runner existente mantém erro de consulta e não confirma um lote malsucedido. Essa composição necessita execução nos cenários SQL, ainda NÃO realizada.

## Testes observados

Foram escritos 42 casos novos: 36 do guard e seis do método adaptador. RED do guard com corpo sem efeito: 28 falhas em 35 casos iniciais. RED do método original: três falhas e três controles aprovados. Após implementação e teste HD008, 42/42 aprovados.

Conjunto final: 504/504 = 462 casos preservados + 42 novos; zero falhas, skips, cancelamentos ou TODO. O comando é:

```sh
node --experimental-strip-types --test --test-reporter=tap \
  tests/execution-checklist*.test.ts \
  tests/support-workflow.test.ts tests/support-workflow-application.test.ts \
  tests/resource-access-store.test.ts tests/resource-transaction.test.ts
```

Os seis testes do adaptador extraem e executam o método AST EXATO de `postgres.ts`, utilizando o TypeScript já declarado como dependência de desenvolvimento do projeto. Não é uma cópia manual do método e não constrói o PostgresUnitOfWork completo. Guard, confirmação de escrita e runner são reais; driver/autoridade são controlados. Isso prova os despachos e parâmetros do método, não role/readiness/RLS/durabilidade no PostgreSQL.

Três mutações deliberadas foram detectadas: omitir chamada do guard (três falhas), tratar instalação parcial como ausência (duas), usar alvo mutável no UPDATE (uma). Fontes restauradas e suíte repetida. Não remover essas negativas.

Verificação de tipos focal do novo guard e dos dois novos testes: aprovada com TS5.8.3 e tipos globais. Transpilação sintática do arquivo PostgreSQL e do cenário SQL: sem diagnóstico. NÃO é typecheck do repositório completo, `npm ci`, audit ou build. Nenhuma nova dependência foi incluída no produto.

## Cenários PostgreSQL

Os 23 testes anteriores foram preservados e seis acrescentados, totalizando 29 subtestes escritos no mesmo registrador protegido:

1. Serviço original não resolve chamado vinculado, mesmo com itens concluídos; nenhuma alteração de ticket/evento.
2. PostgresUnitOfWork original não fecha chamado vinculado.
3. Helper recusa obra C, A+C e conta estrangeira.
4. Exceção HD008 capturada pelo chamador ainda provoca rollback pelo runner.
5. Chamado autorizado sem vínculo continua resolvendo no serviço original.
6. Mensagem em chamado já resolvido/vinculado avança versão sem outra conclusão.

Os dois tickets sintéticos adicionais têm vínculos de recurso explícitos na fixture. Nenhuma permissão de produção foi alterada para viabilizar os testes. **29 escritos, ZERO executados nesta rodada.** Falta servidor PostgreSQL17 no ambiente; pg_config aponta um bindir sem postgres/initdb. Docker e CLI ausentes. O download tentado não produziu instalação utilizável. Não houve fallback para o Supabase hospedado.

## Revisão, montagem e próximos gates

Autorrevisão realizada; revisão independente pendente. Pontos reavaliados: metadados incompletos não autorizam; o erro é sanitizado sem executar acessor; mesmo alvo antes/depois da espera; permissão por recurso não é substituída pelo guard; callbacks/recibos anteriores não foram alterados; privacidade e ausência de novos efeitos externos.

Primeiro executar o candidato e os 29 cenários pelo runner original, corrigindo setup e código quando necessário. Em seguida: concluir o armazenamento estruturado e a proteção de todos os caminhos de finalização, promover migration pela CLI com schema/readiness/manifest coerentes, testar upgrade, publicação legítima de templates/vínculos, integração da UI e conversa, CI atual e revisão independente. Só então considerar a ativação de uma categoria. Não há aprovação operacional nesta entrega.

Referências técnicas consultadas: PostgreSQL17, Explicit Locking, https://www.postgresql.org/docs/17/explicit-locking.html . A documentação explica o mecanismo proposto; não constitui evidência de execução deste SQL. O changelog markdown Supabase não pôde ser lido pela ferramenta nesta rodada; nenhuma API nova Supabase foi presumida.
